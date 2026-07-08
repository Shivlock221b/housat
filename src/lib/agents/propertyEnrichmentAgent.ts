import { splitList } from "@/lib/utils";
import { parseMoney } from "./fallbackParser";
import { callGeminiPropertyModel } from "./geminiClient";
import { analyzePropertyMedia } from "./propertyMediaAnalysisAgent";
import { PropertyEnrichmentSchema, type PropertyMediaAnalysis } from "./schemas";
import { mediaAnalysisToVision } from "./propertyVisionAgent";

function normalizeBhk(value: unknown) {
  const text = String(value ?? "");
  const match = text.match(/studio|[1-6]\s*bhk/i);
  return match ? match[0].toUpperCase().replace(/\s+/g, "") : text || null;
}

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
}

function mediaPros(media?: PropertyMediaAnalysis | null) {
  if (!media) return [];
  return [
    ...media.spaciousness.evidence,
    ...media.sunlight.evidence,
    ...media.maintenanceCondition.evidence,
    ...media.ventilation.evidence
  ];
}

function mediaCons(media?: PropertyMediaAnalysis | null) {
  if (!media) return [];
  return [
    ...media.spaciousness.risks,
    ...media.sunlight.risks,
    ...media.maintenanceCondition.risks,
    ...media.ventilation.risks,
    ...media.redFlags
  ];
}

function mediaMissing(media?: PropertyMediaAnalysis | null) {
  if (!media) return [];
  return [
    ...media.missingMedia,
    ...media.spaciousness.needsVerification,
    ...media.sunlight.needsVerification,
    ...media.maintenanceCondition.needsVerification,
    ...media.ventilation.needsVerification
  ];
}

function buildFallback(raw: Record<string, unknown>, normalizedPhotos: string[], mediaAnalysis?: PropertyMediaAnalysis | null) {
  const rowText = Object.values(raw).join(" ");
  return PropertyEnrichmentSchema.parse({
    normalizedTitle: String(raw.title ?? raw.name ?? "Rental property").trim(),
    normalizedDescription: String(raw.description ?? "").trim() || null,
    cleanedRent: parseMoney(raw.rent),
    cleanedMaintenance: parseMoney(raw.maintenance),
    cleanedDeposit: text(raw.deposit),
    normalizedBhk: normalizeBhk(raw.bhk),
    normalizedFurnishing: String(raw.furnishing ?? "").toLowerCase() || null,
    normalizedBrokerage: text(raw.brokerage),
    normalizedCity: text(raw.city),
    normalizedLocality: text(raw.locality),
    normalizedParking: text(raw.parking),
    normalizedTenantAllowed: text(raw.tenant_allowed),
    normalizedPetsAllowed: text(raw.pets_allowed),
    normalizedAvailableFrom: text(raw.available_from),
    normalizedPhotos,
    normalizedPros: [...new Set([...splitList(raw.pros as string), ...mediaPros(mediaAnalysis)])],
    normalizedCons: [...new Set([...splitList(raw.cons as string), ...mediaCons(mediaAnalysis)])],
    normalizedMissingInfo: [...new Set([...splitList(raw.missing_info as string), ...mediaMissing(mediaAnalysis)])],
    verificationStatus: text(raw.verification_status) ?? "unverified",
    cautiousUserSummary:
      mediaAnalysis?.userFacingCautiousSummary ??
      (rowText ? "Based on available information, this property may fit some requirements but needs verification." : null),
    userFacingCautiousSummary: mediaAnalysis?.userFacingCautiousSummary ?? null,
    adminSummary: mediaAnalysis?.adminSummary ?? "Deterministic enrichment fallback used. Admin should verify details manually.",
    mediaAnalysis: mediaAnalysis ?? null,
    enrichmentDetails: { fallbackUsed: true },
    spaciousnessScore: mediaAnalysis?.spaciousness.score ?? (/spacious|large|big/i.test(rowText) ? 7 : null),
    sunlightScore: mediaAnalysis?.sunlight.score ?? (/sunlight|bright|park.?facing|corner/i.test(rowText) ? 6 : null),
    maintenanceConditionScore: mediaAnalysis?.maintenanceCondition.score ?? (/new|renovated|well.?maintained/i.test(rowText) ? 7 : null),
    generalQualityScore: null,
    visualSummary: mediaAnalysis?.userFacingCautiousSummary ?? null,
    visionFindings: mediaPros(mediaAnalysis),
    visionRisks: mediaCons(mediaAnalysis),
    subjectiveNotes: mediaAnalysis ? { media: mediaAnalysis.userFacingCautiousSummary } : {},
    suggestedVerificationQuestions: [
      "Is the flat still available?",
      "What is the final rent, maintenance, deposit, and brokerage?",
      "Can you share a daytime walkthrough video with lights switched off?",
      "What is the carpet area?",
      ...(mediaAnalysis?.recommendedQuestions ?? [])
    ],
    verificationQuestions: mediaAnalysis?.recommendedQuestions ?? [],
    confidence: mediaAnalysis?.confidence ? Math.max(0.58, mediaAnalysis.confidence) : 0.58
  });
}

