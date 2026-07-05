import { RentalRequirementSchema, type RentalRequirement } from "./schemas";

const cities = ["gurgaon", "gurugram", "bengaluru", "bangalore", "pune", "mumbai", "delhi", "noida", "hyderabad", "chennai"];
const mustHaveTerms = [
  "spacious",
  "sunlight",
  "balcony",
  "gated society",
  "lift",
  "power backup",
  "pet friendly",
  "parking",
  "furnished",
  "metro nearby"
];

function extractBathroomRequirements(lower: string, bhk: string | null) {
  const requirements: string[] = [];
  if (/\battached\s+(?:bathroom|bath|toilet|washroom)s?\b/.test(lower)) {
    requirements.push("attached bathrooms");
  }
  if (/\b(?:bathroom|bath|toilet|washroom)s?\s+(?:attached|en[-\s]?suite)\b/.test(lower)) {
    requirements.push("attached bathrooms");
  }
  if (/\ben[-\s]?suite\b/.test(lower)) {
    requirements.push("attached bathrooms");
  }
  if (/\b(?:all|each|every)\s+(?:\d+\s+)?(?:room|bedroom)s?\b.*\b(?:attached|bathroom|bath|toilet|washroom)\b/.test(lower)) {
    requirements.push("attached bathroom for every bedroom");
  }
  if (/\battached\s+(?:bathroom|bath|toilet|washroom)s?\s+(?:for|in)\s+(?:all|each|every)\s+(?:\d+\s+)?(?:room|bedroom)s?\b/.test(lower)) {
    requirements.push("attached bathroom for every bedroom");
  }

  const bathroomCount = lower.match(/\b([1-6])\s*(?:bathroom|bath|toilet|washroom)s?\b/);
  if (bathroomCount) requirements.push(`${bathroomCount[1]} bathrooms`);

  const bhkCount = bhk?.match(/\d+/)?.[0];
  if (bhkCount && requirements.includes("attached bathroom for every bedroom")) {
    requirements.push(`${bhkCount} attached bathrooms`);
  }

  return [...new Set(requirements)];
}

export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).toLowerCase().replace(/[₹,\s]/g, "");
  const match = text.match(/(\d+(?:\.\d+)?)(k|l|lac|lakh)?/);
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  if (match[2] === "k") return Math.round(base * 1000);
  if (["l", "lac", "lakh"].includes(match[2] || "")) return Math.round(base * 100000);
  return Math.round(base);
}

function parseBudgetPair(minText: string, maxText: string) {
  const maxSuffix = maxText.match(/(k|l|lac|lakh)\b/i)?.[1] ?? "";
  const normalizedMin = /(?:k|l|lac|lakh)\b/i.test(minText) ? minText : `${minText}${maxSuffix}`;
  return { min: parseMoney(normalizedMin), max: parseMoney(maxText) };
}

function normalizeBhk(text: string) {
  if (/studio/i.test(text)) return "studio";
  const match = text.match(/\b([1-6])\s*bhk\b/i);
  return match ? `${match[1]}BHK` : null;
}

export function fallbackParseRequirement(prompt: string): RentalRequirement {
  const lower = prompt.toLowerCase();
  const budgetRange = lower.match(/(\d+(?:\.\d+)?\s*(?:k|l|lac|lakh)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?\s*(?:k|l|lac|lakh)?)/i);
  const maxBudget = lower.match(/(?:under|below|max|maximum|upto|up to)\s*₹?\s*(\d+(?:\.\d+)?\s*(?:k|l|lac|lakh)?)/i);
  const city = cities.find((candidate) => lower.includes(candidate));
  const localityMatches = [...prompt.matchAll(/\b(?:near|around|in)\s+([A-Za-z0-9\s-]+?)(?:\s+(?:under|below|max|for|with|by|near|in|around|good|bachelor|family|gated|parking)|[,.;]|$)/gi)]
    .map((m) => m[1].trim())
    .filter((item) => !cities.includes(item.toLowerCase()))
    .slice(0, 4);
  const furnishing = /fully[\s-]?furnished/i.test(prompt)
    ? "fully furnished"
    : /semi[\s-]?furnished/i.test(prompt)
      ? "semi-furnished"
      : /unfurnished/i.test(prompt)
        ? "unfurnished"
        : null;
  const tenantType = /(family|bachelor|couple|student|company lease)/i.exec(prompt)?.[1]?.toLowerCase() ?? null;
  const brokeragePreference = /no\s+(?:broker|brokerage)|owner direct/i.test(prompt)
    ? "no brokerage"
    : /15\s*days/i.test(prompt)
      ? "okay up to 15 days"
      : /1\s*month/i.test(prompt)
        ? "okay up to 1 month"
        : null;
  const bhk = normalizeBhk(prompt);
  const bathroomRequirements = extractBathroomRequirements(lower, bhk);
  const mustHaves = [...new Set([...mustHaveTerms.filter((term) => lower.includes(term)), ...bathroomRequirements])];
  const subjectivePreferences = [
    lower.includes("spacious") && { preference: "spacious", type: "spaciousness" as const, importance: "high" as const, evidenceNeeded: ["carpet area", "walkthrough video"] },
    lower.includes("sunlight") && { preference: "good sunlight", type: "sunlight" as const, importance: "high" as const, evidenceNeeded: ["daytime video", "window direction"] },
    lower.includes("quiet") && { preference: "quiet", type: "quiet" as const, importance: "medium" as const, evidenceNeeded: ["street noise video"] },
    lower.includes("safe") && { preference: "safe", type: "safety" as const, importance: "medium" as const, evidenceNeeded: ["society/security details"] }
  ].filter(Boolean);
  const dealBreakers = [
    /no\s+1\s*month\s+brokerage/i.test(prompt) ? "no 1 month brokerage" : null,
    /no\s+ground\s+floor/i.test(prompt) ? "no ground floor" : null,
    /no\s+top\s+floor/i.test(prompt) ? "no top floor" : null,
    /no\s+noisy\s+area/i.test(prompt) ? "no noisy area" : null
  ].filter(Boolean) as string[];

  const parsed = {
    city: city ? city.replace("gurugram", "Gurgaon").replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    preferredLocalities: localityMatches,
    budgetMin: budgetRange ? parseBudgetPair(budgetRange[1], budgetRange[2]).min : null,
    budgetMax: budgetRange ? parseBudgetPair(budgetRange[1], budgetRange[2]).max : maxBudget ? parseMoney(maxBudget[1]) : null,
    bhk,
    furnishing,
    moveInDate: /(?:move[-\s]?in|available|by)\s+([A-Za-z]+\s+\d{1,2}|\d{1,2}\/\d{1,2}\/?\d{0,4})/i.exec(prompt)?.[1] ?? null,
    tenantType,
    brokeragePreference,
    parkingRequired: /parking|car parking/i.test(prompt) ? true : null,
    petsRequired: /pet friendly|pets allowed|pet/i.test(prompt) ? true : null,
    mustHaves,
    niceToHaves: [],
    dealBreakers,
    subjectivePreferences,
    missingFields: ["name", "phone", "visit_availability"].filter(Boolean),
    clarifyingQuestions: [
      "What is your name and phone number?",
      "When are you available for visits?",
      ...(bathroomRequirements.length ? ["Should every bedroom have an attached bathroom, and is a common bathroom also acceptable?"] : [])
    ],
    confidence: 0.62
  };

  return RentalRequirementSchema.parse(parsed);
}
