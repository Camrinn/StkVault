import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { createServiceClient } from "@/lib/db/supabase";

export const DELETE = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) => {
    const user = await requireAuth();
    const { symbol } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("watchlists")
      .delete()
      .eq("user_id", user.id)
      .eq("symbol", symbol);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  }
);
