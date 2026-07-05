export function UploadPreviewTable({ rows }: { rows: any[] }) {
  if (!rows.length) return null;
  return <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(rows, null, 2)}</pre>;
}
