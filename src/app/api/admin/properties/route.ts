import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { buildSearchDocument } from "@/lib/agents/searchDocument";
import { analyzePropertyImages, mergeVisionIntoProperty } from "@/lib/agents/propertyVisionAgent";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  let property = {
    ...body,
    is_global_inventory: body.is_global_inventory ?? true
  };
  if (Array.isArray(property.photos) && property.photos.length) {
    const { vision } = await analyzePropertyImages({
      photos: property.photos,
      videoUrl: property.video_url,
      propertyText: [property.title, property.description, property.search_document].filter(Boolean).join("\n")
    });
    property = mergeVisionIntoProperty(property, vision);
  }
  const { data, error } = await supabase.from("properties").insert({
    ...property,
    search_document: buildSearchDocument(property)
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ property: data });
}
