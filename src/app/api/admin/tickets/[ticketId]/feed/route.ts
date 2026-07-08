import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { buildSearchDocument } from "@/lib/agents/searchDocument";
import { parseMoney } from "@/lib/agents/fallbackParser";
import { analyzePropertyImages, mergeVisionIntoProperty } from "@/lib/agents/propertyVisionAgent";
import { scoreProperty } from "@/lib/agents/propertyScoringAgent";
import { rankAndPersistShortlist } from "@/lib/agents/shortlistRankingAgent";
import { RentalRequirementSchema } from "@/lib/agents/schemas";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { splitList } from "@/lib/utils";

const bucketName = process.env.PROPERTY_MEDIA_BUCKET || "property-media";

function text(value: FormDataEntryValue | null) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof File) return null;
  return String(value).trim() || null;
}

function normalizeBhk(value: string | null) {
  if (!value) return null;
  const match = value.match(/studio|[1-6]\s*bhk/i);
  return match ? match[0].toUpperCase().replace(/\s+/g, "") : value;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "media";
}

async function ensureBucket(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  const { data } = await supabase.storage.getBucket(bucketName);
  if (data) {
    if (!(data as { public?: boolean }).public) {
      await supabase.storage.updateBucket(bucketName, { public: true });
    }
    return;
  }
  await supabase.storage.createBucket(bucketName, { public: true });
}

