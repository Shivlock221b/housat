import Link from "next/link";
import { CopyShortlistLink } from "@/components/CopyShortlistLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export default async function ConfirmationPage({ params }: { params: { ticketId: string } }) {
  const supabase = getSupabaseAdmin();
  const { data: ticket } = supabase
    ? await supabase.from("rental_tickets").select("*").eq("id", params.ticketId).single()
    : { data: null };

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Your rental search request has been created.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!ticket ? (
            <p className="text-muted-foreground">Ticket lookup needs Supabase configuration.</p>
          ) : (
            <>
              <p className="text-muted-foreground">We&apos;ll prepare your curated shortlist here and keep it on this private page.</p>
              <div className="grid gap-3 rounded-md bg-muted p-4 text-sm sm:grid-cols-2">
                <span><strong>Home:</strong> {ticket.city || "City pending"} {ticket.bhk ? `· ${ticket.bhk}` : ""}</span>
                <span><strong>Budget max:</strong> {formatCurrency(ticket.budget_max)}</span>
                <span><strong>Localities:</strong> {(ticket.preferred_localities ?? []).join(", ") || "Open"}</span>
                <span><strong>Move-in:</strong> {ticket.move_in_date || "To confirm"}</span>
                <span><strong>Brokerage:</strong> {ticket.brokerage_preference || "To confirm"}</span>
                <span><strong>Visits:</strong> {ticket.visit_availability || "To confirm"}</span>
              </div>
              <div className="grid gap-2 rounded-md border border-border bg-white p-4 text-sm">
                <span>1. We review matching inventory</span>
                <span>2. We verify availability, cost, photos, and deal-breakers</span>
                <span>3. We publish selected options to your private shortlist</span>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">Private shortlist link</p>
                <p className="mt-1 break-all text-sm">/shortlist/{ticket.public_token}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground"
                  href={`/shortlist/${ticket.public_token}`}
                >
                  View shortlist
                </Link>
                <CopyShortlistLink path={`/shortlist/${ticket.public_token}`} />
              </div>
              <p className="text-xs text-muted-foreground">Details are admin-reviewed, but final availability and commercials are confirmed before any visit.</p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
