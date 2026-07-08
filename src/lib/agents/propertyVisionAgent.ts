import type { Property } from "@/lib/types";
import { analyzePropertyMedia } from "./propertyMediaAnalysisAgent";
import { PropertyVisionSchema, type PropertyMediaAnalysis, type PropertyVision } from "./schemas";

function unique(items: Array<string | null | undefined>) {
  return [...new Set(items.map((item) => item?.trim()).filter(Boolean) as string[])];
}

function fallbackVision(photos: string[]): PropertyVision {
  return PropertyVisionSchema.parse({
    visualSummary: photos.length ? "Photos are available, but image analysis is not configured." : null,
    roomTypesVisible: [],
    visiblePros: photos.length ? ["Property photos available for manual review"] : [],
    visibleCons: [],
    missingVisualEvidence: photos.length ? ["AI image analysis not configured"] : ["Property photos not available"],
    risks: [],
    spaciousnessScore: null,
    sunlightScore: null,
    maintenanceConditionScore: null,
    furnishingQualityScore: null,
    generalQualityScore: null,
    subjectiveSignals: [],
    suggestedVerificationQuestions: photos.length
      ? ["Review photos manually and ask for a daytime walkthrough video."]
      : ["Ask for property photos and a daytime walkthrough video."],
    confidence: 0
  });
}

export function hasVisionEnv() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

export async function analyzePropertyImages(input: {
  photos?: string[] | null;
  videoUrl?: string | null;
  propertyText?: string;
}): Promise<{ vision: PropertyVision; fallbackUsed: boolean }> {
  const photos = unique(input.photos ?? []).slice(0, 6);
  if (!photos.length && !input.videoUrl) {
    return { vision: fallbackVision(photos), fallbackUsed: true };
  }

  const { mediaAnalysis, fallbackUsed } = await analyzePropertyMedia({
    photos,
    videoUrl: input.videoUrl,
    description: input.propertyText
  });
  return { vision: mediaAnalysisToVision(mediaAnalysis), fallbackUsed };
}

export function mediaAnalysisToVision(mediaAnalysis: PropertyMediaAnalysis): PropertyVision {
  const vision = PropertyVisionSchema.parse({
    visualSummary: mediaAnalysis.userFacingCautiousSummary,
    roomTypesVisible: mediaAnalysis.roomsDetected,
    visiblePros: [
      ...mediaAnalysis.spaciousness.evidence,
      ...mediaAnalysis.sunlight.evidence,
      ...mediaAnalysis.maintenanceCondition.evidence,
      ...mediaAnalysis.ventilation.evidence
    ],
    visibleCons: [
      ...mediaAnalysis.spaciousness.risks,
      ...mediaAnalysis.sunlight.risks,
      ...mediaAnalysis.maintenanceCondition.risks,
      ...mediaAnalysis.ventilation.risks
    ],
    missingVisualEvidence: mediaAnalysis.missingMedia,
    risks: mediaAnalysis.redFlags,
    spaciousnessScore: mediaAnalysis.spaciousness.score,
    sunlightScore: mediaAnalysis.sunlight.score,
    maintenanceConditionScore: mediaAnalysis.maintenanceCondition.score,
    furnishingQualityScore: null,
    generalQualityScore: null,
    subjectiveSignals: [],
    suggestedVerificationQuestions: mediaAnalysis.recommendedQuestions,
    confidence: mediaAnalysis.confidence
  });
  return vision;
}

function combineScore(primary?: number | null, visual?: number | null) {
  if (primary === null || primary === undefined) return visual ?? null;
  if (visual === null || visual === undefined) return primary;
  return Math.round((primary + visual) / 2);
}

export function mergeVisionIntoProperty(property: Partial<Property>, vision: PropertyVision): Partial<Property> {
  const visionAnalysis = {
    visualSummary: vision.visualSummary,
    roomTypesVisible: vision.roomTypesVisible,
    visiblePros: vision.visiblePros,
    visibleCons: vision.visibleCons,
    missingVisualEvidence: vision.missingVisualEvidence,
    risks: vision.risks,
    subjectiveSignals: vision.subjectiveSignals,
    suggestedVerificationQuestions: vision.suggestedVerificationQuestions
  };

  return {
    ...property,
    spaciousness_score: combineScore(property.spaciousness_score, vision.spaciousnessScore),
    sunlight_score: combineScore(property.sunlight_score, vision.sunlightScore),
    maintenance_condition_score: combineScore(property.maintenance_condition_score, vision.maintenanceConditionScore),
    general_quality_score: combineScore(property.general_quality_score, vision.generalQualityScore),
    pros: unique([...(property.pros ?? []), ...vision.visiblePros]),
    cons: unique([...(property.cons ?? []), ...vision.visibleCons, ...vision.risks]),
    missing_info: unique([...(property.missing_info ?? []), ...vision.missingVisualEvidence]),
    media_analysis: property.media_analysis ?? visionAnalysis,
    user_facing_summary: property.user_facing_summary ?? vision.visualSummary,
    admin_summary: property.admin_summary ?? (vision.risks.length ? `Media risks: ${vision.risks.join(", ")}` : null),
    verified_notes: unique([property.verified_notes, vision.visualSummary ? `Vision: ${vision.visualSummary}` : null]).join("\n"),
    vision_analysis: visionAnalysis,
    vision_confidence: vision.confidence
  };
}

export function mergeVisionArrays(base: string[] = [], visionItems: string[] = []) {
  return unique([...base, ...visionItems]);
}
