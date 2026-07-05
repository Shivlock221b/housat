import Link from "next/link";
import { HousatLogo } from "@/components/HousatLogo";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-background min-h-screen">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="container-shell flex h-16 items-center justify-between">
          <Link href="/admin" className="font-semibold">
            <HousatLogo size="sm" withWordmark />
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/">Intake</Link>
            <Link href="/admin">Tickets</Link>
          </nav>
        </div>
      </header>
      <div className="container-shell py-8">{children}</div>
    </main>
  );
}
