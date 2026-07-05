"use client";

import { useMemo, useState } from "react";
import { CandidateCard } from "./CandidateCard";
import { ExcelUpload } from "./ExcelUpload";
import { AdminNotes } from "./AdminNotes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

export function TicketDetail({ ticket, candidates, actions, notes }: { ticket: any; candidates: any[]; actions: any[]; notes: any[] }) {
  const [tab, setTab] = useState<"summary" | "matches" | "upload" | "actions" | "notes">("summary");
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState(ticket.status ?? "new");

  const filteredCandidates = useMemo(() => {
    if (filter === "published") return candidates.filter((candidate) => candidate.is_published);
    if (filter === "needs_verification") return candidates.filter((candidate) => candidate.admin_status === "needs_verification");
    if (filter === "strong_match") return candidates.filter((candidate) => (candidate.match_score ?? 0) >= 80);
    if (filter === "uploaded") return candidates.filter((candidate) => candidate.source === "admin_upload");
    return candidates;
  }, [candidates, filter]);

  async function updateStatus() {
    await fetch(`/api/admin/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{ticket.user_name || "Unnamed request"} · {ticket.city || "City pending"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TicketTimeline status={status} />
          <p className="rounded-md bg-muted p-4 text-sm">{ticket.original_prompt}</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              {["new", "matching_existing_inventory", "sourcing", "shortlist_uploaded", "visits_requested", "closed", "abandoned"].map((item) => (
                <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
              ))}
            </Select>
            <Button onClick={updateStatus}>Update status</Button>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {[
              ["summary", "Summary"],
              ["matches", `Matches (${candidates.length})`],
              ["upload", "Upload"],
              ["actions", `User actions (${actions.length})`],
              ["notes", `Notes (${notes.length})`]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value as typeof tab)}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${tab === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white hover:bg-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {tab === "summary" ? (
        <Card>
          <CardHeader><CardTitle>Ticket summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <span>Phone: {ticket.phone}</span>
              <span>Budget max: {formatCurrency(ticket.budget_max)}</span>
              <span>BHK: {ticket.bhk || "-"}</span>
              <span>Furnishing: {ticket.furnishing || "-"}</span>
              <span>Tenant: {ticket.tenant_type || "-"}</span>
              <span>Brokerage: {ticket.brokerage_preference || "-"}</span>
              <span>Move-in: {ticket.move_in_date || "-"}</span>
              <span>Visits: {ticket.visit_availability || "-"}</span>
              <span>Localities: {(ticket.preferred_localities ?? []).join(", ") || "-"}</span>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p><strong>Must-haves:</strong> {(ticket.must_haves ?? []).join(", ") || "-"}</p>
              <p><strong>Nice-to-haves:</strong> {(ticket.nice_to_haves ?? []).join(", ") || "-"}</p>
              <p><strong>Deal-breakers:</strong> {(ticket.deal_breakers ?? []).join(", ") || "-"}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === "upload" ? <ExcelUpload ticketId={ticket.id} /> : null}

      {tab === "matches" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Suggested and uploaded properties</h2>
              <p className="text-sm text-muted-foreground">AI suggests. Admin publishes.</p>
            </div>
            <Select value={filter} onChange={(event) => setFilter(event.target.value)} className="w-auto min-w-[190px]">
              <option value="all">All candidates</option>
              <option value="strong_match">Strong matches</option>
              <option value="published">Published</option>
              <option value="needs_verification">Needs verification</option>
              <option value="uploaded">Uploaded</option>
            </Select>
          </div>
          {filteredCandidates.length ? filteredCandidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} ticketId={ticket.id} />) : (
            <p className="rounded-md border border-border bg-white p-5 text-muted-foreground">No candidates in this filter. Upload properties or add global inventory.</p>
          )}
        </section>
      ) : null}

      {tab === "actions" ? <section className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-lg font-semibold">User actions</h2>
        <div className="mt-3 grid gap-2 text-sm">
          {actions.length ? actions.map((action) => (
            <p key={action.id} className="rounded-md bg-muted p-3">{action.action} · {action.properties?.title ?? action.property_id} · {new Date(action.created_at).toLocaleString()}</p>
          )) : <p className="text-muted-foreground">No user actions yet.</p>}
        </div>
      </section> : null}

      {tab === "notes" ? <AdminNotes ticketId={ticket.id} notes={notes} /> : null}
    </div>
  );
}

function TicketTimeline({ status }: { status: string }) {
  const steps = [
    ["new", "Request created"],
    ["matching_existing_inventory", "Matching inventory"],
    ["sourcing", "Admin reviewing"],
    ["shortlist_uploaded", "Shortlist ready"],
    ["visits_requested", "Visits requested"]
  ];
  const activeIndex = Math.max(0, steps.findIndex(([value]) => value === status));

  return (
    <div className="grid gap-2 rounded-md border border-border bg-white p-3 text-xs sm:grid-cols-5">
      {steps.map(([value, label], index) => (
        <div key={value} className={`rounded-md px-2 py-2 ${index <= activeIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {label}
        </div>
      ))}
    </div>
  );
}
