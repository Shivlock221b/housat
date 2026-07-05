import { Badge } from "@/components/ui/badge";

export function ScoreBadge({ value }: { value?: number | null }) {
  const tone = (value ?? 0) >= 80 ? "border-green-200 bg-green-50 text-green-700" : (value ?? 0) >= 60 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700";
  return <Badge className={tone}>{value ?? 0}/100</Badge>;
}
