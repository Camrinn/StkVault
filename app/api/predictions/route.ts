import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase";

export async function POST(request: NextRequest) {
  const db = createServiceClient();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { player_name, symbol, direction, timeframe } = body;

  if (!player_name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!symbol)               return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  if (!["bull", "bear"].includes(direction))
    return NextResponse.json({ error: "Direction must be bull or bear" }, { status: 400 });
  if (!["1W", "1M", "3M"].includes(timeframe))
    return NextResponse.json({ error: "Timeframe must be 1W, 1M, or 3M" }, { status: 400 });

  // Verify symbol exists
  const { data: sym } = await db
    .from("tracked_symbols")
    .select("symbol")
    .eq("symbol", symbol.toUpperCase())
    .single();
  if (!sym) return NextResponse.json({ error: "Unknown symbol" }, { status: 400 });

  // Get current price from latest snapshot
  const { data: snap } = await db
    .from("symbol_snapshots")
    .select("price")
    .eq("symbol", symbol.toUpperCase())
    .order("snapshot_time", { ascending: false })
    .limit(1)
    .single();

  if (!snap?.price) return NextResponse.json({ error: "Price unavailable" }, { status: 400 });

  // Calculate target date
  const target = new Date();
  if (timeframe === "1W") target.setDate(target.getDate() + 7);
  else if (timeframe === "1M") target.setDate(target.getDate() + 30);
  else target.setDate(target.getDate() + 90);

  const { data, error } = await db
    .from("predictions")
    .insert({
      player_name: player_name.trim(),
      symbol: symbol.toUpperCase(),
      direction,
      timeframe,
      price_at_call: snap.price,
      target_date: target.toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, prediction: data });
}
