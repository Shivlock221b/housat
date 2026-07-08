import { callGeminiPropertyModel, type GeminiMessage } from "./geminiClient";
import { PropertyMediaAnalysisSchema, type PropertyMediaAnalysis } from "./schemas";

type PropertyMediaInput = {
  photos?: string[];
  videoUrl?: string | null;
  title?: string | null;
  description?: string | null;
  adminNotes?: string | null;
  userRequirements?: unknown;
};

function unique(items: Array<string | null | undefined>) {
  return [...new Set(items.map((item) => item?.trim()).filter(Boolean) as string[])];
}

function emptySignal(extra?: Partial<PropertyMediaAnalysis["spaciousness"]>) {
  return {
    score: null,
    confidence: 0,
    evidence: [],
    risks: [],
    needsVerification: [],
    ...extra
  };
}

function fallbackMediaAnalysis(input: PropertyMediaInput, note?: string): PropertyMediaAnalysis {
  const photos = unique(input.photos ?? []);
  const hasVideo = Boolean(input.videoUrl);
  const mediaAvailable = Boolean(photos.length || hasVideo);
  const missingMedia = [
    !photos.length ? "Property photos are missing." : null,
    hasVideo ? null : "Property video is missing.",
    note ?? null
  ].filter(Boolean) as string[];

  return PropertyMediaAnalysisSchema.parse({
    mediaAvailable,
    analyzedPhotosCount: 0,
    analyzedVideosCount: 0,
    roomsDetected: [],
    spaciousness: emptySignal({ needsVerification: ["Ask for carpet area and a wide room video."] }),
    sunlight: emptySignal({ needsVerification: ["Ask for a daytime walkthrough with lights switched off."] }),
    maintenanceCondition: emptySignal({ needsVerification: ["Review kitchen, bathroom, walls, ceiling corners, and fixtures."] }),
    ventilation: emptySignal({ needsVerification: ["Ask for window and balcony/opening details."] }),
    redFlags: [],
    missingMedia,
    recommendedQuestions: mediaAvailable
      ? ["Can you share a daytime walkthrough video with lights switched off?", "Can you show bathroom, kitchen, balcony, and window views?"]
      : ["Ask for property photos and a daytime walkthrough video."],
    userFacingCautiousSummary: mediaAvailable
      ? "Media is available, but automatic media analysis was not completed. Photos and videos should be reviewed manually."
      : "No property media is available yet, so visual claims need verification.",
    adminSummary: mediaAvailable
      ? "Media analysis fallback used. Admin should review photos/video manually."
      : "No media found for automatic analysis.",
    confidence: 0
  });
}

function buildMessages(input: PropertyMediaInput, includeVideo: boolean): GeminiMessage[] {
  const photos = unique(input.photos ?? []).slice(0, 8);
  const mediaParts: GeminiMessage["content"] = [
    {
      type: "text",
      text: [
        "Analyze this Indian rental property media for Housat AI.",
        `Title: ${input.title ?? "Not provided"}`,
        `Description: ${input.description ?? "Not provided"}`,
        `Admin notes: ${input.adminNotes ?? "Not provided"}`,
        `User requirements: ${JSON.stringify(input.userRequirements ?? {})}`,
        "Return JSON with exactly: mediaAvailable, analyzedPhotosCount, analyzedVideosCount, roomsDetected, spaciousness, sunlight, maintenanceCondition, ventilation, redFlags, missingMedia, recommendedQuestions, userFacingCautiousSummary, adminSummary, confidence.",
        "For each signal object return: score, confidence, evidence, risks, needsVerification.",
        "Analyze only visible evidence. Do not overclaim. Flag unclear, cropped, overexposed, dark, close-up, or potentially deceptive media. Mark uncertainty clearly."
      ].join("\n")
    },
    ...photos.map((url) => ({ type: "image_url" as const, image_url: { url } }))
  ];

  if (includeVideo && input.videoUrl) {
    mediaParts.push({ type: "video_url", video_url: { url: input.videoUrl } });
  }

  return [
    {
      role: "system",
      content:
        "You are helping evaluate rental properties for Housat AI, an Indian rental concierge product. Your job is to assess whether a property is a good fit for a specific tenant's preferences. Be evidence-based and cautious. Do not overclaim. Use photos/videos only as visual evidence, not certainty. Mark anything unverified clearly. Return valid JSON only."
    },
    { role: "user", content: mediaParts }
  ];
}

export async function analyzePropertyMedia(input: PropertyMediaInput): Promise<{ mediaAnalysis: PropertyMediaAnalysis; fallbackUsed: boolean }> {
  const photos = unique(input.photos ?? []);
  if (!photos.length && !input.videoUrl) {
    return { mediaAnalysis: fallbackMediaAnalysis(input), fallbackUsed: true };
  }

  try {
    const parsed = await callGeminiPropertyModel({
      messages: buildMessages(input, Boolean(input.videoUrl)),
      responseSchemaName: "PropertyMediaAnalysis",
      temperature: 0
    });
    return { mediaAnalysis: PropertyMediaAnalysisSchema.parse(parsed), fallbackUsed: false };
  } catch {
    if (input.videoUrl && photos.length) {
      try {
        const parsed = await callGeminiPropertyModel({
          messages: buildMessages(input, false),
          responseSchemaName: "PropertyMediaAnalysisPhotosOnly",
          temperature: 0
        });
        const mediaAnalysis = PropertyMediaAnalysisSchema.parse(parsed);
        return {
          mediaAnalysis: PropertyMediaAnalysisSchema.parse({
            ...mediaAnalysis,
            missingMedia: [...mediaAnalysis.missingMedia, "Video could not be analyzed automatically. Admin should review manually."],
            redFlags: [...mediaAnalysis.redFlags, "Video could not be analyzed automatically."]
          }),
          fallbackUsed: false
        };
      } catch {
        return {
          mediaAnalysis: fallbackMediaAnalysis(input, "Media analysis failed; admin should review photos/video manually."),
          fallbackUsed: true
        };
      }
    }

    return {
      mediaAnalysis: fallbackMediaAnalysis(input, "Media analysis failed; admin should review photos/video manually."),
      fallbackUsed: true
    };
  }
}
