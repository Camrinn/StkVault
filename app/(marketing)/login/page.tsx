"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pin }),
    });

    if (res.ok) {
      router.replace("/");
    } else {
      setError(true);
      setPin("");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <div className="text-4xl text-[hsl(var(--accent))] font-bold mb-2">◆</div>
          <h1 className="text-2xl font-mono font-extrabold tracking-wider">STKVAULT</h1>
          <p className="text-xs font-mono tracking-[0.16em] text-[hsl(var(--muted-foreground))] mt-1">
            DEEP RESEARCH ENGINE
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-interactive space-y-4">
          <p className="text-xs font-mono tracking-wider text-[hsl(var(--muted-foreground))] text-center">
            ENTER PIN
          </p>

          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className={`w-full text-center text-2xl tracking-[0.5em] font-mono bg-[hsl(var(--muted))]/30 border rounded-lg px-4 py-4 focus:outline-none transition-colors ${
              error
                ? "border-red-500/60 focus:border-red-500"
                : "border-[hsl(var(--border))] focus:border-[hsl(var(--accent))]/60"
            }`}
            autoFocus
          />

          {error && (
            <p className="text-xs text-red-400 text-center font-mono">INCORRECT PIN</p>
          )}

          <button
            type="submit"
            disabled={loading || pin.length === 0}
            className="w-full py-3 bg-[hsl(var(--accent))] text-white text-xs font-mono font-bold tracking-wider rounded-lg disabled:opacity-40 transition-opacity"
          >
            {loading ? "..." : "ENTER"}
          </button>
        </form>
      </div>
    </div>
  );
}
