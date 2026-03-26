import { NextRequest, NextResponse } from "next/server";
import { requireRole, withErrorHandler } from "@/lib/auth";

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireRole("admin");
  const { type = "hourly" } = await req.json();

  const cronMap: Record<string, string> = {
    hourly: "/api/cron/hourly-refresh",
    fundamentals: "/api/cron/fundamentals-refresh",
    earnings: "/api/cron/earnings-refresh",
  };

  const path = cronMap[type];
  if (!path) {
    return NextResponse.json({ error: "Invalid refresh type" }, { status: 400 });
  }

  // Call the cron endpoint internally with the secret
  const url = `${process.env.NEXT_PUBLIC_APP_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const data = await res.json();

  return NextResponse.json(data);
});
