import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { buildSearchDocument } from "@/lib/agents/searchDocument";
import { analyzePropertyImages, mergeVisionIntoProperty } from "@/lib/agents/propertyVisionAgent";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: { propertyId: string } }) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  let patch = body;
  if (Array.isArray(patch.photos) && patch.photos.length) {
    const { vision } = await analyzePropertyImages({
      photos: patch.photos,
      videoUrl: patch.video_url,
      propertyText: [patch.title, patch.description, patch.search_document].filter(Boolean).join("\n")
    });
    patch = mergeVisionIntoProperty(patch, vision);
  }
  const { error } = await supabase.from("properties").update({ ...patch, search_document: buildSearchDocument(patch) }).eq("id", params.propertyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { propertyId: string } }) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { error } = await supabase.from("properties").delete().eq("id", params.propertyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
