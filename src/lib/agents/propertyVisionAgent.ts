import type { Property } from "@/lib/types";
import { PropertyVisionSchema, type PropertyVision } from "./schemas";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

function unique(items: Array<string | null | undefined>) {
  return [...new Set(items.map((item) => item?.trim()).filter(Boolean) as string[])];
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Vision response did not contain JSON.");
    return JSON.parse(match[0]);
  }
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
  return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_VISION_MODEL);
}

export async function analyzePropertyImages(input: {
  photos?: string[] | null;
  propertyText?: string;
}): Promise<{ vision: PropertyVision; fallbackUsed: boolean }> {
  const photos = unique(input.photos ?? []).slice(0, 6);
  if (!photos.length || !hasVisionEnv()) {
    return { vision: fallbackVision(photos), fallbackUsed: true };
  }

  try {
    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_VISION_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You inspect Indian rental property photos for an admin-reviewed rental concierge. Return JSON only. Be cautious: never claim verified sunlight, spaciousness, condition, safety, or premium feel from photos alone. Use likely/possible/needs_verification language. Do not identify people."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Property context:\n${input.propertyText || "No text context provided."}\n\n` +
                  "Analyze visible rental quality signals. Return keys: visualSummary, roomTypesVisible, visiblePros, visibleCons, missingVisualEvidence, risks, spaciousnessScore, sunlightScore, maintenanceConditionScore, furnishingQualityScore, generalQualityScore, subjectiveSignals, suggestedVerificationQuestions, confidence."
              },
              ...photos.map((url) => ({
                type: "image_url",
                image_url: { url }
              }))
            ]
          }
        ]
      })
    });

    if (!response.ok) throw new Error(`Groq vision failed: ${response.status}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq vision returned no content.");
    return { vision: PropertyVisionSchema.parse(parseJsonObject(content)), fallbackUsed: false };
  } catch {
    return { vision: fallbackVision(photos), fallbackUsed: true };
  }
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
    verified_notes: unique([property.verified_notes, vision.visualSummary ? `Vision: ${vision.visualSummary}` : null]).join("\n"),
    vision_analysis: visionAnalysis,
    vision_confidence: vision.confidence
  };
}

export function mergeVisionArrays(base: string[] = [], visionItems: string[] = []) {
  return unique([...base, ...visionItems]);
}
