import type { Property } from "@/lib/types";
import type { RentalRequirement } from "./schemas";

function includes(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.toLowerCase().includes(b.toLowerCase()));
}

function propertyTypeMatches(propertyType: string | null | undefined, requiredType: string) {
  if (!propertyType) return false;
  const property = propertyType.toLowerCase();
  const required = requiredType.toLowerCase();
  if (required.includes("builder") || required.includes("independent")) return /builder|independent\s+floor/.test(property);
  if (required.includes("villa") || required.includes("individual")) return /villa|individual\s+house|independent\s+house/.test(property);
  if (required.includes("flat") || required.includes("apartment")) return /flat|apartment/.test(property);
  if (required.includes("duplex")) return /duplex/.test(property);
  return property.includes(required);
}

function propertyText(property: Partial<Property>) {
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

function mustHaveMatches(mustHave: string, text: string) {
  const normalized = mustHave.toLowerCase();
  if (normalized.includes("attached bathroom")) {
    return /\b(attached|ensuite|en-suite)\s+(bathroom|bath|toilet|washroom)s?\b/.test(text) ||
      /\b(bathroom|bath|toilet|washroom)s?\s+(attached|ensuite|en-suite)\b/.test(text);
  }
  if (normalized.includes("gated society")) return /gated|security|society/.test(text);
  if (normalized.includes("sunlight")) return /sunlight|bright|natural light|well lit|well-lit/.test(text);
  return text.includes(normalized);
}

export function deterministicPreScore(ticket: RentalRequirement, property: Partial<Property>) {
  let score = 0;
  const reasons: string[] = [];
  let hardFilterStatus: "pass" | "fail" | "partial" | "unknown" = "unknown";

  if (ticket.budgetMax && property.rent) {
    if (property.rent <= ticket.budgetMax) {
      score += 20;
      reasons.push("Within budget");
    } else if (property.rent <= ticket.budgetMax * 1.1) {
      score += 10;
      reasons.push("Slightly above budget");
    } else {
      reasons.push("Above budget");
      hardFilterStatus = "fail";
    }
  }

  if (ticket.bhk && property.bhk && includes(property.bhk, ticket.bhk)) {
    score += 15;
    reasons.push("BHK matches");
  }

  if (ticket.propertyTypes.length && ticket.propertyTypes.some((type) => propertyTypeMatches(property.property_type, type))) {
    score += 8;
    reasons.push("Property type matches");
  }

  if (ticket.city && property.city && includes(property.city, ticket.city)) {
    score += 10;
    reasons.push("City matches");
  }
  if (ticket.preferredLocalities.some((loc) => includes(property.locality, loc) || includes(property.search_document, loc))) {
    score += 10;
    reasons.push("Preferred locality signal");
  }

  if (ticket.furnishing && property.furnishing && includes(property.furnishing, ticket.furnishing)) {
    score += 10;
    reasons.push("Furnishing matches");
  }
  if (ticket.brokeragePreference?.includes("no") && /no|owner/i.test(property.brokerage ?? "")) {
    score += 10;
    reasons.push("Brokerage preference matches");
  } else if (!ticket.brokeragePreference || !property.brokerage) {
    score += 4;
  }
  if (!ticket.parkingRequired || /parking|available|yes/i.test(property.parking ?? "")) {
    score += 10;
    if (ticket.parkingRequired) reasons.push("Parking likely available");
  }
  const text = propertyText(property);
  const concreteMustHaves = ticket.mustHaves.filter((item) => !["spacious", "sunlight"].includes(item.toLowerCase()));
  const matchedMustHaves = concreteMustHaves.filter((item) => mustHaveMatches(item, text));
  if (concreteMustHaves.length) {
    const mustHaveScore = Math.round((matchedMustHaves.length / concreteMustHaves.length) * 10);
    score += mustHaveScore;
    matchedMustHaves.forEach((item) => reasons.push(`Must-have signal: ${item}`));
    if (mustHaveScore === 0 && concreteMustHaves.some((item) => item.toLowerCase().includes("attached bathroom"))) {
      reasons.push("Attached bathroom requirement needs verification");
    }
  }
  if (property.verification_status === "verified") {
    score += 15;
    reasons.push("Verified property");
  } else if (property.photos?.length || property.video_url) {
    score += 8;
    reasons.push("Has media for review");
  }

  if (hardFilterStatus !== "fail") {
    hardFilterStatus = score >= 70 ? "pass" : score >= 35 ? "partial" : "unknown";
  }

  return { score: Math.min(score, 100), reasons, hardFilterStatus };
}
