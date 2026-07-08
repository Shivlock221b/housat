import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

function list(value?: unknown) {
  return Array.isArray(value) && value.length ? value.join(", ") : "Not specified";
}

function yesNo(value?: boolean | null) {
  if (value === true) return "Required";
  if (value === false) return "Not required / flexible";
  return "Not specified";
}

function SummaryItem({ label, value, wide }: { label: string; value?: string | number | null; wide?: boolean }) {
  return (
    <div className={`rounded-[16px] border border-border bg-white/60 p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "Not specified"}</p>
    </div>
  );
}

export default async function ConfirmationPage({ params }: { params: { ticketId: string } }) {
  const supabase = getSupabaseAdmin();
  const { data: ticket } = supabase
    ? await supabase.from("rental_tickets").select("*").eq("id", params.ticketId).single()
    : { data: null };

  return (
    <main className="app-background min-h-screen py-10">
      <Card className="container-shell w-full max-w-4xl bg-card/90">
        <CardHeader>
          <CardTitle>Your rental search request has been created.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!ticket ? (
            <p className="text-muted-foreground">Ticket lookup needs Supabase configuration.</p>
          ) : (
            <>
              <p className="text-muted-foreground">We&apos;ll prepare your curated shortlist and share it via WhatsApp.</p>

              <section className="space-y-3 rounded-[20px] border border-border bg-muted/20 p-4">
                <div>
                  <h2 className="brand-wordmark text-2xl text-primary">Complete search brief</h2>
                  <p className="text-sm text-muted-foreground">This is the requirement summary we will use while sourcing and verifying homes.</p>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <SummaryItem label="City" value={ticket.city} />
                  <SummaryItem label="Preferred localities" value={list(ticket.preferred_localities)} />
                  <SummaryItem label="Budget max" value={formatCurrency(ticket.budget_max)} />
                  <SummaryItem label="Home type" value={ticket.bhk} />
                  <SummaryItem label="Property type" value={list(ticket.property_types)} />
                  <SummaryItem label="Furnishing" value={ticket.furnishing} />
                  <SummaryItem label="Move-in date" value={ticket.move_in_date} />
                  <SummaryItem label="Tenant type" value={ticket.tenant_type} />
                  <SummaryItem label="Brokerage" value={ticket.brokerage_preference} />
                  <SummaryItem label="Parking" value={yesNo(ticket.parking_required)} />
                  <SummaryItem label="Pets" value={yesNo(ticket.pets_required)} />
                  <SummaryItem label="Must-haves" value={list(ticket.must_haves)} wide />
                  <SummaryItem label="Nice-to-haves / notes" value={list(ticket.nice_to_haves)} wide />
                  <SummaryItem label="Deal-breakers" value={list(ticket.deal_breakers)} wide />
                  <SummaryItem label="Visit availability" value={ticket.visit_availability} wide />
                </div>
              </section>

              <div className="grid gap-3 rounded-[20px] border border-border bg-white/70 p-4 text-sm sm:grid-cols-2">
                <span><strong>Name:</strong> {ticket.user_name || "Not specified"}</span>
                <span><strong>WhatsApp:</strong> {ticket.phone || "Not specified"}</span>
              </div>

              <div className="grid gap-2 rounded-[20px] border border-border bg-white/70 p-4 text-sm">
                <span>1. We review matching inventory across the city</span>
                <span>2. We verify availability, cost, photos, and deal-breakers</span>
                <span>3. We publish selected options to your private shortlist and share it via WhatsApp</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
