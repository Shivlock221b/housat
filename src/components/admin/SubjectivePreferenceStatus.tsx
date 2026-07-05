export function SubjectivePreferenceStatus({ assessments }: { assessments?: any[] }) {
  if (!assessments?.length) return null;
  return <div className="text-sm text-muted-foreground">{assessments.map((a) => `${a.preference}: ${a.status}`).join(", ")}</div>;
}
