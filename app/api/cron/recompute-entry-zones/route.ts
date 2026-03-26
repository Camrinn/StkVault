import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { getActiveSymbols, getLatestSnapshot } from "@/lib/db/queries";
import { createServiceClient } from "@/lib/db/supabase";
import { computeEntryZoneFromSnapshot } from "@/lib/entry-zones";
import { cache, CacheKeys } from "@/lib/cache";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const symbols = await getActiveSymbols();
  let updated = 0;

  for (const sym of symbols) {
    const snap = await getLatestSnapshot(sym.symbol);
    if (!snap) continue;

    const zone = computeEntryZoneFromSnapshot(snap);
    await db.from("entry_zones").insert({
      symbol: sym.symbol,
      as_of_time: new Date().toISOString(),
      ...zone,
    });
    await cache.del(CacheKeys.entryZone(sym.symbol));
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
