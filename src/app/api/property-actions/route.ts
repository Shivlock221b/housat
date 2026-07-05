import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const allowed = new Set(["rejected", "maybe", "interested", "ask_video", "request_visit"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!allowed.has(body.action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  const { data: ticket } = await supabase.from("rental_tickets").select("id").eq("public_token", body.publicToken).single();
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const { error } = await supabase.from("property_actions").insert({
    ticket_id: ticket.id,
    property_id: body.propertyId,
    action: body.action,
    notes: body.notes || null,
    metadata: body.metadata || {}
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
