/**
 * Cache layer using Upstash Redis.
 *
 * Usage:
 *   const price = await cache.getOrSet("price:AAPL", () => fetchPrice("AAPL"), 300);
 */

const REDIS_URL = process.env.UPSTASH_REDIS_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_ENABLED = !!(REDIS_URL && REDIS_TOKEN);

async function redisCommand(command: string, ...args: string[]): Promise<any> {
  if (!REDIS_ENABLED) return null;
  const res = await fetch(REDIS_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command, ...args]),
  });
  const data = await res.json();
  return data.result;
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await redisCommand("GET", key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number = 3600): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    await redisCommand("SET", key, serialized, "EX", String(ttlSeconds));
  },

  async del(key: string): Promise<void> {
    await redisCommand("DEL", key);
  },

  /**
   * Get cached value or compute and cache it.
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    if (!REDIS_ENABLED) return fetcher();

    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  },

  /**
   * Invalidate all keys matching a prefix pattern.
   * Note: Upstash supports SCAN, use for cleanup jobs.
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    // For Upstash REST API, use SCAN + DEL
    let cursor = "0";
    do {
      const result = await redisCommand("SCAN", cursor, "MATCH", `${prefix}*`, "COUNT", "100");
      cursor = result[0];
      const keys = result[1] as string[];
      if (keys.length > 0) {
        await redisCommand("DEL", ...keys);
      }
    } while (cursor !== "0");
  },
};

// ─── Cache key helpers ──────────────────────────────────────────────────────

export const CacheKeys = {
  stockSnapshot: (symbol: string) => `snapshot:${symbol}`,
  stockDetail: (symbol: string) => `detail:${symbol}`,
  dashboard: () => "dashboard",
  earnings: (symbol: string) => `earnings:${symbol}`,
  entryZone: (symbol: string) => `entry-zone:${symbol}`,
  industryBenchmark: (industry: string) => `industry:${industry}`,
  chart: (symbol: string, range: string) => `chart:${symbol}:${range}`,
} as const;
