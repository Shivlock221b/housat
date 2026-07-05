import type { Property } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function buildSearchDocument(property: Partial<Property>) {
  return [
    `Title: ${property.title ?? ""}.`,
    `City: ${property.city ?? ""}.`,
    `Locality: ${property.locality ?? ""}.`,
    `Rent: ${formatCurrency(property.rent)}. Maintenance: ${formatCurrency(property.maintenance)}.`,
    `BHK: ${property.bhk ?? ""}. Furnishing: ${property.furnishing ?? ""}.`,
    `Brokerage: ${property.brokerage ?? ""}. Deposit: ${property.deposit ?? ""}.`,
    `Parking: ${property.parking ?? ""}. Tenant allowed: ${property.tenant_allowed ?? ""}.`,
    `Description: ${property.description ?? ""}.`,
    `Verification notes: ${property.verified_notes ?? ""}.`,
    `Pros: ${(property.pros ?? []).join(", ")}.`,
    `Cons: ${(property.cons ?? []).join(", ")}.`,
    `Missing info: ${(property.missing_info ?? []).join(", ")}.`,
    `Visual analysis: ${typeof property.vision_analysis === "object" && property.vision_analysis ? JSON.stringify(property.vision_analysis) : ""}.`
  ].join("\n");
}
