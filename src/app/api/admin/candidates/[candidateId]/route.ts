import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: { candidateId: string } }) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const patch: Record<string, unknown> = {};
  if (body.admin_status) patch.admin_status = body.admin_status;
  if (typeof body.is_published === "boolean") {
    patch.is_published = body.is_published;
    if (body.is_published) patch.admin_status = "published";
  }
  const { error } = await supabase.from("ticket_property_candidates").update(patch).eq("id", params.candidateId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
