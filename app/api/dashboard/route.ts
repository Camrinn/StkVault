import { NextResponse } from "next/server";
import { requireAuth, withErrorHandler } from "@/lib/auth";
import { getDashboardData } from "@/lib/db/queries";
import { cache, CacheKeys } from "@/lib/cache";

export const GET = withErrorHandler(async () => {
  await requireAuth();

  const data = await cache.getOrSet(
    CacheKeys.dashboard(),
    () => getDashboardData(),
    300 // 5 min cache
  );

  return NextResponse.json(data);
});