export async function enrichProperty(
  raw: Record<string, unknown>,
  options: { ticketRequirements?: unknown; mediaAnalysis?: PropertyMediaAnalysis | null } = {}
) {
  const rowText = Object.values(raw).join(" ");
  const normalizedPhotos = splitList(raw.photos as string);
  const videoUrl = text(raw.video_url);
  const mediaResult = options.mediaAnalysis
    ? { mediaAnalysis: options.mediaAnalysis, fallbackUsed: false }
    : await analyzePropertyMedia({
        photos: normalizedPhotos,
        videoUrl,
        title: text(raw.title ?? raw.name),
        description: text(raw.description),
        adminNotes: text(raw.admin_notes),
        userRequirements: options.ticketRequirements
      });
  const fallback = buildFallback(raw, normalizedPhotos, mediaResult.mediaAnalysis);

  try {
    const parsed = await callGeminiPropertyModel({
      responseSchemaName: "PropertyEnrichment",
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
            task: "Clean and enrich this Indian rental property row. Normalize rent, maintenance, deposit, brokerage, BHK, furnishing, city, locality, parking, tenant/pet rules, and availability. Create cautious user/admin summaries, pros, cons, missing info, and verification questions.",
            raw,
            ticketRequirements: options.ticketRequirements ?? {},
            mediaAnalysis: mediaResult.mediaAnalysis,
            requiredFields:
              "normalizedTitle, normalizedDescription, cleanedRent, cleanedMaintenance, cleanedDeposit, normalizedBhk, normalizedFurnishing, normalizedBrokerage, normalizedCity, normalizedLocality, normalizedParking, normalizedTenantAllowed, normalizedPetsAllowed, normalizedAvailableFrom, normalizedPhotos, normalizedPros, normalizedCons, normalizedMissingInfo, verificationStatus, cautiousUserSummary, userFacingCautiousSummary, adminSummary, mediaAnalysis, enrichmentDetails, spaciousnessScore, sunlightScore, maintenanceConditionScore, generalQualityScore, visualSummary, visionFindings, visionRisks, subjectiveNotes, suggestedVerificationQuestions, verificationQuestions, confidence"
          })
        }
      ]
    });
    const enrichment = PropertyEnrichmentSchema.parse({
      ...fallback,
      ...(typeof parsed === "object" && parsed ? parsed : {}),
      mediaAnalysis: mediaResult.mediaAnalysis,
      normalizedPhotos,
      normalizedPros: [...new Set([...(fallback.normalizedPros ?? []), ...((parsed as any)?.normalizedPros ?? [])])],
      normalizedCons: [...new Set([...(fallback.normalizedCons ?? []), ...((parsed as any)?.normalizedCons ?? [])])],
      normalizedMissingInfo: [...new Set([...(fallback.normalizedMissingInfo ?? []), ...((parsed as any)?.normalizedMissingInfo ?? [])])],
      suggestedVerificationQuestions: [
        ...new Set([...(fallback.suggestedVerificationQuestions ?? []), ...((parsed as any)?.suggestedVerificationQuestions ?? []), ...((parsed as any)?.verificationQuestions ?? [])])
      ],
      confidence: Math.max(fallback.confidence, typeof (parsed as any)?.confidence === "number" ? (parsed as any).confidence : 0)
    });
    const vision = mediaAnalysisToVision(mediaResult.mediaAnalysis);
    return { enrichment, vision, fallbackUsed: false, visionFallbackUsed: mediaResult.fallbackUsed };
  } catch {
    const vision = mediaAnalysisToVision(mediaResult.mediaAnalysis);
    return { enrichment: fallback, vision, fallbackUsed: true, visionFallbackUsed: mediaResult.fallbackUsed };
  }
}
