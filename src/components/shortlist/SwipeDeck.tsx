"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Heart, Video, X, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyCard } from "./PropertyCard";

const actionLabels = {
  rejected: "Reject",
  maybe: "Maybe",
  interested: "Interested",
  ask_video: "Ask for video",
  request_visit: "Request visit"
};

export function SwipeDeck({ publicToken, candidates }: { publicToken: string; candidates: any[] }) {
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const current = candidates[index];

  async function act(action: keyof typeof actionLabels) {
    if (!current || saving) return;
    setSaving(true);
    const property = Array.isArray(current.properties) ? current.properties[0] : current.properties;
    await fetch("/api/property-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicToken, propertyId: property.id, action })
    });
    setSaving(false);
    setIndex((value) => value + 1);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") void act("rejected");
      if (event.key === "ArrowRight") void act("interested");
      if (event.key === "ArrowUp") void act("maybe");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) {
    return (
      <div className="grid min-h-[60vh] place-items-center rounded-lg border border-border bg-white p-8 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">You reviewed all properties.</h2>
          <p className="text-muted-foreground">We&apos;ll coordinate next steps manually.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="text-sm text-muted-foreground">{index + 1} of {candidates.length}</div>
      <div key={current.id} className="animate-in fade-in slide-in-from-bottom-2">
        <PropertyCard candidate={current} />
      </div>
      <div className="sticky bottom-0 z-10 -mx-4 grid grid-cols-2 gap-2 border-t border-border bg-background/95 p-4 backdrop-blur sm:static sm:mx-0 sm:grid-cols-5 sm:border-0 sm:bg-transparent sm:p-0">
        <Button variant="outline" onClick={() => act("rejected")} disabled={saving}><X className="h-4 w-4" /> Reject</Button>
        <Button variant="outline" onClick={() => act("maybe")} disabled={saving}><ArrowUp className="h-4 w-4" /> Maybe</Button>
        <Button className="col-span-2 sm:col-span-1" onClick={() => act("interested")} disabled={saving}><Heart className="h-4 w-4" /> Interested</Button>
        <Button variant="secondary" onClick={() => act("ask_video")} disabled={saving}><Video className="h-4 w-4" /> Video</Button>
        <Button variant="primary" onClick={() => act("request_visit")} disabled={saving}><CalendarDays className="h-4 w-4" /> Visit</Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Keyboard: left reject, right interested, up maybe.
      </p>
    </div>
  );
}
