import { MobileNav } from "@/components/layout/mobile-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20">
      <main className="max-w-2xl mx-auto">{children}</main>
      <MobileNav />
    </div>
  );
}
