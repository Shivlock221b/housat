import { JsonOutputParser } from "@langchain/core/output_parsers";
import { splitList } from "@/lib/utils";
import { parseMoney } from "./fallbackParser";
import { getGroqModel } from "./groqClient";
import { PropertyEnrichmentSchema } from "./schemas";
import { analyzePropertyImages } from "./propertyVisionAgent";

function normalizeBhk(value: unknown) {
  const text = String(value ?? "");
  const match = text.match(/studio|[1-6]\s*bhk/i);
  return match ? match[0].toUpperCase().replace(/\s+/g, "") : text || null;
}

export async function enrichProperty(raw: Record<string, unknown>) {
  const text = Object.values(raw).join(" ");
  const normalizedPhotos = splitList(raw.photos as string);
  const fallback = PropertyEnrichmentSchema.parse({
    normalizedTitle: String(raw.title ?? raw.name ?? "Rental property").trim(),
    normalizedDescription: String(raw.description ?? "").trim() || null,
    cleanedRent: parseMoney(raw.rent),
    cleanedMaintenance: parseMoney(raw.maintenance),
    normalizedBhk: normalizeBhk(raw.bhk),
    normalizedFurnishing: String(raw.furnishing ?? "").toLowerCase() || null,
    normalizedBrokerage: String(raw.brokerage ?? "").trim() || null,
    normalizedPhotos,
    normalizedPros: splitList(raw.pros as string),
    normalizedCons: splitList(raw.cons as string),
    normalizedMissingInfo: splitList(raw.missing_info as string),
    verificationStatus: String(raw.verification_status ?? "unverified"),
    cautiousUserSummary: text ? "Based on available information, this property may fit some requirements but needs verification." : null,
    spaciousnessScore: /spacious|large|big/i.test(text) ? 7 : null,
    sunlightScore: /sunlight|bright|park.?facing|corner/i.test(text) ? 6 : null,
    maintenanceConditionScore: /new|renovated|well.?maintained/i.test(text) ? 7 : null,
    generalQualityScore: null,
    visualSummary: null,
    visionFindings: [],
    visionRisks: [],
    subjectiveNotes: {},
    suggestedVerificationQuestions: [
      "Is the flat still available?",
      "What is the final rent, maintenance, deposit, and brokerage?",
      "Can you share a daytime walkthrough video with lights switched off?",
      "What is the carpet area?"
    ],
    confidence: 0.58
  });
  const model = getGroqModel();
  const visionResult = await analyzePropertyImages({ photos: normalizedPhotos, propertyText: text });

  function mergeVision(enrichment: typeof fallback) {
    const vision = visionResult.vision;
    return PropertyEnrichmentSchema.parse({
      ...enrichment,
      normalizedPros: [...new Set([...(enrichment.normalizedPros ?? []), ...vision.visiblePros])],
      normalizedCons: [...new Set([...(enrichment.normalizedCons ?? []), ...vision.visibleCons, ...vision.risks])],
      normalizedMissingInfo: [...new Set([...(enrichment.normalizedMissingInfo ?? []), ...vision.missingVisualEvidence])],
      spaciousnessScore: enrichment.spaciousnessScore ?? vision.spaciousnessScore,
      sunlightScore: enrichment.sunlightScore ?? vision.sunlightScore,
      maintenanceConditionScore: enrichment.maintenanceConditionScore ?? vision.maintenanceConditionScore,
      generalQualityScore: vision.generalQualityScore,
      visualSummary: vision.visualSummary,
      visionFindings: vision.visiblePros,
      visionRisks: vision.risks,
      suggestedVerificationQuestions: [
        ...new Set([...(enrichment.suggestedVerificationQuestions ?? []), ...vision.suggestedVerificationQuestions])
      ],
      subjectiveNotes: {
        ...enrichment.subjectiveNotes,
        ...(vision.visualSummary ? { vision: vision.visualSummary } : {})
      },
      confidence: Math.max(enrichment.confidence, vision.confidence)
    });
  }

  if (!model) {
    return {
      enrichment: mergeVision(fallback),
      vision: visionResult.vision,
      fallbackUsed: true,
      visionFallbackUsed: visionResult.fallbackUsed
    };
  }

  try {
    const parser = new JsonOutputParser();
    const response = await model.invoke([
      ["system", "Clean messy Indian rental property rows. Be cautious about subjective claims. Return JSON only."],
      ["human", JSON.stringify(raw)]
    ]);
    const parsed = PropertyEnrichmentSchema.parse({ ...fallback, ...(await parser.parse(String(response.content))) });
    return {
      enrichment: mergeVision(parsed),
      vision: visionResult.vision,
      fallbackUsed: false,
      visionFallbackUsed: visionResult.fallbackUsed
    };
  } catch {
    return {
      enrichment: mergeVision(fallback),
      vision: visionResult.vision,
      fallbackUsed: true,
      visionFallbackUsed: visionResult.fallbackUsed
    };
  }
}
