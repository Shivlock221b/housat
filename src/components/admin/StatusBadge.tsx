import { Badge } from "@/components/ui/badge";

export function StatusBadge({ value }: { value?: string | null }) {
  return <Badge>{value?.replaceAll("_", " ") || "unknown"}</Badge>;
}
