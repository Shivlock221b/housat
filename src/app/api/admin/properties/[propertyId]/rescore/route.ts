import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { scoreProperty } from "@/lib/agents/propertyScoringAgent";
import { RentalRequirementSchema } from "@/lib/agents/schemas";
import { analyzePropertyImages, mergeVisionIntoProperty } from "@/lib/agents/propertyVisionAgent";
import { buildSearchDocument } from "@/lib/agents/searchDocument";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { propertyId: string } }) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ticketId } = await request.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: ticket } = await supabase.from("rental_tickets").select("*").eq("id", ticketId).single();
  const { data: property } = await supabase.from("properties").select("*").eq("id", params.propertyId).single();
  if (!ticket || !property) return NextResponse.json({ error: "Ticket or property not found" }, { status: 404 });
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
  let propertyForScoring = property;
  if ((property.photos?.length || property.video_url) && !property.media_analysis && !property.vision_analysis) {
    const { vision } = await analyzePropertyImages({
      photos: property.photos,
      videoUrl: property.video_url,
      propertyText: [property.title, property.description, property.search_document].filter(Boolean).join("\n")
    });
    propertyForScoring = mergeVisionIntoProperty(property, vision);
    await supabase
      .from("properties")
      .update({ ...propertyForScoring, search_document: buildSearchDocument(propertyForScoring) })
      .eq("id", params.propertyId);
  }
  const scored = await scoreProperty(requirements, propertyForScoring);
  const { error } = await supabase.from("ticket_property_candidates").upsert(
    {
      ticket_id: ticketId,
      property_id: params.propertyId,
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
      ai_score_details: scored.score
    },
    { onConflict: "ticket_id,property_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ score: scored.score });
}
