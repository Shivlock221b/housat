import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { RentalRequirementSchema } from "@/lib/agents/schemas";
import { rankAndPersistShortlist } from "@/lib/agents/shortlistRankingAgent";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: { ticketId: string } }) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: ticket } = await supabase.from("rental_tickets").select("*").eq("id", params.ticketId).single();
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const requirements = RentalRequirementSchema.parse({
    city: ticket.city ?? null,
    preferredLocalities: ticket.preferred_localities ?? [],
    budgetMin: ticket.budget_min ?? null,
    budgetMax: ticket.budget_max ?? null,
    bhk: ticket.bhk ?? null,
    propertyTypes: ticket.property_types ?? [],
    furnishing: ticket.furnishing ?? null,
    moveInDate: ticket.move_in_date ?? null,
    tenantType: ticket.tenant_type ?? null,
    brokeragePreference: ticket.brokerage_preference ?? null,
    parkingRequired: ticket.parking_required ?? null,
    petsRequired: ticket.pets_required ?? null,
    mustHaves: ticket.must_haves ?? [],
    niceToHaves: ticket.nice_to_haves ?? [],
    dealBreakers: ticket.deal_breakers ?? [],
    subjectivePreferences: Array.isArray(ticket.subjective_preferences) ? ticket.subjective_preferences : [],
    missingFields: [],
    clarifyingQuestions: ticket.clarifying_questions ?? [],
    confidence: ticket.parse_confidence ?? 0.6
  });

  const result = await rankAndPersistShortlist(params.ticketId, requirements);
  return NextResponse.json(result);
}
