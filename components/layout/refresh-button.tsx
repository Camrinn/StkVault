"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const router = useRouter();

  async function handleRefresh() {
    if (state === "loading") return;
    setState("loading");
    try {
      await fetch("/api/refresh");
      router.refresh();
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      onClick={handleRefresh}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-wider transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))]"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={state === "loading" ? "animate-spin" : ""}
      >
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      </svg>
      {state === "done" ? "UPDATED" : state === "loading" ? "REFRESHING" : "REFRESH"}
    </button>
  );
}
