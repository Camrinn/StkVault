import { NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { getUpcomingEarnings, getActiveAlerts } from "@/lib/db/queries";

export const GET = withErrorHandler(async () => {
  await requireAuth();

  const [earnings, alerts] = await Promise.all([
    getUpcomingEarnings(),
    getActiveAlerts(),
  ]);

  return NextResponse.json({ earnings, alerts });
});
