import { SwipeDeck } from "./SwipeDeck";

export function ShortlistPage({ publicToken, candidates }: { publicToken: string; candidates: any[] }) {
  if (!candidates.length) {
    return (
      <div className="grid min-h-[70vh] place-items-center text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-3xl font-semibold">Your shortlist is being prepared.</h1>
          <p className="text-muted-foreground">We&apos;re reviewing matches and checking key details. Admin-approved rental options will appear here as soon as they are ready.</p>
          <div className="grid gap-2 rounded-lg border border-border bg-white p-4 text-left text-sm">
            <span>1. Request received</span>
            <span>2. Matching and verification in progress</span>
            <span className="text-muted-foreground">3. Shortlist will appear on this private page</span>
          </div>
        </div>
      </div>
    );
  }
  return <SwipeDeck publicToken={publicToken} candidates={candidates} />;
}
