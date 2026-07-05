import { Badge } from "@/components/ui/badge";

export function VerificationBadge({ value }: { value?: string | null }) {
  return <Badge>{value || "unverified"}</Badge>;
}
