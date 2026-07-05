"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const requiredColumns = ["title", "city", "locality", "rent", "bhk", "brokerage"];

export function ExcelUpload({ ticketId }: { ticketId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(previewOnly: boolean) {
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("preview", String(previewOnly));
    form.append("validOnly", String(!previewOnly));
    const response = await fetch(`/api/admin/tickets/${ticketId}/upload`, { method: "POST", body: form });
    const data = await response.json();
    setLoading(false);
    if (previewOnly) setPreview(data.rows || []);
    else {
      setMessage(`Imported ${data.imported ?? 0} properties.`);
      window.location.reload();
    }
  }

  const validation = preview.map((row) => {
    const missing = requiredColumns.filter((column) => !String(row[column] ?? "").trim());
    return { row, missing, valid: missing.length === 0 };
  });
  const readyCount = validation.filter((row) => row.valid).length;
  const reviewCount = validation.length - readyCount;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Excel/CSV upload</h2>
          <p className="text-sm text-muted-foreground">Upload shortlisted properties, preview, then import and score.</p>
        </div>
        <a className="text-sm font-medium text-primary" href="/sample-property-upload-template.csv" download>Download sample template</a>
      </div>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!file || loading} onClick={() => send(true)}>Preview</Button>
        <Button disabled={!file || loading} onClick={() => send(false)}><Upload className="h-4 w-4" /> Import properties</Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {preview.length ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" /> {readyCount} rows ready
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
              <AlertCircle className="h-4 w-4" /> {reviewCount} need review
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Import skips rows missing: {requiredColumns.join(", ")}.</p>
          <div className="max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="border-b p-2 text-left">Status</th>
                  {Object.keys(preview[0]).map((key) => <th className="border-b p-2 text-left" key={key}>{key}</th>)}
                </tr>
              </thead>
              <tbody>
                {validation.map(({ row, missing, valid }, index) => (
                  <tr key={index} className={valid ? "" : "bg-amber-50/60"}>
                    <td className="border-b p-2 font-medium">{valid ? "Ready" : `Missing ${missing.join(", ")}`}</td>
                    {Object.keys(preview[0]).map((key) => <td className="border-b p-2" key={key}>{String(row[key] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
