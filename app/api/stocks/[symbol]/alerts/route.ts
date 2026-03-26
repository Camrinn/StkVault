import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { getActiveAlerts } from "@/lib/db/queries";

export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) => {
    await requireAuth();
    const { symbol } = await params;
    const data = await getActiveAlerts(symbol);
    return NextResponse.json(data);
  }
);
