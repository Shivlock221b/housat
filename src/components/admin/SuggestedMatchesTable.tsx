import { CandidateCard } from "./CandidateCard";

export function SuggestedMatchesTable({ candidates, ticketId }: { candidates: any[]; ticketId: string }) {
  return <div className="grid gap-3">{candidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} ticketId={ticketId} />)}</div>;
}
