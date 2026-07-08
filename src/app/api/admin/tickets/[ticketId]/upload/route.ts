import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { isAdminAuthenticated } from "@/lib/auth";
import { buildSearchDocument } from "@/lib/agents/searchDocument";
import { enrichProperty } from "@/lib/agents/propertyEnrichmentAgent";
import { mergeVisionIntoProperty } from "@/lib/agents/propertyVisionAgent";
import { scoreProperty } from "@/lib/agents/propertyScoringAgent";
import { rankAndPersistShortlist } from "@/lib/agents/shortlistRankingAgent";
import { RentalRequirementSchema } from "@/lib/agents/schemas";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  const form = await request.formData();
  const file = form.get("file");
  const previewOnly = form.get("preview") === "true";
  const validOnly = form.get("validOnly") === "true";
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
  if (previewOnly) return NextResponse.json({ rows: rows.slice(0, 25), count: rows.length });

  const { data: ticket } = await supabase.from("rental_tickets").select("*").eq("id", params.ticketId).single();
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const requirements = RentalRequirementSchema.parse({
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
    clarifyingQuestions: [],
    confidence: ticket.parse_confidence ?? 0.6
  });

  const importRows = validOnly
    ? rows.filter((row) => ["title", "city", "locality", "rent", "bhk", "brokerage"].every((field) => String(row[field] ?? "").trim()))
    : rows;
  let imported = 0;
  for (const raw of importRows) {
    const { enrichment, vision, fallbackUsed, visionFallbackUsed } = await enrichProperty(raw, { ticketRequirements: requirements });
    const baseProperty = {
      source: text(raw.source) ?? "admin_upload",
      source_url: text(raw.source_url),
      title: enrichment.normalizedTitle,
      description: enrichment.normalizedDescription,
      city: enrichment.normalizedCity ?? text(raw.city) ?? ticket.city,
      locality: enrichment.normalizedLocality ?? text(raw.locality),
      address_hint: text(raw.address_hint),
      rent: enrichment.cleanedRent,
      maintenance: enrichment.cleanedMaintenance,
      deposit: enrichment.cleanedDeposit ?? text(raw.deposit),
      brokerage: enrichment.normalizedBrokerage,
      bhk: enrichment.normalizedBhk,
      furnishing: enrichment.normalizedFurnishing,
      carpet_area: text(raw.carpet_area),
      floor: text(raw.floor),
      total_floors: text(raw.total_floors),
      parking: enrichment.normalizedParking ?? text(raw.parking),
      available_from: enrichment.normalizedAvailableFrom ?? text(raw.available_from),
      tenant_allowed: enrichment.normalizedTenantAllowed ?? text(raw.tenant_allowed),
      pets_allowed: enrichment.normalizedPetsAllowed ?? text(raw.pets_allowed),
      property_type: text(raw.property_type),
      photos: enrichment.normalizedPhotos,
      video_url: text(raw.video_url),
      contact_name: text(raw.contact_name),
      contact_phone: text(raw.contact_phone),
      contact_type: text(raw.contact_type),
      verification_status: enrichment.verificationStatus ?? "unverified",
      availability_status: text(raw.availability_status) ?? "unknown",
      global_status: "active",
      verified_notes: text(raw.verified_notes),
      spaciousness_score: enrichment.spaciousnessScore,
      sunlight_score: enrichment.sunlightScore,
      maintenance_condition_score: enrichment.maintenanceConditionScore,
      general_quality_score: enrichment.generalQualityScore ?? null,
      pros: enrichment.normalizedPros,
      cons: enrichment.normalizedCons,
      missing_info: enrichment.normalizedMissingInfo,
      admin_notes: text(raw.admin_notes),
      media_analysis: enrichment.mediaAnalysis ?? null,
      user_facing_summary: enrichment.userFacingCautiousSummary ?? enrichment.cautiousUserSummary,
      admin_summary: enrichment.adminSummary,
      enrichment_details: { enrichment, fallbackUsed, visionFallbackUsed },
      raw_import: raw,
      is_global_inventory: true,
      is_published: false
    };
    const property = mergeVisionIntoProperty(baseProperty, vision);
    const search_document = buildSearchDocument(property);
    const { data: inserted, error } = await supabase.from("properties").insert({ ...property, search_document }).select("*").single();
    if (error || !inserted) continue;
    await supabase.from("ticket_properties").insert({ ticket_id: params.ticketId, property_id: inserted.id, source: "admin_upload" });
    const scored = await scoreProperty(requirements, inserted);
    await supabase.from("ticket_property_candidates").insert({
      ticket_id: params.ticketId,
      property_id: inserted.id,
      source: "admin_upload",
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
    });
    imported += 1;
  }

  await supabase.from("rental_tickets").update({ status: "shortlist_uploaded" }).eq("id", params.ticketId);
  await rankAndPersistShortlist(params.ticketId, requirements);
  return NextResponse.json({ imported });
}
