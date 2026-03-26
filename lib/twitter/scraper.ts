/**
 * Twitter scraper using the public syndication API (no auth required).
 * Uses https.request (HTTP/1.1) to avoid rate limits on the HTTP/2 fetch path.
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

interface SyndicationTweet {
  id_str?: string;
  conversation_id_str?: string;
  full_text?: string;
  text?: string;
  created_at?: string;
  favorite_count?: number;
  retweet_count?: number;
  reply_count?: number;
  retweeted_status?: unknown;
}

interface SyndicationEntry {
  type: string;
  content?: {
    tweet?: SyndicationTweet;
  };
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
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Syndication fetch failed: ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

export async function fetchLatestTweets(count: number = 100): Promise<WalterTweet[]> {
  const html = await httpsGet(
    "https://syndication.twitter.com/srv/timeline-profile/screen-name/DeItaone"
  );

  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/);
  if (!match) {
    throw new Error("Could not find __NEXT_DATA__ in syndication response");
  }

  const nextData = JSON.parse(match[1]);
  const entries: SyndicationEntry[] =
    nextData?.props?.pageProps?.timeline?.entries ?? [];

  const tweets: WalterTweet[] = [];

  for (const entry of entries) {
    if (entry.type !== "tweet" || !entry.content?.tweet) continue;

    const t = entry.content.tweet;
    const id = t.id_str || t.conversation_id_str;
    const text = t.full_text || t.text;

    if (!id || !text) continue;

    const createdAt = t.created_at
      ? new Date(t.created_at).toISOString()
      : new Date().toISOString();

    tweets.push({
      id,
      text,
      created_at: createdAt,
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
