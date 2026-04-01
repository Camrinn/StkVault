/**
 * Twitter scraper using Nitter RSS — real-time chronological feed.
 * Falls back to syndication API if Nitter is unavailable.
 * Fetches tweets from @DeItaone (Walter Bloomberg).
 */

import https from "https";

export interface WalterTweet {
  id: string;
  text: string;
  created_at: string;
  likes: number;
  retweets: number;
  replies: number;
  is_retweet: boolean;
  has_trump: boolean;
}

const TRUMP_KEYWORDS = ["TRUMP", "Trump", "DJT", "POTUS", "tariff", "Tariff", "TARIFF"];

export function hasTrumpMention(text: string): boolean {
  return TRUMP_KEYWORDS.some((kw) => text.includes(kw));
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/rss+xml, text/xml, */*",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Fetch failed: ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

function parseNitterRSS(xml: string): WalterTweet[] {
  const tweets: WalterTweet[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    // Extract fields
    const idMatch = item.match(/<guid[^>]*>([^<]+)<\/guid>/);
    const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const descMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const dateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);
    const linkMatch = item.match(/<link>([^<]+)<\/link>/);

    const id = idMatch?.[1]?.trim();
    const pubDate = dateMatch?.[1]?.trim();

    // Get text from description (strip HTML tags), fall back to title
    let text = descMatch?.[1] ?? titleMatch?.[1] ?? "";
    text = text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim();

    if (!id || !text) continue;

    const isRetweet = text.startsWith("RT @") || (linkMatch?.[1] ?? "").includes("/retweet/");
    const createdAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

    tweets.push({
      id,
      text,
      created_at: createdAt,
      likes: 0,
      retweets: 0,
      replies: 0,
      is_retweet: isRetweet,
      has_trump: hasTrumpMention(text),
    });
  }

  return tweets;
}

const NITTER_INSTANCES = [
  "nitter.poast.org",
  "nitter.privacydev.net",
  "nitter.1d4.us",
  "nitter.net",
];

async function fetchFromNitter(count: number): Promise<WalterTweet[]> {
  for (const instance of NITTER_INSTANCES) {
    try {
      const xml = await httpsGet(`https://${instance}/DeItaone/rss`);
      const tweets = parseNitterRSS(xml);
      if (tweets.length > 0) return tweets.slice(0, count);
    } catch {
      // try next instance
    }
  }
  throw new Error("All Nitter instances failed");
}

async function fetchFromSyndication(count: number): Promise<WalterTweet[]> {
  const html = await httpsGet(
    "https://syndication.twitter.com/srv/timeline-profile/screen-name/DeItaone"
  );

  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/);
  if (!match) throw new Error("No __NEXT_DATA__ in syndication response");

  const nextData = JSON.parse(match[1]);
  const entries = nextData?.props?.pageProps?.timeline?.entries ?? [];
  const tweets: WalterTweet[] = [];

  for (const entry of entries) {
    if (entry.type !== "tweet" || !entry.content?.tweet) continue;
    const t = entry.content.tweet;
    const id = t.id_str || t.conversation_id_str;
    const text = t.full_text || t.text;
    if (!id || !text) continue;

    tweets.push({
      id,
      text,
      created_at: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
      likes: t.favorite_count ?? 0,
      retweets: t.retweet_count ?? 0,
      replies: t.reply_count ?? 0,
      is_retweet: !!t.retweeted_status,
      has_trump: hasTrumpMention(text),
    });

    if (tweets.length >= count) break;
  }

  return tweets;
}

export async function fetchLatestTweets(count: number = 20): Promise<WalterTweet[]> {
  try {
    const tweets = await fetchFromNitter(count);
    if (tweets.length > 0) return tweets;
    throw new Error("Nitter returned no tweets");
  } catch (err) {
    console.warn("Nitter failed, falling back to syndication:", (err as Error).message);
    return fetchFromSyndication(count);
  }
}
