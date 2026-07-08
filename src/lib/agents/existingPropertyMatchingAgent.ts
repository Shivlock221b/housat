import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Property, RentalTicket } from "@/lib/types";
import { deterministicPreScore } from "./deterministicMatching";
import { scoreProperty } from "./propertyScoringAgent";
import { analyzePropertyImages, mergeVisionIntoProperty } from "./propertyVisionAgent";
import { rankAndPersistShortlist } from "./shortlistRankingAgent";
import { buildSearchDocument } from "./searchDocument";
import { RentalRequirementSchema } from "./schemas";

export async function matchExistingProperties(ticket: RentalTicket) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { matched: 0, skipped: true };

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
    clarifyingQuestions: ticket.clarifying_questions ?? [],
    confidence: ticket.parse_confidence ?? 0.6
  });

  let query = supabase
    .from("properties")
    .select("*")
    .eq("is_global_inventory", true)
    .eq("global_status", "active")
    .not("availability_status", "in", "(rented,inactive,stale)")
    .limit(80);
  if (requirements.city) query = query.ilike("city", `%${requirements.city}%`);
  if (requirements.bhk) query = query.ilike("bhk", `%${requirements.bhk}%`);
  if (requirements.budgetMax) query = query.lte("rent", Math.round(requirements.budgetMax * 1.1));

  const { data, error } = await query;
  if (error || !data) return { matched: 0, error: error?.message };

  const top = (data as Property[])
    .map((property) => ({ property, pre: deterministicPreScore(requirements, property) }))
    .sort((a, b) => b.pre.score - a.pre.score)
    .slice(0, 30);

  for (const item of top) {
    let propertyForScoring = item.property;
    if ((propertyForScoring.photos?.length || propertyForScoring.video_url) && !propertyForScoring.media_analysis && !propertyForScoring.vision_analysis) {
      const { vision } = await analyzePropertyImages({
        photos: propertyForScoring.photos,
        videoUrl: propertyForScoring.video_url,
        propertyText: [propertyForScoring.title, propertyForScoring.description, propertyForScoring.search_document].filter(Boolean).join("\n")
      });
      propertyForScoring = mergeVisionIntoProperty(propertyForScoring, vision) as Property;
      await supabase
        .from("properties")
        .update({ ...propertyForScoring, search_document: buildSearchDocument(propertyForScoring) })
        .eq("id", propertyForScoring.id);
    }
    const scored = await scoreProperty(requirements, propertyForScoring);
    await supabase.from("ticket_property_candidates").upsert(
      {
        ticket_id: ticket.id,
        property_id: item.property.id,
        source: "existing_database",
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
  }

  await rankAndPersistShortlist(ticket.id, requirements);
  return { matched: top.length };
}
