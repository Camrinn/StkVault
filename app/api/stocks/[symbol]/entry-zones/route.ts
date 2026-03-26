import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { getLatestEntryZone } from "@/lib/db/queries";

export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) => {
    await requireAuth();
    const { symbol } = await params;
    const data = await getLatestEntryZone(symbol);
    if (!data) return NextResponse.json({ error: "No entry zone data" }, { status: 404 });
    return NextResponse.json(data);
  }
);
