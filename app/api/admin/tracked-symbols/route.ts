import { NextRequest, NextResponse } from "next/server";
import { requireRole, withErrorHandler } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";
import * as fmp from "@/lib/market-data/fmp";
import type { AddTrackedSymbolRequest } from "@/types";

export const GET = withErrorHandler(async () => {
  await requireRole("admin");
  const db = createServiceClient();

  const { data, error } = await db
    .from("tracked_symbols")
    .select("*")
    .order("display_order");

  if (error) throw error;
  return NextResponse.json(data);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireRole("admin");
  const body: AddTrackedSymbolRequest = await req.json();
  const db = createServiceClient();

  // Auto-fill from FMP if sector/industry not provided
  let sector = body.sector;
  let industry = body.industry;
  let companyName = body.company_name;

  if (!sector || !industry) {
    const profile = await fmp.getProfile(body.symbol);
    if (profile) {
      sector = sector || profile.sector;
      industry = industry || profile.industry;
      companyName = companyName || profile.companyName;
    }
  }

  // Get max display order
  const { data: maxOrder } = await db
    .from("tracked_symbols")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await db
    .from("tracked_symbols")
    .insert({
      symbol: body.symbol.toUpperCase(),
      company_name: companyName,
      sector: sector ?? "",
      industry: industry ?? "",
      primary_exchange: body.primary_exchange ?? "NASDAQ",
      display_order: (maxOrder?.display_order ?? 0) + 1,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Symbol already tracked" }, { status: 409 });
    }
    throw error;
  }

  // Add peers if provided
  if (body.peers?.length) {
    await db.from("symbol_peers").insert(
      body.peers.map((peer) => ({
        symbol: body.symbol.toUpperCase(),
        peer_symbol: peer.toUpperCase(),
      }))
    );
  }

  return NextResponse.json(data, { status: 201 });
});
