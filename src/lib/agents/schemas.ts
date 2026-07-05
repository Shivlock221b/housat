import { z } from "zod";

export const RentalRequirementSchema = z.object({
  city: z.string().nullable(),
  preferredLocalities: z.array(z.string()).default([]),
  budgetMin: z.number().nullable(),
  budgetMax: z.number().nullable(),
  bhk: z.string().nullable(),
  furnishing: z.string().nullable(),
  moveInDate: z.string().nullable(),
  tenantType: z.string().nullable(),
  brokeragePreference: z.string().nullable(),
  parkingRequired: z.boolean().nullable(),
  petsRequired: z.boolean().nullable(),
  mustHaves: z.array(z.string()).default([]),
  niceToHaves: z.array(z.string()).default([]),
  dealBreakers: z.array(z.string()).default([]),
  subjectivePreferences: z
    .array(
      z.object({
        preference: z.string(),
        type: z.enum(["spaciousness", "sunlight", "quiet", "maintenance", "safety", "premium_feel", "other"]),
        importance: z.enum(["low", "medium", "high"]),
        evidenceNeeded: z.array(z.string()).default([])
      })
    )
    .default([]),
  missingFields: z.array(z.string()).default([]),
  clarifyingQuestions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1)
});

export const PropertyEnrichmentSchema = z.object({
  normalizedTitle: z.string().nullable(),
  normalizedDescription: z.string().nullable(),
  cleanedRent: z.number().nullable(),
  cleanedMaintenance: z.number().nullable(),
  normalizedBhk: z.string().nullable(),
  normalizedFurnishing: z.string().nullable(),
  normalizedBrokerage: z.string().nullable(),
  normalizedPhotos: z.array(z.string()).default([]),
  normalizedPros: z.array(z.string()).default([]),
  normalizedCons: z.array(z.string()).default([]),
  normalizedMissingInfo: z.array(z.string()).default([]),
  verificationStatus: z.string().nullable(),
  cautiousUserSummary: z.string().nullable(),
  spaciousnessScore: z.number().min(0).max(10).nullable(),
  sunlightScore: z.number().min(0).max(10).nullable(),
  maintenanceConditionScore: z.number().min(0).max(10).nullable(),
  generalQualityScore: z.number().min(0).max(10).nullable().optional(),
  visualSummary: z.string().nullable().optional(),
  visionFindings: z.array(z.string()).default([]).optional(),
  visionRisks: z.array(z.string()).default([]).optional(),
  subjectiveNotes: z.record(z.string()).default({}),
  suggestedVerificationQuestions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1)
});

export const PropertyVisionSchema = z.object({
  visualSummary: z.string().nullable(),
  roomTypesVisible: z.array(z.string()).default([]),
  visiblePros: z.array(z.string()).default([]),
  visibleCons: z.array(z.string()).default([]),
  missingVisualEvidence: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  spaciousnessScore: z.number().min(0).max(10).nullable(),
  sunlightScore: z.number().min(0).max(10).nullable(),
  maintenanceConditionScore: z.number().min(0).max(10).nullable(),
  furnishingQualityScore: z.number().min(0).max(10).nullable(),
  generalQualityScore: z.number().min(0).max(10).nullable(),
  subjectiveSignals: z
    .array(
      z.object({
        preferenceType: z.enum(["spaciousness", "sunlight", "quiet", "maintenance", "safety", "premium_feel", "other"]),
        status: z.enum(["likely_yes", "likely_no", "unknown", "needs_verification"]),
        confidence: z.number().min(0).max(1),
        evidence: z.array(z.string()).default([]),
        nextVerificationStep: z.string()
      })
    )
    .default([]),
  suggestedVerificationQuestions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1)
});

export const PropertyScoreSchema = z.object({
  matchScore: z.number().min(0).max(100),
  hardFilterStatus: z.enum(["pass", "fail", "partial", "unknown"]),
  recommendation: z.enum(["strong_match", "possible_match", "weak_match", "reject"]),
  matchedRequirements: z.array(z.string()).default([]),
  missingInformation: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  verificationQuestions: z.array(z.string()).default([]),
  subjectiveAssessments: z
    .array(
      z.object({
        preference: z.string(),
        status: z.enum(["likely_yes", "likely_no", "unknown", "needs_verification"]),
        confidence: z.number().min(0).max(1),
        evidence: z.array(z.string()).default([]),
        nextVerificationStep: z.string()
      })
    )
    .default([]),
  scoreBreakdown: z.object({
    hardFilters: z.number().min(0).max(50),
    softPreferences: z.number().min(0).max(30),
    readiness: z.number().min(0).max(20)
  })
});

export type RentalRequirement = z.infer<typeof RentalRequirementSchema>;
export type PropertyScore = z.infer<typeof PropertyScoreSchema>;
export type PropertyVision = z.infer<typeof PropertyVisionSchema>;
