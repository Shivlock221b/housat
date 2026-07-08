"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function PropertyCard({ candidate }: { candidate: any }) {
  const property = Array.isArray(candidate.properties) ? candidate.properties[0] : candidate.properties;
  const photos = property?.photos ?? [];
  const [photoIndex, setPhotoIndex] = useState(0);
  const totalMonthly = Number(property?.rent ?? 0) + Number(property?.maintenance ?? 0);
  const visionSummary =
    typeof property?.vision_analysis === "object" && property.vision_analysis
      ? property.vision_analysis.visualSummary
      : null;
  const mediaAnalysis = typeof property?.media_analysis === "object" && property.media_analysis ? property.media_analysis : null;
  const mediaInsight = property?.user_facing_summary || mediaAnalysis?.userFacingCautiousSummary || visionSummary;
  const finalScore = candidate.final_score ?? candidate.match_score ?? 0;
  const rankingDetails = typeof candidate.ranking_details === "object" && candidate.ranking_details ? candidate.ranking_details : null;
  return (
    <Card className="overflow-hidden">
      <div className="grid min-h-[260px] place-items-center bg-muted">
        {photos.length ? (
          <div className="relative h-[260px] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[photoIndex]} alt={property.title ?? "Property"} className="h-[260px] w-full object-cover" />
            {photos.length > 1 ? (
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                <Button size="sm" variant="secondary" onClick={() => setPhotoIndex((value) => (value === 0 ? photos.length - 1 : value - 1))}>Previous</Button>
                <span className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium">{photoIndex + 1} / {photos.length}</span>
                <Button size="sm" variant="secondary" onClick={() => setPhotoIndex((value) => (value + 1) % photos.length)}>Next</Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="px-6 text-center text-muted-foreground">Property photos pending verification</div>
        )}
      </div>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{finalScore}/100 match</Badge>
            <Badge>{candidate.recommendation?.replaceAll("_", " ") ?? "review"}</Badge>
            {candidate.shortlist_bucket ? <Badge>{candidate.shortlist_bucket.replaceAll("_", " ")}</Badge> : null}
            <Badge>{property?.verification_status ?? "unverified"}</Badge>
          </div>
          <h2 className="text-2xl font-semibold">{property?.title ?? "Rental option"}</h2>
          <p className="text-muted-foreground">{property?.locality} · {property?.city}</p>
          <p className="text-xl font-semibold">
            {formatCurrency(property?.rent)} {property?.maintenance ? `+ ${formatCurrency(property.maintenance)} maintenance` : ""}
          </p>
          <p className="text-sm font-medium text-primary">Total monthly outflow: {totalMonthly ? formatCurrency(totalMonthly) : "Needs confirmation"}</p>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Deposit" value={property?.deposit} />
          <Detail label="Brokerage" value={property?.brokerage} />
          <Detail label="BHK" value={property?.bhk} />
          <Detail label="Furnishing" value={property?.furnishing} />
          <Detail label="Parking" value={property?.parking} />
          <Detail label="Available from" value={property?.available_from} />
        </div>

        <InfoList title="Why recommended" items={candidate.matched_requirements} />
        <InfoList title="Needs verification" items={candidate.missing_information?.length ? candidate.missing_information : candidate.verification_questions} />
        <InfoList title="Risks" items={candidate.risks} />
        <InfoList title="Pros" items={candidate.pros?.length ? candidate.pros : property?.pros} />
        <InfoList title="Cons" items={candidate.cons?.length ? candidate.cons : property?.cons} />
        {rankingDetails?.reasonForRank ? (
          <div className="rounded-md border border-border bg-muted p-3 text-sm">
            <p className="font-medium">Why this is shortlisted</p>
            <p className="mt-1 text-muted-foreground">{rankingDetails.reasonForRank}</p>
          </div>
        ) : null}
        <div className="rounded-md border border-border bg-muted p-3 text-sm">
          <p className="font-medium">Subjective fit</p>
          <p className="mt-1 text-muted-foreground">Spaciousness: {property?.spaciousness_score ? `possible (${property.spaciousness_score}/10), needs room video` : "unknown"}</p>
          <p className="text-muted-foreground">Sunlight: {property?.sunlight_score ? `possible (${property.sunlight_score}/10), needs daytime video` : "not verified"}</p>
          <p className="text-muted-foreground">Maintenance condition: {property?.maintenance_condition_score ? `possible (${property.maintenance_condition_score}/10)` : "unknown"}</p>
          {property?.general_quality_score ? <p className="text-muted-foreground">Visual quality: possible ({property.general_quality_score}/10), admin reviewed</p> : null}
          {mediaInsight ? <p className="mt-2 text-muted-foreground">Media insight: {mediaInsight}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "Not specified"}</p>
    </div>
  );
}

function InfoList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <p className="font-medium">{title}</p>
      <ul className="grid gap-1 text-sm text-muted-foreground">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}
