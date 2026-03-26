"use client";

import { useState } from "react";
import { createClient } from "@/lib/db/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-4xl text-[hsl(var(--accent))] font-bold mb-2">◆</div>
          <h1 className="text-2xl font-mono font-extrabold tracking-wider">STKVAULT</h1>
          <p className="text-xs font-mono tracking-[0.16em] text-[hsl(var(--muted-foreground))] mt-1">
            DEEP RESEARCH ENGINE
          </p>
        </div>

        {sent ? (
          <div className="card-interactive text-center py-8">
            <div className="text-2xl mb-3">📧</div>
            <p className="text-sm font-medium mb-1">Check your email</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              We sent a magic link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <div className="card-interactive">
            <h2 className="text-sm font-mono font-bold tracking-wider mb-4">SIGN IN</h2>

            {error && (
              <div className="mb-4 p-3 bg-bearish/10 border border-bearish/30 rounded-lg text-sm text-bearish">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[hsl(var(--accent))]/40"
                autoFocus
              />
              <button
                onClick={handleLogin}
                disabled={loading || !email}
                className="w-full py-3 bg-[hsl(var(--accent))] text-white text-xs font-mono font-bold tracking-wider rounded-lg disabled:opacity-40 transition-opacity"
              >
                {loading ? "SENDING..." : "SEND MAGIC LINK"}
              </button>
            </div>

            <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center mt-4">
              No password needed. We&apos;ll email you a login link.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
