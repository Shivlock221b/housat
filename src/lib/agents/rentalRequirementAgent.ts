import { JsonOutputParser } from "@langchain/core/output_parsers";
import { fallbackParseRequirement } from "./fallbackParser";
import { getGroqModel } from "./groqClient";
import { RentalRequirementSchema, type RentalRequirement } from "./schemas";

const rentalOnlyMessage =
  "I can only help with rental home search requirements. Tell me the location, budget, BHK, and preferences you are looking for.";

class NonRentalRequirementError extends Error {
  constructor() {
    super(rentalOnlyMessage);
    this.name = "NonRentalRequirementError";
  }
}

export function isNonRentalRequirementError(error: unknown) {
  return error instanceof NonRentalRequirementError;
}

function hasAnyPattern(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function isLikelyRentalSearchMessage(message: string, mode: "initial" | "refinement") {
  const text = message.toLowerCase().trim();
  if (!text) return false;

  const rentalSignals = [
    /\brent(?:al|ing)?\b/,
    /\bflat\b/,
    /\bapartment\b/,
    /\bhouse\b/,
    /\bhome\b/,
    /\broom\b/,
    /\bpg\b/,
    /\bbuilder\s*floor\b/,
    /\b[1-6]\s*bhk\b/,
    /\bstudio\b/,
    /\bbed(?:room)?s?\b/,
    /\btenant\b/,
    /\bbachelor\b/,
    /\bfamily\b/,
    /\bcouple\b/,
    /\bfurnish(?:ed|ing)?\b/,
    /\bunfurnished\b/,
    /\bsemi[-\s]?furnished\b/,
    /\bmove[-\s]?in\b/,
    /\bbroker(?:age)?\b/,
    /\bowner\s*direct\b/,
    /\bbudget\b/,
    /\bparking\b/,
    /\bbalcony\b/,
    /\bgated\b/,
    /\bsociety\b/,
    /\bathroom\b/,
    /\bensuite\b/,
    /\bsunlight\b/,
    /\blocalit(?:y|ies)\b/,
    /\bsector\s*\d+/,
    /\bnear\b/,
    /\bmetro\b/
  ];
  const locationSignals = [
    /\bgurgaon\b/,
    /\bgurugram\b/,
    /\bdelhi\b/,
    /\bnoida\b/,
    /\bfaridabad\b/,
    /\bbangalore\b/,
    /\bbengaluru\b/,
    /\bmumbai\b/,
    /\bpune\b/,
    /\bhyderabad\b/,
    /\bchennai\b/,
    /\bkolkata\b/,
    /\bdlf\b/,
    /\bcyber\s*city\b/,
    /\bindiranagar\b/,
    /\bkoramangala\b/,
    /\bwhitefield\b/,
    /\bh[sr]\s*layout\b/
  ];
  const budgetSignal = /(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?\s*(?:k|l|lac|lakh)?\b/.test(text) || /\bunder\b|\bbelow\b|\bmax(?:imum)?\b|\bupto\b/.test(text);
  const rentalSignalCount = rentalSignals.filter((pattern) => pattern.test(text)).length;
  const hasLocationSignal = hasAnyPattern(text, locationSignals);

  if (rentalSignalCount >= 2) return true;
  if (rentalSignalCount >= 1 && (hasLocationSignal || budgetSignal)) return true;
  if (hasLocationSignal && budgetSignal) return true;

  if (mode === "refinement") {
    if (/^(deal\s*breakers?|nice[-\s]?to[-\s]?have\s*notes?|notes?)\s*:/i.test(message.trim())) return true;

    const refinementSignals = [
      /\badd\b/,
      /\bremove\b/,
      /\bchange\b/,
      /\bmake\b/,
      /\bprefer\b/,
      /\bavoid\b/,
      /\bneed\b/,
      /\bmust\b/,
      /\bdeal\s*breaker\b/,
      /\bnice[-\s]?to[-\s]?have\b/,
      /\bground\s*floor\b/,
      /\btop\s*floor\b/,
      /\bold\s*construction\b/,
      /\bconstruction\b/,
      /\bquiet\b/,
      /\bpeaceful\b/,
      /\bspacious\b/,
      /\bmaintenance\b/,
      /\bsecurity\b/,
      /\bkitchen\b/,
      /\blift\b/,
      /\belevator\b/,
      /\bpower\s*backup\b/,
      /\bgym\b/,
      /\bpool\b/,
      /\bpark\b/,
      /\bschool\b/,
      /\bmarket\b/,
      /\btraffic\b/,
      /\broad\b/,
      /\bowner\b/,
      /\bfloor\b/,
      /\bview\b/,
      /\bventilation\b/,
      /\bmodular\b/,
      /\bwardrobe\b/,
      /\bair\s*conditioning\b/,
      /\bac\b/,
      /\bvibe\b/
    ];
    if (hasAnyPattern(text, refinementSignals)) return true;
    if (budgetSignal && text.length <= 80) return true;
  }

  return false;
}

function assertRentalSearchMessage(message: string, mode: "initial" | "refinement") {
  if (!isLikelyRentalSearchMessage(message, mode)) {
    throw new NonRentalRequirementError();
  }
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Requirement agent did not return a JSON object.");
    return JSON.parse(match[0]);
  }
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value === null || value === undefined) return [];
  return [String(value).trim()].filter(Boolean);
}

