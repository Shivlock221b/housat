"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function AdminNotes({ ticketId, notes }: { ticketId: string; notes: any[] }) {
  async function add(formData: FormData) {
    await fetch("/api/admin/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, note: formData.get("note") })
    });
    window.location.reload();
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-white p-5">
      <h2 className="text-lg font-semibold">Admin notes</h2>
      <div className="grid gap-2">
        {notes.map((note) => (
          <div key={note.id} className="rounded-md bg-muted p-3 text-sm">
            <p>{note.note}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <form action={add} className="space-y-2">
        <Textarea name="note" placeholder="Add an internal note" required />
        <Button>Add note</Button>
      </form>
    </div>
  );
}
