import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { matchExistingProperties } from "@/lib/agents/existingPropertyMatchingAgent";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { publicShortlistPath } from "@/lib/utils";

function token() {
  return randomBytes(18).toString("base64url");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server env vars are not configured." }, { status: 503 });
  }

  const publicToken = token();
  const payload = {
    public_token: publicToken,
    status: "matching_existing_inventory",
    original_prompt: body.originalPrompt || body.original_prompt || "",
    user_name: body.userName || body.user_name || null,
    phone: body.phone,
    email: body.email || null,
    city: body.city || null,
    preferred_localities: body.preferredLocalities || [],
    budget_min: body.budgetMin || null,
    budget_max: body.budgetMax || null,
    bhk: body.bhk || null,
    property_types: body.propertyTypes || body.property_types || [],
    furnishing: body.furnishing || null,
    move_in_date: body.moveInDate || null,
    tenant_type: body.tenantType || null,
    brokerage_preference: body.brokeragePreference || null,
    visit_availability: body.visitAvailability || null,
    parking_required: body.parkingRequired ?? null,
    pets_required: body.petsRequired ?? null,
    must_haves: body.mustHaves || [],
    nice_to_haves: body.niceToHaves || [],
    deal_breakers: body.dealBreakers || [],
    notes: body.notes || null,
    parsed_requirements: body.parsedRequirements || null,
    clarifying_questions: body.clarifyingQuestions || [],
    subjective_preferences: body.subjectivePreferences || [],
    parse_confidence: body.parseConfidence || null
  };

  const { data, error } = await supabase.from("rental_tickets").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await matchExistingProperties(data);
    await supabase.from("rental_tickets").update({ status: "sourcing" }).eq("id", data.id);
  } catch {
    await supabase.from("rental_tickets").update({ status: "sourcing" }).eq("id", data.id);
  }

  return NextResponse.json({
    ticketId: data.id,
    publicToken,
    shortlistUrl: publicShortlistPath(publicToken)
  });
}
