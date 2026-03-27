import Link from "next/link";
import { MobileNav } from "@/components/layout/mobile-nav";
import { RefreshButton } from "@/components/layout/refresh-button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20">
      <header className="max-w-2xl mx-auto flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-mono font-bold tracking-widest text-[hsl(var(--accent))]">
          ◆ STKVAULT
        </span>
        <div className="flex items-center gap-1">
          <Link
            href="/guide"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))] transition-colors text-xs font-mono font-bold"
            title="Score Guide"
          >
            ?
          </Link>
          <RefreshButton />
        </div>
      </header>
      <main className="max-w-2xl mx-auto">{children}</main>
      <MobileNav />
    </div>
  );
}
