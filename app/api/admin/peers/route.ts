import { NextRequest, NextResponse } from "next/server";
import { requireRole, withErrorHandler } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireRole("admin");
  const { symbol, peers } = await req.json();
  const db = createServiceClient();

  // Clear existing peers
  await db.from("symbol_peers").delete().eq("symbol", symbol);

  // Insert new peers
  if (peers?.length) {
    await db.from("symbol_peers").insert(
      peers.map((peer: string) => ({
        symbol: symbol.toUpperCase(),
        peer_symbol: peer.toUpperCase(),
      }))
    );
  }

  return NextResponse.json({ ok: true });
});
