import { notFound, redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { TicketDetail } from "@/components/admin/TicketDetail";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export default async function TicketPage({ params }: { params: { ticketId: string } }) {
  if (!isAdminAuthenticated()) redirect("/admin/login");
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return <AdminLayout><p>Supabase not configured.</p></AdminLayout>;
  }
  const { data: ticket } = await supabase.from("rental_tickets").select("*").eq("id", params.ticketId).single();
  if (!ticket) notFound();
  const [{ data: candidates }, { data: actions }, { data: notes }] = await Promise.all([
    supabase
      .from("ticket_property_candidates")
      .select("*,properties(*)")
      .eq("ticket_id", params.ticketId)
      .order("match_score", { ascending: false }),
    supabase.from("property_actions").select("*,properties(title)").eq("ticket_id", params.ticketId).order("created_at", { ascending: false }),
    supabase.from("admin_notes").select("*").eq("ticket_id", params.ticketId).order("created_at", { ascending: false })
  ]);
  return (
    <AdminLayout>
      <TicketDetail ticket={ticket} candidates={candidates ?? []} actions={actions ?? []} notes={notes ?? []} />
    </AdminLayout>
  );
}
