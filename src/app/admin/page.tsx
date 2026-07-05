import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { TicketTable } from "@/components/admin/TicketTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export default async function AdminPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  if (!isAdminAuthenticated()) redirect("/admin/login");
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return (
      <AdminLayout>
        <Card>
          <CardHeader><CardTitle>Supabase not configured</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">Add Supabase keys to .env.local and run the SQL migration.</CardContent>
        </Card>
      </AdminLayout>
    );
  }
  let query = supabase.from("rental_tickets").select("*").order("created_at", { ascending: false });
  if (searchParams.status) query = query.eq("status", searchParams.status);
  if (searchParams.city) query = query.ilike("city", `%${searchParams.city}%`);
  const { data: tickets } = await query;
  const enriched = await Promise.all((tickets ?? []).map(async (ticket) => {
    const [{ count: candidate_count }, { count: published_count }, { count: interested_count }, { count: visit_count }] = await Promise.all([
      supabase.from("ticket_property_candidates").select("*", { count: "exact", head: true }).eq("ticket_id", ticket.id),
      supabase.from("ticket_property_candidates").select("*", { count: "exact", head: true }).eq("ticket_id", ticket.id).eq("is_published", true),
      supabase.from("property_actions").select("*", { count: "exact", head: true }).eq("ticket_id", ticket.id).eq("action", "interested"),
      supabase.from("property_actions").select("*", { count: "exact", head: true }).eq("ticket_id", ticket.id).eq("action", "request_visit")
    ]);
    return { ...ticket, candidate_count, published_count, interested_count, visit_count };
  }));
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Tickets</h1>
          <p className="text-muted-foreground">Review new rental requests, publish shortlists, and track user actions.</p>
        </div>
        <form className="grid gap-3 rounded-lg border border-border bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
          <select name="status" defaultValue={searchParams.status ?? ""} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            <option value="">All statuses</option>
            {["new", "matching_existing_inventory", "sourcing", "shortlist_uploaded", "visits_requested", "closed", "abandoned"].map((status) => (
              <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
            ))}
          </select>
          <input name="city" defaultValue={searchParams.city ?? ""} placeholder="Filter city" className="h-10 rounded-md border border-border bg-white px-3 text-sm" />
          <button className="h-10 rounded-md border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground">Apply filters</button>
        </form>
        <TicketTable tickets={enriched} />
      </div>
    </AdminLayout>
  );
}
