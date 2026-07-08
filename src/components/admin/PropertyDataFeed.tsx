"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { ImagePlus, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

type Field = {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  kind?: "input" | "textarea" | "select";
  options?: string[];
};

const coreFields: Field[] = [
  { name: "title", label: "Title", placeholder: "3BHK builder floor near Sector 52" },
  { name: "city", label: "City", placeholder: "Gurgaon" },
  { name: "locality", label: "Locality", placeholder: "Sector 52" },
  { name: "rent", label: "Rent", placeholder: "65000" },
  { name: "maintenance", label: "Maintenance", placeholder: "5000" },
  { name: "deposit", label: "Deposit", placeholder: "2 months" },
  { name: "brokerage", label: "Brokerage", placeholder: "15 days / 1 month / no brokerage" },
  { name: "bhk", label: "BHK", kind: "select", options: ["", "Studio", "1BHK", "2BHK", "3BHK", "4BHK", "5BHK+"] },
  { name: "property_type", label: "Property type", kind: "select", options: ["", "Independent / Builder floors", "Individual house / Villa", "Flats / Apartments", "Duplex"] },
  { name: "furnishing", label: "Furnishing", kind: "select", options: ["", "Fully furnished", "Semi furnished", "Unfurnished", "Flexible"] },
  { name: "parking", label: "Parking", placeholder: "1 car parking / street parking" },
  { name: "available_from", label: "Available from", type: "date" },
  { name: "tenant_allowed", label: "Tenant allowed", placeholder: "Family / bachelor / couple" },
  { name: "pets_allowed", label: "Pets allowed", placeholder: "Yes / No / ask owner" }
];

const detailFields: Field[] = [
  { name: "description", label: "Description", kind: "textarea", placeholder: "Clean description you want stored for this property." },
  { name: "broker_notes", label: "Paste broker message / features", kind: "textarea", placeholder: "Paste the WhatsApp broker text, features, restrictions, commercials, society details, etc." },
  { name: "pros", label: "Known pros", kind: "textarea", placeholder: "Balcony, gated society, close to metro" },
  { name: "cons", label: "Known cons", kind: "textarea", placeholder: "No lift, older building, owner lives nearby" },
  { name: "missing_info", label: "Missing info", kind: "textarea", placeholder: "Deposit not confirmed, exact tower pending" },
  { name: "verified_notes", label: "Verification notes", kind: "textarea", placeholder: "Availability confirmed on call, rent negotiable..." },
  { name: "admin_notes", label: "Internal admin notes", kind: "textarea", placeholder: "Anything only admins should see." }
];

const extraFields: Field[] = [
  { name: "address_hint", label: "Address hint", placeholder: "Near Artemis / Golf Course Road" },
  { name: "carpet_area", label: "Carpet area", placeholder: "1800 sq ft" },
  { name: "floor", label: "Floor", placeholder: "2nd" },
  { name: "total_floors", label: "Total floors", placeholder: "4" },
  { name: "contact_name", label: "Broker/contact name", placeholder: "Rahul" },
  { name: "contact_phone", label: "Broker/contact phone", placeholder: "+91..." },
  { name: "contact_type", label: "Contact type", placeholder: "Broker / owner" },
  { name: "source_url", label: "Source URL", placeholder: "Listing URL if any" },
  { name: "verification_status", label: "Verification status", kind: "select", options: ["unverified", "partially_verified", "verified"] },
  { name: "availability_status", label: "Availability status", kind: "select", options: ["unknown", "available", "rented", "inactive", "stale"] }
];

function FieldControl({ field }: { field: Field }) {
  if (field.kind === "textarea") {
    return (
      <label className="grid gap-1 text-sm font-medium">
        {field.label}
        <Textarea name={field.name} placeholder={field.placeholder} className="min-h-[92px]" />
      </label>
    );
  }

  if (field.kind === "select") {
    return (
      <label className="grid gap-1 text-sm font-medium">
        {field.label}
        <Select name={field.name} defaultValue={field.options?.[0] ?? ""}>
          {field.options?.map((option) => (
            <option key={option || "empty"} value={option}>
              {option || "Not specified"}
            </option>
          ))}
        </Select>
      </label>
    );
  }

  return (
    <label className="grid gap-1 text-sm font-medium">
      {field.label}
      <Input name={field.name} type={field.type ?? "text"} placeholder={field.placeholder} />
    </label>
  );
}

export function PropertyDataFeed({ ticketId }: { ticketId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/tickets/${ticketId}/feed`, {
      method: "POST",
      body: form
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Could not create property.");
      return;
    }

    setMessage("Property added to inventory and scored for this ticket.");
    window.setTimeout(() => window.location.reload(), 700);
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border border-border bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold">Property data feed</h2>
        <p className="text-sm text-muted-foreground">
          Add a property directly from broker details. Text fields are stored as entered; uploaded media is analyzed to enrich visual signals.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coreFields.map((field) => <FieldControl key={field.name} field={field} />)}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {detailFields.map((field) => <FieldControl key={field.name} field={field} />)}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {extraFields.map((field) => <FieldControl key={field.name} field={field} />)}
      </section>

      <section className="grid gap-3 rounded-md border border-border bg-muted/30 p-4 lg:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Upload photos
          <Input name="photos" type="file" accept="image/*" multiple className="bg-white" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Upload videos
          <Input name="videos" type="file" accept="video/*" multiple className="bg-white" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Photo URLs
          <Textarea name="photo_urls" placeholder="Optional: paste image URLs separated by comma or new line" className="min-h-[72px] bg-white" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Video URL
          <Input name="video_url" placeholder="Optional video URL" className="bg-white" />
        </label>
        <p className="flex items-start gap-2 text-xs text-muted-foreground lg:col-span-2">
          <ImagePlus className="mt-0.5 h-4 w-4 shrink-0" />
          Uploaded files are stored in Supabase Storage and used by Gemini media analysis. Direct text fields do not go through an LLM.
        </p>
      </section>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</p> : null}

      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
        Add property and score
      </Button>
    </form>
  );
}
