import { ShortlistPage } from "@/components/shortlist/ShortlistPage";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export default async function Page({ params }: { params: { publicToken: string } }) {
  const supabase = getSupabaseAdmin();
  let candidates: any[] = [];

  if (supabase) {
    const { data: ticket } = await supabase.from("rental_tickets").select("id").eq("public_token", params.publicToken).single();
    if (ticket) {
      const { data } = await supabase
        .from("ticket_property_candidates")
        .select("id,ticket_id,property_id,source,match_score,recommendation,hard_filter_status,matched_requirements,missing_information,risks,pros,cons,verification_questions,subjective_assessments,properties(id,title,description,city,locality,rent,maintenance,deposit,brokerage,bhk,furnishing,parking,available_from,photos,video_url,verification_status,spaciousness_score,sunlight_score,maintenance_condition_score,general_quality_score,vision_analysis,vision_confidence,pros,cons,missing_info)")
        .eq("ticket_id", ticket.id)
        .eq("is_published", true)
        .order("match_score", { ascending: false });
      candidates = data ?? [];
    }
  }

  return (
    <main className="container-shell py-8">
      <ShortlistPage publicToken={params.publicToken} candidates={candidates} />
    </main>
  );
}
