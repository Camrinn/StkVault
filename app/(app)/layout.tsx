import { MobileNav } from "@/components/layout/mobile-nav";
import { RefreshButton } from "@/components/layout/refresh-button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20">
      <header className="max-w-2xl mx-auto flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-mono font-bold tracking-widest text-[hsl(var(--accent))]">
          ◆ STKVAULT
        </span>
        <RefreshButton />
      </header>
      <main className="max-w-2xl mx-auto">{children}</main>
      <MobileNav />
    </div>
  );
}
