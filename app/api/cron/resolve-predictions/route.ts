/**
 * Resolve Predictions Cron
 * Runs daily — marks expired predictions as correct/incorrect using latest snapshot prices.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: expired } = await db
    .from("predictions")
    .select("*")
    .is("resolved_at", null)
    .lte("target_date", today);

  if (!expired?.length) {
    return NextResponse.json({ ok: true, resolved: 0 });
  }

  // Batch-fetch latest prices
  const symbols = [...new Set(expired.map((p) => p.symbol))];
  const { data: snapshots } = await db
    .from("symbol_snapshots")
    .select("symbol, price")
    .in("symbol", symbols)
    .order("snapshot_time", { ascending: false });

  const priceMap: Record<string, number> = {};
  for (const s of snapshots ?? []) {
    if (!priceMap[s.symbol]) priceMap[s.symbol] = s.price;
  }

  let resolved = 0;
  for (const pred of expired) {
    const currentPrice = priceMap[pred.symbol];
    if (!currentPrice) continue;

    const returnPct = ((currentPrice - pred.price_at_call) / pred.price_at_call) * 100;
    const wasCorrect = pred.direction === "bull" ? returnPct > 0 : returnPct < 0;

    await db
      .from("predictions")
      .update({
        resolved_at: new Date().toISOString(),
        price_at_resolve: currentPrice,
        return_pct: Math.round(returnPct * 100) / 100,
        was_correct: wasCorrect,
      })
      .eq("id", pred.id);

    resolved++;
  }

  return NextResponse.json({ ok: true, resolved });
}