async function uploadMedia({
  supabase,
  ticketId,
  files,
  mediaType
}: {
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
  ticketId: string;
  files: File[];
  mediaType: "photo" | "video";
}) {
  if (!files.length) return [];
  await ensureBucket(supabase);
  const urls: string[] = [];

  for (const file of files) {
    if (!file.size) continue;
    const extension = file.name.includes(".") ? file.name.split(".").pop() : mediaType === "photo" ? "jpg" : "mp4";
    const path = `${ticketId}/${mediaType}s/${Date.now()}-${crypto.randomUUID()}-${slug(file.name || `${mediaType}.${extension}`)}`;
    const { error } = await supabase.storage.from(bucketName).upload(path, await file.arrayBuffer(), {
      cacheControl: "3600",
      contentType: file.type || (mediaType === "photo" ? "image/jpeg" : "video/mp4"),
      upsert: false
    });
    if (error) throw error;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

function requirementsFromTicket(ticket: any) {
  return RentalRequirementSchema.parse({
    city: ticket.city ?? null,
    preferredLocalities: ticket.preferred_localities ?? [],
    budgetMin: ticket.budget_min ?? null,
    budgetMax: ticket.budget_max ?? null,
    bhk: ticket.bhk ?? null,
    propertyTypes: ticket.property_types ?? [],
    furnishing: ticket.furnishing ?? null,
    moveInDate: ticket.move_in_date ?? null,
    tenantType: ticket.tenant_type ?? null,
    brokeragePreference: ticket.brokerage_preference ?? null,
    parkingRequired: ticket.parking_required ?? null,
    petsRequired: ticket.pets_required ?? null,
    mustHaves: ticket.must_haves ?? [],
    niceToHaves: ticket.nice_to_haves ?? [],
    dealBreakers: ticket.deal_breakers ?? [],
    subjectivePreferences: Array.isArray(ticket.subjective_preferences) ? ticket.subjective_preferences : [],
    missingFields: [],
    clarifyingQuestions: ticket.clarifying_questions ?? [],
    confidence: ticket.parse_confidence ?? 0.6
  });
}

export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  const form = await request.formData();
  const { data: ticket } = await supabase.from("rental_tickets").select("*").eq("id", params.ticketId).single();
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const photoFiles = form.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);
  const videoFiles = form.getAll("videos").filter((item): item is File => item instanceof File && item.size > 0);
  const uploadedPhotos = await uploadMedia({ supabase, ticketId: params.ticketId, files: photoFiles, mediaType: "photo" });
  const uploadedVideos = await uploadMedia({ supabase, ticketId: params.ticketId, files: videoFiles, mediaType: "video" });

  const pastedBrokerNotes = text(form.get("broker_notes"));
  const photoUrls = [...uploadedPhotos, ...splitList(text(form.get("photo_urls")))];
  const videoUrl = uploadedVideos[0] ?? text(form.get("video_url"));
  const description = text(form.get("description"));
  const adminNotes = [pastedBrokerNotes, text(form.get("admin_notes"))].filter(Boolean).join("\n\n") || null;

  const baseProperty = {
    source: "admin_data_feed",
    source_url: text(form.get("source_url")),
    title: text(form.get("title")) ?? "Broker-fed rental property",
    description,
    city: text(form.get("city")) ?? ticket.city,
    locality: text(form.get("locality")),
    address_hint: text(form.get("address_hint")),
    rent: parseMoney(text(form.get("rent"))),
    maintenance: parseMoney(text(form.get("maintenance"))),
    deposit: text(form.get("deposit")),
    brokerage: text(form.get("brokerage")),
    bhk: normalizeBhk(text(form.get("bhk"))),
    furnishing: text(form.get("furnishing")),
    carpet_area: text(form.get("carpet_area")),
    floor: text(form.get("floor")),
    total_floors: text(form.get("total_floors")),
    parking: text(form.get("parking")),
    available_from: text(form.get("available_from")),
    tenant_allowed: text(form.get("tenant_allowed")),
    pets_allowed: text(form.get("pets_allowed")),
    property_type: text(form.get("property_type")),
    photos: photoUrls,
    video_url: videoUrl,
    contact_name: text(form.get("contact_name")),
    contact_phone: text(form.get("contact_phone")),
    contact_type: text(form.get("contact_type")),
    verification_status: text(form.get("verification_status")) ?? "unverified",
    availability_status: text(form.get("availability_status")) ?? "unknown",
    global_status: "active",
    verified_notes: text(form.get("verified_notes")),
    pros: splitList(text(form.get("pros"))),
    cons: splitList(text(form.get("cons"))),
    missing_info: splitList(text(form.get("missing_info"))),
    admin_notes: adminNotes,
    raw_import: {
      entryType: "admin_data_feed",
      brokerNotes: pastedBrokerNotes,
      uploadedPhotosCount: uploadedPhotos.length,
      uploadedVideosCount: uploadedVideos.length
    },
    is_global_inventory: true,
    is_published: false
  };

  const { vision, fallbackUsed: mediaFallbackUsed } = await analyzePropertyImages({
    photos: baseProperty.photos,
    videoUrl: baseProperty.video_url,
    propertyText: [baseProperty.title, baseProperty.description, baseProperty.admin_notes].filter(Boolean).join("\n")
  });
  const propertyWithMedia = mergeVisionIntoProperty(baseProperty, vision);
  const propertyPayload = {
    ...propertyWithMedia,
    enrichment_details: {
      source: "admin_data_feed",
      directFieldsUsed: true,
      mediaAnalysisFallbackUsed: mediaFallbackUsed
    },
    search_document: buildSearchDocument(propertyWithMedia)
  };

  const { data: inserted, error } = await supabase.from("properties").insert(propertyPayload).select("*").single();
  if (error || !inserted) return NextResponse.json({ error: error?.message || "Could not create property." }, { status: 500 });

  const requirements = requirementsFromTicket(ticket);
  await supabase.from("ticket_properties").insert({ ticket_id: params.ticketId, property_id: inserted.id, source: "admin_data_feed" });
  const scored = await scoreProperty(requirements, inserted);
  await supabase.from("ticket_property_candidates").upsert(
    {
      ticket_id: params.ticketId,
      property_id: inserted.id,
      source: "admin_data_feed",
      deterministic_score: scored.deterministicScore,
      match_score: scored.score.matchScore,
      recommendation: scored.score.recommendation,
      hard_filter_status: scored.score.hardFilterStatus,
      matched_requirements: scored.score.matchedRequirements,
      missing_information: scored.score.missingInformation,
      risks: scored.score.risks,
      pros: scored.score.pros,
      cons: scored.score.cons,
      verification_questions: scored.score.verificationQuestions,
      subjective_assessments: scored.score.subjectiveAssessments,
      ai_score_details: scored.score,
      admin_status: "suggested",
      is_published: false
    },
    { onConflict: "ticket_id,property_id" }
  );
  await rankAndPersistShortlist(params.ticketId, requirements);

  return NextResponse.json({ property: inserted });
}