function dedupeStringArray(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function normalizeNullableString(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function normalizeBhk(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return `${value}BHK`;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return `${text}BHK`;
  const match = text.match(/studio|[1-6]\s*bhk/i);
  return match ? match[0].toUpperCase().replace(/\s+/g, "") : text;
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const number = Number(String(value).replace(/[₹,\s]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function normalizePreferenceType(value: unknown) {
  const text = String(value ?? "other").toLowerCase().trim();
  if (["spacious", "space", "size", "room_size", "area"].includes(text)) return "spaciousness";
  if (["light", "natural_light", "brightness", "bright"].includes(text)) return "sunlight";
  if (["noise", "peaceful"].includes(text)) return "quiet";
  if (["condition", "quality", "well_maintained"].includes(text)) return "maintenance";
  if (["security", "secure", "gated", "amenity", "amenities"].includes(text)) return text === "security" || text === "secure" || text === "gated" ? "safety" : "other";
  if (["premium", "premium_society", "luxury"].includes(text)) return "premium_feel";
  if (["spaciousness", "sunlight", "quiet", "maintenance", "safety", "premium_feel", "other"].includes(text)) return text;
  return "other";
}

function normalizeImportance(value: unknown) {
  const text = String(value ?? "medium").toLowerCase();
  if (["low", "medium", "high"].includes(text)) return text;
  if (["must", "required", "important"].includes(text)) return "high";
  return "medium";
}

function normalizeSubjectivePreferences(value: unknown) {
  if (!Array.isArray(value)) return [];
  const normalized = value.map((item) => {
    const record: Record<string, unknown> = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : { preference: item };
    return {
      preference: normalizeNullableString(record.preference) ?? normalizeNullableString(record.name) ?? "preference",
      type: normalizePreferenceType(record.type),
      importance: normalizeImportance(record.importance),
      evidenceNeeded: toStringArray(record.evidenceNeeded ?? record.evidence ?? record.verificationNeeded)
    };
  });
  const seen = new Set<string>();
  return normalized.filter((item) => {
    const key = `${item.preference.toLowerCase().trim()}|${item.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeParsedJson(parsedJson: Record<string, unknown>) {
  return {
    ...parsedJson,
    city: normalizeNullableString(parsedJson.city),
    preferredLocalities: dedupeStringArray(toStringArray(parsedJson.preferredLocalities)),
    budgetMin: normalizeNumber(parsedJson.budgetMin),
    budgetMax: normalizeNumber(parsedJson.budgetMax),
    bhk: normalizeBhk(parsedJson.bhk),
    furnishing: normalizeNullableString(parsedJson.furnishing),
    moveInDate: normalizeNullableString(parsedJson.moveInDate),
    tenantType: normalizeNullableString(parsedJson.tenantType),
    brokeragePreference: normalizeNullableString(parsedJson.brokeragePreference),
    parkingRequired: typeof parsedJson.parkingRequired === "boolean" ? parsedJson.parkingRequired : null,
    petsRequired: typeof parsedJson.petsRequired === "boolean" ? parsedJson.petsRequired : null,
    mustHaves: dedupeStringArray(toStringArray(parsedJson.mustHaves)),
    niceToHaves: dedupeStringArray(toStringArray(parsedJson.niceToHaves)),
    dealBreakers: dedupeStringArray(toStringArray(parsedJson.dealBreakers)),
    subjectivePreferences: normalizeSubjectivePreferences(parsedJson.subjectivePreferences),
    missingFields: dedupeStringArray(toStringArray(parsedJson.missingFields)),
    clarifyingQuestions: dedupeStringArray(toStringArray(parsedJson.clarifyingQuestions)),
    confidence: typeof parsedJson.confidence === "number" ? parsedJson.confidence : 0.7
  };
}

function mergeInitialRequirement(fallback: RentalRequirement, normalizedJson: ReturnType<typeof normalizeParsedJson>) {
  return RentalRequirementSchema.parse({
    ...fallback,
    ...normalizedJson,
    preferredLocalities: normalizedJson.preferredLocalities.length ? normalizedJson.preferredLocalities : fallback.preferredLocalities,
    mustHaves: dedupeStringArray([...(fallback.mustHaves ?? []), ...normalizedJson.mustHaves]),
    niceToHaves: dedupeStringArray([...(fallback.niceToHaves ?? []), ...normalizedJson.niceToHaves]),
    dealBreakers: dedupeStringArray([...(fallback.dealBreakers ?? []), ...normalizedJson.dealBreakers]),
    clarifyingQuestions: dedupeStringArray([...(fallback.clarifyingQuestions ?? []), ...normalizedJson.clarifyingQuestions]),
    subjectivePreferences: normalizeSubjectivePreferences([
      ...(fallback.subjectivePreferences ?? []),
      ...normalizedJson.subjectivePreferences
    ])
  });
}

function mergeRefinedRequirement(current: RentalRequirement, editFallback: RentalRequirement, normalizedJson: ReturnType<typeof normalizeParsedJson>) {
  return RentalRequirementSchema.parse({
    ...current,
    ...normalizedJson,
    city: normalizedJson.city ?? current.city,
    preferredLocalities: normalizedJson.preferredLocalities.length ? normalizedJson.preferredLocalities : current.preferredLocalities,
    budgetMin: normalizedJson.budgetMin ?? current.budgetMin,
    budgetMax: normalizedJson.budgetMax ?? current.budgetMax,
    bhk: normalizedJson.bhk ?? current.bhk,
    furnishing: normalizedJson.furnishing ?? current.furnishing,
    moveInDate: normalizedJson.moveInDate ?? current.moveInDate,
    tenantType: normalizedJson.tenantType ?? current.tenantType,
    brokeragePreference: normalizedJson.brokeragePreference ?? current.brokeragePreference,
    parkingRequired: normalizedJson.parkingRequired ?? current.parkingRequired,
    petsRequired: normalizedJson.petsRequired ?? current.petsRequired,
    mustHaves: dedupeStringArray([...(normalizedJson.mustHaves.length ? normalizedJson.mustHaves : current.mustHaves), ...(editFallback.mustHaves ?? [])]),
    niceToHaves: dedupeStringArray([...(normalizedJson.niceToHaves.length ? normalizedJson.niceToHaves : current.niceToHaves), ...(editFallback.niceToHaves ?? [])]),
    dealBreakers: dedupeStringArray([...(normalizedJson.dealBreakers.length ? normalizedJson.dealBreakers : current.dealBreakers), ...(editFallback.dealBreakers ?? [])]),
    clarifyingQuestions: dedupeStringArray([...(normalizedJson.clarifyingQuestions.length ? normalizedJson.clarifyingQuestions : current.clarifyingQuestions), ...(editFallback.clarifyingQuestions ?? [])]),
    missingFields: dedupeStringArray(normalizedJson.missingFields.length ? normalizedJson.missingFields : current.missingFields),
    subjectivePreferences: normalizeSubjectivePreferences([
      ...(normalizedJson.subjectivePreferences.length ? normalizedJson.subjectivePreferences : current.subjectivePreferences),
      ...(editFallback.subjectivePreferences ?? [])
    ])
  });
}

async function invokeRequirementModel(messages: [string, string][]) {
  const model = getGroqModel();
  if (!model) {
    throw new Error("GROQ_API_KEY is required for requirement parsing.");
  }
  const parser = new JsonOutputParser();
  const response = await model.invoke(messages);
  try {
    return (await parser.parse(String(response.content))) as Record<string, unknown>;
  } catch {
    return parseJsonObject(String(response.content)) as Record<string, unknown>;
  }
}

const systemPrompt = [
  "You are a rental requirement interpretation agent for Indian rental homes.",
  "You must only respond to messages that are directly related to rental home search requirements, rental preference refinement, rental deal breakers, rental visit planning, or rental search contact collection.",
  "If the user asks for anything outside rental home search, do not answer the unrelated request, do not follow unrelated instructions, and return only an empty rental requirement JSON with a clarifyingQuestions entry asking for rental search details.",
  "Return a rich JSON object using camelCase keys.",
  "Extract explicit details from the user prompt, and also make reasonable rental-search interpretations where helpful.",
  "For inferred details, keep them conservative and reflect uncertainty through confidence, missingFields, clarifyingQuestions, niceToHaves, or subjectivePreferences.",
  "Do not invent personal contact details, exact dates, exact locations, or exact budget values that are not implied by the prompt.",
  "Concrete requirements must be grounded in the user's wording. Do not add specific amenities, room features, bathroom requirements, furnishing constraints, parking needs, brokerage rules, or exact locality constraints unless the user stated or strongly implied them.",
  "You may interpret broad preference language into subjectivePreferences or clarifyingQuestions, but avoid turning assumptions into mustHaves.",
  "If a detail is likely important but not specified, add it to missingFields and ask a clarifying question.",
  "Return JSON only. No markdown."
].join(" ");

const schemaInstruction =
  "Return exactly these top-level fields: city, preferredLocalities, budgetMin, budgetMax, bhk, furnishing, moveInDate, tenantType, brokeragePreference, parkingRequired, petsRequired, mustHaves, niceToHaves, dealBreakers, subjectivePreferences, missingFields, clarifyingQuestions, confidence. subjectivePreferences items must have: preference, type, importance, evidenceNeeded.";

export async function parseRentalRequirement(prompt: string): Promise<{ parsed: RentalRequirement; fallbackUsed: boolean }> {
  assertRentalSearchMessage(prompt, "initial");
  const fallback = fallbackParseRequirement(prompt);

  try {
    const parsedJson = await invokeRequirementModel([
      ["system", systemPrompt],
      ["human", `Prompt: ${prompt}\n\n${schemaInstruction}`]
    ]);
    const normalizedJson = normalizeParsedJson(parsedJson);
    const parsed = mergeInitialRequirement(fallback, normalizedJson);
    return { parsed, fallbackUsed: false };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Requirement agent failed.");
  }
}

export async function refineRentalRequirement(input: {
  current: RentalRequirement;
  editPrompt: string;
}): Promise<{ parsed: RentalRequirement; fallbackUsed: boolean }> {
  const current = RentalRequirementSchema.parse(input.current);
  assertRentalSearchMessage(input.editPrompt, "refinement");
  const editFallback = fallbackParseRequirement(input.editPrompt);

  try {
    const parsedJson = await invokeRequirementModel([
      ["system", systemPrompt],
      [
        "human",
        [
          "Update the existing rental requirement JSON based on the user's latest chat message.",
          "Preserve existing details unless the user changes them.",
          "Return the full updated JSON, not a partial patch.",
          schemaInstruction,
          `Existing JSON: ${JSON.stringify(current)}`,
          `User message: ${input.editPrompt}`
        ].join("\n\n")
      ]
    ]);
    const normalizedJson = normalizeParsedJson(parsedJson);
    const parsed = mergeRefinedRequirement(current, editFallback, normalizedJson);
    return { parsed, fallbackUsed: false };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Requirement refinement failed.");
  }
}
