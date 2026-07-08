"use client";

import { Copy, RefreshCw, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "./ScoreBadge";
import { formatCurrency } from "@/lib/utils";

export function CandidateCard({ candidate, ticketId }: { candidate: any; ticketId: string }) {
  const property = Array.isArray(candidate.properties) ? candidate.properties[0] : candidate.properties;
  const visionSummary =
    typeof property?.vision_analysis === "object" && property.vision_analysis
      ? property.vision_analysis.visualSummary
      : null;
  const visionPros =
    typeof property?.vision_analysis === "object" && property.vision_analysis
      ? property.vision_analysis.visiblePros
      : [];
  const visionRisks =
    typeof property?.vision_analysis === "object" && property.vision_analysis
      ? property.vision_analysis.risks
      : [];
  const mediaAnalysis = typeof property?.media_analysis === "object" && property.media_analysis ? property.media_analysis : null;
  const rankingDetails = typeof candidate.ranking_details === "object" && candidate.ranking_details ? candidate.ranking_details : null;
  const mediaRedFlags = Array.isArray(mediaAnalysis?.redFlags) ? mediaAnalysis.redFlags : [];

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/admin/candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    window.location.reload();
  }

  async function rescore() {
    await fetch(`/api/admin/properties/${property.id}/rescore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId })
    });
    window.location.reload();
  }

  async function analyzeMedia() {
    await fetch(`/api/admin/properties/${property.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: property.title,
        description: property.description,
        photos: property.photos ?? [],
        video_url: property.video_url ?? null,
        search_document: property.search_document
      })
    });
    window.location.reload();
  }

  function copyQuestions() {
    const questions = candidate.verification_questions?.length
      ? candidate.verification_questions
      : ["Is the flat still available?", "What is the final rent, maintenance, deposit, and brokerage?", "Can you share a daytime walkthrough video with lights switched off?"];
    navigator.clipboard.writeText(`Hi, I'm checking this flat for a verified tenant. Please confirm:\n\n${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{property?.title ?? "Property"}</CardTitle>
            <p className="text-sm text-muted-foreground">{property?.locality} · {property?.city} · {formatCurrency(property?.rent)}</p>
            {candidate.final_rank ? (
              <p className="mt-1 text-sm font-medium text-primary">
                Rank #{candidate.final_rank} · {candidate.shortlist_bucket?.replaceAll("_", " ") || "ranked"} · {candidate.final_score ?? candidate.match_score}/100
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <ScoreBadge value={candidate.final_score ?? candidate.match_score} />
            <Badge>{candidate.admin_status}</Badge>
            {candidate.shortlist_bucket ? <Badge className="border-primary/20 bg-primary/5 text-primary">{candidate.shortlist_bucket.replaceAll("_", " ")}</Badge> : null}
            {candidate.is_published ? <Badge className="border-green-200 bg-green-50 text-green-700">published</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <span>BHK: {property?.bhk || "-"}</span>
          <span>Furnishing: {property?.furnishing || "-"}</span>
          <span>Brokerage: {property?.brokerage || "-"}</span>
          <span>Verification: {property?.verification_status || "unverified"}</span>
          <span>Hard filter: {candidate.hard_filter_status || "unknown"}</span>
          <span>Vision confidence: {property?.vision_confidence ? `${Math.round(property.vision_confidence * 100)}%` : "-"}</span>
          <span>Spaciousness: {property?.spaciousness_score ?? "-"}/10</span>
          <span>Sunlight: {property?.sunlight_score ?? "-"}/10</span>
          <span>Maintenance: {property?.maintenance_condition_score ?? "-"}/10</span>
        </div>
        {property?.admin_summary || rankingDetails?.reasonForRank ? (
          <div className="rounded-md border border-border bg-muted p-3 text-sm">
            {property?.admin_summary ? <p><strong>Admin summary:</strong> {property.admin_summary}</p> : null}
            {property?.user_facing_summary ? <p className="mt-1"><strong>User summary:</strong> {property.user_facing_summary}</p> : null}
            {rankingDetails?.reasonForRank ? <p className="mt-1"><strong>Why ranked:</strong> {rankingDetails.reasonForRank}</p> : null}
            {rankingDetails?.adminAction ? <p className="mt-1"><strong>Admin action:</strong> {rankingDetails.adminAction}</p> : null}
          </div>
        ) : null}
        <div className="rounded-md border border-border bg-white p-3 text-sm">
          <p className="font-medium">Admin-only contact</p>
          <p className="mt-1 text-muted-foreground">
            {property?.contact_name || "Name missing"} {property?.contact_phone ? `· ${property.contact_phone}` : "· phone missing"} {property?.contact_type ? `· ${property.contact_type}` : ""}
          </p>
        </div>
        {visionSummary ? (
          <div className="rounded-md border border-border bg-muted p-3 text-sm">
            <p className="font-medium">Vision review</p>
            <p className="mt-1 text-muted-foreground">{visionSummary}</p>
            <List title="Visible positives" items={visionPros} />
            <List title="Visual risks" items={visionRisks} />
          </div>
        ) : null}
        <List title="Media red flags" items={mediaRedFlags} />
        <List title="Matched" items={candidate.matched_requirements} />
        <List title="Missing info" items={candidate.missing_information} />
        <List title="Risks" items={candidate.risks} />
        <List title="Verification questions" items={candidate.verification_questions} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => patch({ is_published: true })}><Send className="h-4 w-4" /> Publish</Button>
          <Button size="sm" variant="outline" onClick={() => patch({ is_published: false, admin_status: "approved_for_shortlist" })}>Unpublish</Button>
          <Button size="sm" variant="outline" onClick={() => patch({ admin_status: "approved_for_shortlist" })}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => patch({ admin_status: "needs_verification" })}>Needs verification</Button>
          <Button size="sm" variant="danger" onClick={() => patch({ admin_status: "rejected_by_admin", is_published: false })}><XCircle className="h-4 w-4" /> Reject</Button>
          <Button size="sm" variant="secondary" onClick={analyzeMedia}><RefreshCw className="h-4 w-4" /> Analyze media</Button>
          <Button size="sm" variant="secondary" onClick={rescore}><RefreshCw className="h-4 w-4" /> Rescore</Button>
          <Button size="sm" variant="secondary" onClick={copyQuestions}><Copy className="h-4 w-4" /> Copy questions</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="text-sm">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{items.join(", ")}</p>
    </div>
  );
}
