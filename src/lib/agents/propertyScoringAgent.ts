import type { Property } from "@/lib/types";
import { deterministicPreScore } from "./deterministicMatching";
import { callGeminiPropertyModel } from "./geminiClient";
import { PropertyScoreSchema, type RentalRequirement } from "./schemas";

function visionEvidence(property: Partial<Property>) {
  const analysis = property.vision_analysis as
    | {
        visualSummary?: string;
        visiblePros?: string[];
        visibleCons?: string[];
        missingVisualEvidence?: string[];
        risks?: string[];
        subjectiveSignals?: Array<{
          preferenceType?: string;
          status?: "likely_yes" | "likely_no" | "unknown" | "needs_verification";
          confidence?: number;
          evidence?: string[];
          nextVerificationStep?: string;
        }>;
        suggestedVerificationQuestions?: string[];
      }
    | undefined;

  return {
    summary: analysis?.visualSummary,
    pros: analysis?.visiblePros ?? [],
    cons: analysis?.visibleCons ?? [],
    missing: analysis?.missingVisualEvidence ?? [],
    risks: analysis?.risks ?? [],
    signals: analysis?.subjectiveSignals ?? [],
    questions: analysis?.suggestedVerificationQuestions ?? []
  };
}

function textForRequirementChecks(property: Partial<Property>) {
  return [
    property.title,
    property.description,
    property.search_document,
    property.verified_notes,
    property.admin_notes,
    ...(property.pros ?? []),
    ...(property.cons ?? []),
    ...(property.missing_info ?? [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasAttachedBathroomSignal(text: string) {
  return /\b(attached|ensuite|en-suite)\s+(bathroom|bath|toilet|washroom)s?\b/.test(text) ||
    /\b(bathroom|bath|toilet|washroom)s?\s+(attached|ensuite|en-suite)\b/.test(text);
}

export async function scoreProperty(ticketRequirements: RentalRequirement, property: Partial<Property>) {
  const pre = deterministicPreScore(ticketRequirements, property);
  const vision = visionEvidence(property);
  const propertyText = textForRequirementChecks(property);
  const needsAttachedBathroomVerification =
    ticketRequirements.mustHaves.some((item) => item.toLowerCase().includes("attached bathroom")) &&
    !hasAttachedBathroomSignal(propertyText);
  const visionSoftBoost =
    (property.spaciousness_score && ticketRequirements.subjectivePreferences.some((pref) => pref.type === "spaciousness") ? 4 : 0) +
    (property.sunlight_score && ticketRequirements.subjectivePreferences.some((pref) => pref.type === "sunlight") ? 4 : 0) +
    (property.maintenance_condition_score && ticketRequirements.subjectivePreferences.some((pref) => pref.type === "maintenance") ? 3 : 0) +
    (property.general_quality_score ? 2 : 0);
  const fallbackScore = Math.min(100, pre.score + visionSoftBoost);
  const readiness =
    (property.verification_status === "verified" ? 8 : 2) +
    (property.rent && property.deposit && property.brokerage ? 5 : 2) +
    (property.photos?.length || property.video_url ? 3 : 0) +
    2;
  const fallback = PropertyScoreSchema.parse({
    matchScore: fallbackScore,
    hardFilterStatus: pre.hardFilterStatus,
    recommendation: fallbackScore >= 82 ? "strong_match" : fallbackScore >= 62 ? "possible_match" : fallbackScore >= 40 ? "weak_match" : "reject",
    matchedRequirements: vision.summary ? [...pre.reasons, `Image review: ${vision.summary}`] : pre.reasons,
    missingInformation: [
      ...new Set([
        ...(property.missing_info?.length ? property.missing_info : ["Availability and final commercials need confirmation"]),
        ...(needsAttachedBathroomVerification ? ["Attached bathroom for every bedroom needs confirmation"] : [])
      ])
    ],
    risks: [...(pre.hardFilterStatus === "fail" ? ["One or more hard filters may not match"] : []), ...vision.risks],
    pros: [...new Set([...(property.pros ?? []), ...vision.pros])],
    cons: [...new Set([...(property.cons ?? []), ...vision.cons])],
    verificationQuestions: [
      "Is the flat still available?",
      "What is the final rent, maintenance, deposit, and brokerage?",
      ...(needsAttachedBathroomVerification ? ["Does every bedroom have an attached bathroom?"] : []),
      "Can you share a daytime walkthrough video with lights switched off?",
      "Can we schedule a visit based on the tenant's availability?",
      ...vision.questions
    ],
    subjectiveAssessments: ticketRequirements.subjectivePreferences.map((pref) => ({
      preference: pref.preference,
      status: vision.signals.find((signal) => signal.preferenceType === pref.type)?.status ?? "needs_verification",
      confidence: vision.signals.find((signal) => signal.preferenceType === pref.type)?.confidence ?? 0.45,
      evidence: vision.signals.find((signal) => signal.preferenceType === pref.type)?.evidence ?? [],
      nextVerificationStep:
        vision.signals.find((signal) => signal.preferenceType === pref.type)?.nextVerificationStep ??
        `Verify ${pref.preference} with photos/video before presenting as confirmed.`
    })),
    scoreBreakdown: {
      hardFilters: Math.min(50, Math.round(pre.score * 0.5)),
      softPreferences: Math.min(30, Math.round(pre.score * 0.3) + visionSoftBoost),
      readiness: Math.min(20, readiness)
    }
  });
  try {
    const parsedJson = await callGeminiPropertyModel({
      responseSchemaName: "PropertyScore",
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
              "Score this property against the tenant requirements. Hard filters are 50 points: budget 15, BHK/property type 10, city/locality/commute 10, furnishing 5, brokerage 5, tenant eligibility 5. Soft preferences are 30 points: spaciousness 10, sunlight 10, parking/balcony/gated/quiet/safety/must-haves 10. Readiness is 20 points: verified availability 8, complete cost info 5, useful photos/video 3, visit/availability clarity 4. Respect deal-breakers; reject if a deal-breaker clearly fails. Output only the PropertyScore JSON.",
            ticketRequirements,
            property,
            deterministicPreScore: pre,
            fallbackScore: fallback,
            mediaAnalysis: property.media_analysis ?? property.vision_analysis ?? null
          })
        }
      ]
    });
    const parsed = PropertyScoreSchema.parse({ ...fallback, ...(typeof parsedJson === "object" && parsedJson ? parsedJson : {}) });
    return { score: parsed, fallbackUsed: false, deterministicScore: pre.score };
  } catch {
    return { score: fallback, fallbackUsed: true, deterministicScore: pre.score };
  }
}
