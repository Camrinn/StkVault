"use client";

import { useEffect, useState } from "react";

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  likes: number;
  retweets: number;
  replies: number;
  is_retweet: boolean;
  has_trump: boolean;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function TrumpPage() {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function fetchTweets() {
    setLoading(true);
    try {
      const res = await fetch("/api/tweets?trump=1&limit=100");
      const data = await res.json();
      setTweets(Array.isArray(data) ? data : []);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTweets();
    const interval = setInterval(fetchTweets, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <div className="mb-5">
        <a href="/news" className="text-xs font-mono text-[hsl(var(--accent))] mb-3 block">
          ← WALTER FEED
        </a>
        <h1 className="text-2xl font-mono font-extrabold tracking-wider leading-tight">
          🇺🇸 SHIT TRUMP<br />JUST SAID
        </h1>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          via @DeIaone · auto-updating
          {lastRefresh && (
            <span className="ml-2 text-[10px]">
              · {timeAgo(lastRefresh.toISOString())}
            </span>
          )}
        </p>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] mb-3">
          {tweets.length} mention{tweets.length !== 1 ? "s" : ""} captured
        </p>
      )}

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] animate-pulse" />
          ))}
        </div>
      ) : tweets.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-3xl mb-3">🤐</div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No Trump mentions yet in the feed.
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Run a refresh to pull the latest tweets.
          </p>
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {tweets.map((tweet) => (
            <div
              key={tweet.id}
              className="card-interactive space-y-2 border-l-2 border-l-red-500/50"
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{tweet.text}</p>
              <div className="flex items-center justify-between text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                <div className="flex items-center gap-3">
                  {tweet.retweets > 0 && <span>↩ {tweet.retweets}</span>}
                  {tweet.likes > 0 && <span>♥ {tweet.likes}</span>}
                  {tweet.replies > 0 && <span>💬 {tweet.replies}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {tweet.is_retweet && (
                    <span className="px-1.5 py-0.5 bg-[hsl(var(--muted))]/50 rounded text-[9px] tracking-wider">
                      RT
                    </span>
                  )}
                  <span>{timeAgo(tweet.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
