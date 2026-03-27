import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase";

const TIMELINE_DAYS: Record<string, number> = { "1w": 7, "2w": 14, "1m": 30 };

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in environment variables");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
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

    // Fetch active stocks
    const { data: stocks } = await db
      .from("tracked_symbols")
      .select("symbol, company_name, sector")
      .eq("is_active", true)
      .order("display_order");

    if (!stocks?.length) {
      return NextResponse.json({ error: "No stocks found" }, { status: 400 });
    }

    const symbols = stocks.map((s) => s.symbol);

    // Latest snapshots (one per symbol)
    const { data: snapshots } = await db
      .from("symbol_snapshots")
      .select("symbol, price, total_score, trend_score, earnings_score, valuation_score, setup_score, risk_score, change_1d, change_1w, change_1m, rsi, ma_20, ma_50, ma_200, drawdown_from_high, volatility_30d")
      .in("symbol", symbols)
      .order("snapshot_time", { ascending: false });

    const snapshotMap: Record<string, any> = {};
    for (const snap of snapshots ?? []) {
      if (!snapshotMap[snap.symbol]) snapshotMap[snap.symbol] = snap;
    }

    // Entry zones
    const { data: zones } = await db
      .from("entry_zones")
      .select("symbol, current_zone")
      .in("symbol", symbols)
      .order("computed_at", { ascending: false });

    const zoneMap: Record<string, string> = {};
    for (const z of zones ?? []) {
      if (!zoneMap[z.symbol]) zoneMap[z.symbol] = z.current_zone;
    }

    // Build prompt table
    const timelineLabelMap: Record<string, string> = { "1w": "1 week", "2w": "2 weeks", "1m": "1 month" };
    const timelineLabel = timelineLabelMap[timeline];

    const rows = stocks
      .map((s) => {
        const snap = snapshotMap[s.symbol];
        if (!snap) return null;
        const zone = (zoneMap[s.symbol] ?? "fair").replace("_", " ");
        const aboveMAs = [
          snap.price > snap.ma_20 ? "20MA✓" : "20MA✗",
          snap.price > snap.ma_50 ? "50MA✓" : "50MA✗",
          snap.price > snap.ma_200 ? "200MA✓" : "200MA✗",
        ].join(" ");
        return (
          `${s.symbol.padEnd(6)} | ${s.company_name.slice(0, 20).padEnd(21)} | ${s.sector.slice(0, 16).padEnd(17)}` +
          ` | ${String(Math.round(snap.total_score ?? 0)).padEnd(5)}` +
          ` | T:${String(Math.round(snap.trend_score ?? 0)).padEnd(3)} E:${String(Math.round(snap.earnings_score ?? 0)).padEnd(3)} V:${String(Math.round(snap.valuation_score ?? 0)).padEnd(3)}` +
          ` | ${zone.padEnd(10)}` +
          ` | $${Number(snap.price).toFixed(0).padEnd(6)}` +
          ` | RSI:${Number(snap.rsi ?? 50).toFixed(0).padEnd(4)}` +
          ` | 1W:${snap.change_1w >= 0 ? "+" : ""}${Number(snap.change_1w).toFixed(1)}% 1M:${snap.change_1m >= 0 ? "+" : ""}${Number(snap.change_1m).toFixed(1)}%` +
          ` | ${aboveMAs}`
        );
      })
      .filter(Boolean)
      .join("\n");

    const prompt = `You are an AI stock analyst for a personal portfolio tracker. Analyze the following stock universe and select exactly 3 or 4 stocks to hold for the next ${timelineLabel}.

SCORING SYSTEM:
- Total Score (0-100): weighted composite — Trend 30%, Earnings 20%, Valuation 15%, Industry 15%, Quality 10%, Risk 10%
- T = Trend, E = Earnings, V = Valuation sub-scores
- Zone: "buy zone" = trading below fair value (best), "fair" = fair value, "extended" = overvalued (avoid)
- RSI: 40-70 is ideal range; >75 = overbought risk; <30 = oversold/potential bounce

STOCK UNIVERSE:
SYMBOL | COMPANY              | SECTOR           | SCORE | TREND/EARN/VAL    | ZONE       | PRICE  | RSI  | MOMENTUM         | MA ALIGNMENT
${rows}

SELECTION CRITERIA (in priority order):
1. High total score (70+), especially strong trend + earnings sub-scores
2. Buy zone or fair preferred; avoid extended unless score justifies it
3. RSI in healthy range (not overbought)
4. Price above 20MA and 50MA (uptrend confirmation)
5. Sector diversification where possible
6. For ${timelineLabel} horizon: ${timeline === "1w" ? "favor momentum plays with high trend scores" : timeline === "2w" ? "balance momentum with earnings quality" : "favor quality + earnings over pure momentum"}

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "picks": [
    {
      "symbol": "XXX",
      "confidence": "high",
      "bull_points": [
        "Specific quantitative reason #1 (reference actual numbers from the data)",
        "Specific quantitative reason #2",
        "Specific catalyst or strength reason #3"
      ],
      "key_risk": "One specific risk to monitor for this pick"
    }
  ],
  "overall_thesis": "One sentence explaining how these picks work together as a portfolio"
}

Confidence levels: "high" = strong conviction across multiple factors, "medium" = good setup with some uncertainty, "low" = speculative but worth watching.`;

    const raw = await callClaude(prompt);

    // Parse JSON (strip markdown fences if present)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude did not return valid JSON");
    const parsed = JSON.parse(jsonMatch[0]);

    const picks: { symbol: string; confidence: string; bull_points: string[]; key_risk: string }[] =
      parsed.picks ?? [];
    if (!picks.length) throw new Error("Claude returned no picks");

    // Validate symbols exist in our universe
    const validPicks = picks
      .filter((p) => symbols.includes(p.symbol?.toUpperCase()))
      .slice(0, 4);
    if (!validPicks.length) throw new Error("None of Claude's picks match tracked symbols");

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

    // Insert picks
    const pickRows = validPicks.map((p) => {
      const sym = p.symbol.toUpperCase();
      const snap = snapshotMap[sym];
      return {
        session_id: session.id,
        symbol: sym,
        price_at_pick: snap?.price ?? 0,
        score_at_pick: snap?.total_score ?? 0,
        confidence: p.confidence ?? "medium",
        bull_points: p.bull_points ?? [],
        key_risk: p.key_risk ?? "",
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
