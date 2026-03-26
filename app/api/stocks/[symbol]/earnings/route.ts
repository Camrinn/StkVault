import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { getEarningsHistory } from "@/lib/db/queries";

export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) => {
    await requireAuth();
    const { symbol } = await params;
    const data = await getEarningsHistory(symbol, 12);
    return NextResponse.json(data);
  }
);
