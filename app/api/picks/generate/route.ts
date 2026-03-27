import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase";

const TIMELINE_DAYS: Record<string, number> = { "1w": 7, "2w": 14, "1m": 30 };

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const { timeline } = await req.json();
    if (!TIMELINE_DAYS[timeline]) {
      return NextResponse.json({ error: "timeline must be 1w, 2w, or 1m" }, { status: 400 });
    }

    const db = createServiceClient();

    // Fetch all active stocks with their latest snapshot
    const { data: stocks } = await db
      .from("tracked_symbols")
      .select("symbol, company_name, sector")
      .eq("is_active", true)
      .order("display_order");

    if (!stocks?.length) {
      return NextResponse.json({ error: "No stocks found" }, { status: 400 });
    }

    // Fetch latest snapshots for all symbols
    const symbols = stocks.map((s) => s.symbol);
    const { data: snapshots } = await db
      .from("symbol_snapshots")
      .select("symbol, price, total_score, trend_score, earnings_score, valuation_score, change_1d, change_1w, change_1m")
      .in("symbol", symbols)
      .order("snapshot_time", { ascending: false });

    // Keep only the latest snapshot per symbol
    const snapshotMap: Record<string, any> = {};
    for (const snap of snapshots ?? []) {
      if (!snapshotMap[snap.symbol]) snapshotMap[snap.symbol] = snap;
    }

    // Fetch entry zones
    const { data: zones } = await db
      .from("entry_zones")
      .select("symbol, current_zone")
      .in("symbol", symbols)
      .order("computed_at", { ascending: false });

    const zoneMap: Record<string, string> = {};
    for (const z of zones ?? []) {
      if (!zoneMap[z.symbol]) zoneMap[z.symbol] = z.current_zone;
    }

    // Build stock table for the prompt
    const timelineLabelMap: Record<string, string> = { "1w": "1 week", "2w": "2 weeks", "1m": "1 month" };
    const timelineLabel = timelineLabelMap[timeline];
    const rows = stocks
      .map((s) => {
        const snap = snapshotMap[s.symbol];
        if (!snap) return null;
        return [
          s.symbol.padEnd(6),
          s.company_name.slice(0, 24).padEnd(25),
          s.sector.slice(0, 18).padEnd(19),
          String(Math.round(snap.total_score ?? 0)).padEnd(6),
          (zoneMap[s.symbol] ?? "fair").padEnd(12),
          `$${Number(snap.price).toFixed(2)}`.padEnd(10),
          `${snap.change_1w >= 0 ? "+" : ""}${Number(snap.change_1w).toFixed(1)}%`.padEnd(8),
          `${snap.change_1m >= 0 ? "+" : ""}${Number(snap.change_1m).toFixed(1)}%`,
        ].join(" | ");
      })
      .filter(Boolean)
      .join("\n");

    const prompt = `You are an AI stock analyst. Based on quantitative scores from a tracking system, pick exactly 3 or 4 stocks to hold for the next ${timelineLabel}.

Scoring system (0-100, higher = better):
- Total Score: composite momentum + earnings + valuation + quality + risk
- Zone: "buy_zone" = undervalued (best entry), "fair" = fairly valued, "extended" = overvalued (avoid)

Current universe:
SYMBOL | COMPANY                   | SECTOR              | SCORE | ZONE         | PRICE      | 1W%      | 1M%
${rows}

Instructions:
- Prefer high total scores (80+)
- Prefer buy_zone or fair over extended
- Diversify across sectors when possible
- Pick exactly 3 or 4 stocks
- Keep reasoning concise (2 sentences max per pick)

Respond ONLY with valid JSON, no markdown, no explanation outside the JSON:
{
  "picks": [
    { "symbol": "XXX", "reasoning": "..." },
    { "symbol": "YYY", "reasoning": "..." },
    { "symbol": "ZZZ", "reasoning": "..." }
  ],
  "overall_thesis": "One sentence summary of why these picks work together"
}`;

    const raw = await callClaude(prompt);

    // Parse JSON from response (strip any markdown fences if present)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude did not return valid JSON");
    const parsed = JSON.parse(jsonMatch[0]);

    const picks: { symbol: string; reasoning: string }[] = parsed.picks ?? [];
    if (!picks.length) throw new Error("Claude returned no picks");

    // Validate symbols are in our universe
    const validPicks = picks.filter((p) => symbols.includes(p.symbol.toUpperCase())).slice(0, 4);
    if (!validPicks.length) throw new Error("Claude picks don't match tracked symbols");

    // Create session
    const resolveDate = new Date(Date.now() + TIMELINE_DAYS[timeline] * 86400000).toISOString();
    const { data: session, error: sessionErr } = await db
      .from("ai_pick_sessions")
      .insert({
        timeline,
        resolve_date: resolveDate,
        overall_thesis: parsed.overall_thesis ?? "",
        total_picks: validPicks.length,
      })
      .select()
      .single();

    if (sessionErr) throw sessionErr;

    // Insert individual picks
    const pickRows = validPicks.map((p) => {
      const sym = p.symbol.toUpperCase();
      const snap = snapshotMap[sym];
      return {
        session_id: session.id,
        symbol: sym,
        price_at_pick: snap?.price ?? 0,
        score_at_pick: snap?.total_score ?? 0,
        reasoning: p.reasoning,
      };
    });

    const { data: insertedPicks, error: pickErr } = await db
      .from("ai_picks")
      .insert(pickRows)
      .select();

    if (pickErr) throw pickErr;

    return NextResponse.json({ session, picks: insertedPicks });
  } catch (err: any) {
    console.error("Generate picks error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
