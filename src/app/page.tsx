import { RequirementPromptForm } from "@/components/RequirementPromptForm";

export default function HomePage() {
  return (
    <main className="app-background min-h-screen">
      <section>
        <div className="container-shell flex min-h-screen flex-col py-4 sm:py-6">
          <RequirementPromptForm />
        </div>
      </section>
    </main>
  );
}
