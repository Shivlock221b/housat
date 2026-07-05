import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: { publicToken: string } }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  const { data: ticket, error: ticketError } = await supabase
    .from("rental_tickets")
    .select("id,public_token,status,created_at,user_name,city,preferred_localities,budget_min,budget_max,bhk,furnishing,move_in_date,tenant_type,brokerage_preference,must_haves,nice_to_haves,deal_breakers,shortlist_ready")
    .eq("public_token", params.publicToken)
    .single();
  if (ticketError || !ticket) return NextResponse.json({ error: "Shortlist not found" }, { status: 404 });

  const { data: candidates, error } = await supabase
    .from("ticket_property_candidates")
    .select("id,ticket_id,property_id,source,match_score,recommendation,hard_filter_status,matched_requirements,missing_information,risks,pros,cons,verification_questions,subjective_assessments,properties(id,title,description,city,locality,rent,maintenance,deposit,brokerage,bhk,furnishing,parking,available_from,photos,video_url,verification_status,spaciousness_score,sunlight_score,maintenance_condition_score,general_quality_score,vision_analysis,vision_confidence,pros,cons,missing_info)")
    .eq("ticket_id", ticket.id)
    .eq("is_published", true)
    .order("match_score", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ticket, candidates: candidates ?? [] });
}
