import { getSupabaseAdmin } from "@/lib/supabase/server";
import { callGeminiPropertyModel } from "./geminiClient";
import { ShortlistRankingSchema, type RentalRequirement, type ShortlistRanking } from "./schemas";

type ShortlistRankingInput = {
  ticketRequirements: RentalRequirement | unknown;
  candidates: Array<{
    candidateId: string;
    propertyId: string;
    property: unknown;
    score: unknown;
    mediaAnalysis?: unknown;
  }>;
};

function fallbackRanking(input: ShortlistRankingInput): ShortlistRanking {
  const rankedCandidates = input.candidates
    .map((candidate) => {
      const score = typeof (candidate.score as { matchScore?: unknown })?.matchScore === "number"
        ? (candidate.score as { matchScore: number }).matchScore
        : typeof (candidate.score as { match_score?: unknown })?.match_score === "number"
          ? (candidate.score as { match_score: number }).match_score
          : 0;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ candidate, score }, index) => ({
      candidateId: candidate.candidateId,
      propertyId: candidate.propertyId,
      rank: index + 1,
      finalScore: Math.min(100, Math.max(0, Math.round(score))),
      shortlistBucket: score >= 82 ? "top_pick" : score >= 68 ? "strong_match" : score >= 52 ? "backup_option" : "needs_verification",
      reasonForRank: "Fallback ranking based on existing match score.",
      adminAction: "Review verification questions before publishing."
    }));

  return ShortlistRankingSchema.parse({
    rankedCandidates,
    adminSummary: "Fallback shortlist ranking used. Review candidates manually before publishing.",
    shortlistGaps: [],
    recommendedNextSourcingActions: []
  });
}

export async function rankShortlist(input: ShortlistRankingInput): Promise<{ ranking: ShortlistRanking; fallbackUsed: boolean }> {
  if (input.candidates.length < 3) {
    return { ranking: fallbackRanking(input), fallbackUsed: true };
  }

  try {
    const parsed = await callGeminiPropertyModel({
      responseSchemaName: "ShortlistRanking",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are helping evaluate rental properties for Housat AI, an Indian rental concierge product. Your job is to assess whether a property is a good fit for a specific tenant's preferences. Be evidence-based and cautious. Do not overclaim. Use photos/videos only as visual evidence, not certainty. Mark anything unverified clearly. Return valid JSON only."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Rank these scored rental candidates for admin review. Choose top picks, strong matches, backup options, needs verification, and do_not_show. Explain ranking, admin action, shortlist gaps, and next sourcing actions. Do not auto-publish.",
            ticketRequirements: input.ticketRequirements,
            candidates: input.candidates
          })
        }
      ]
    });
    return { ranking: ShortlistRankingSchema.parse(parsed), fallbackUsed: false };
  } catch {
    return { ranking: fallbackRanking(input), fallbackUsed: true };
  }
}

export async function rankAndPersistShortlist(ticketId: string, ticketRequirements: RentalRequirement | unknown) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ranked: 0, skipped: true };

  const { data } = await supabase
    .from("ticket_property_candidates")
    .select("*,properties(*)")
    .eq("ticket_id", ticketId)
    .limit(50);

  const candidates = (data ?? []).map((candidate: any) => {
    const property = Array.isArray(candidate.properties) ? candidate.properties[0] : candidate.properties;
    return {
      candidateId: candidate.id,
      propertyId: candidate.property_id,
      property,
      score: candidate.ai_score_details ?? { matchScore: candidate.match_score },
      mediaAnalysis: property?.media_analysis ?? property?.vision_analysis ?? null
    };
  });

  if (candidates.length < 3) return { ranked: 0, skipped: true };
  const { ranking, fallbackUsed } = await rankShortlist({ ticketRequirements, candidates });

  for (const item of ranking.rankedCandidates) {
    await supabase
      .from("ticket_property_candidates")
      .update({
        final_rank: item.rank,
        shortlist_bucket: item.shortlistBucket,
        final_score: Math.round(item.finalScore),
        ranking_details: {
          reasonForRank: item.reasonForRank,
          adminAction: item.adminAction,
          adminSummary: ranking.adminSummary,
          shortlistGaps: ranking.shortlistGaps,
          recommendedNextSourcingActions: ranking.recommendedNextSourcingActions,
          fallbackUsed
        }
      })
      .eq("id", item.candidateId);
  }

  return { ranked: ranking.rankedCandidates.length, fallbackUsed };
}
