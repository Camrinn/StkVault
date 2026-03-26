"use client";

import { useEffect, useState, useCallback } from "react";

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

function TweetCard({ tweet }: { tweet: Tweet }) {
  return (
    <div className={`card-interactive space-y-2 ${tweet.has_trump ? "border-l-2 border-l-[hsl(var(--accent))]" : ""}`}>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{tweet.text}</p>
      <div className="flex items-center justify-between text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
        <div className="flex items-center gap-3">
          {tweet.retweets > 0 && <span>↩ {tweet.retweets}</span>}
          {tweet.likes > 0 && <span>♥ {tweet.likes}</span>}
          {tweet.replies > 0 && <span>💬 {tweet.replies}</span>}
        </div>
        <div className="flex items-center gap-2">
          {tweet.has_trump && (
            <span className="px-1.5 py-0.5 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] rounded text-[9px] tracking-wider">
              TRUMP
            </span>
          )}
          {tweet.is_retweet && (
            <span className="px-1.5 py-0.5 bg-[hsl(var(--muted))]/50 rounded text-[9px] tracking-wider">
              RT
            </span>
          )}
          <span>{timeAgo(tweet.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

export default function NewsPage() {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchTweets = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (q) params.set("q", q);
      const res = await fetch(`/api/tweets?${params}`);
      const data = await res.json();
      setTweets(Array.isArray(data) ? data : []);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTweets(query);
    const interval = setInterval(() => fetchTweets(query), 60000);
    return () => clearInterval(interval);
  }, [query, fetchTweets]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(keyword);
  }

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-mono font-extrabold tracking-wider">
          ⚡ WALTER BLOOMBERG
        </h1>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
          @DeIaone · live feed
          {lastRefresh && (
            <span className="ml-2 text-[10px]">
              refreshed {timeAgo(lastRefresh.toISOString())}
            </span>
          )}
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Filter by keyword..."
          className="flex-1 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm font-mono placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--accent))]/50"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] text-xs font-mono font-bold tracking-wider rounded-lg border border-[hsl(var(--accent))]/30"
        >
          FILTER
        </button>
        {query && (
          <button
            type="button"
            onClick={() => { setKeyword(""); setQuery(""); }}
            className="px-3 py-2 text-xs font-mono text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded-lg"
          >
            ✕
          </button>
        )}
      </form>

      {/* Trump shortcut */}
      <div className="mb-4 flex gap-2">
        <a
          href="/trump"
          className="px-3 py-1.5 bg-red-500/10 text-red-400 text-[10px] font-mono font-bold tracking-wider rounded-lg border border-red-500/20"
        >
          🇺🇸 TRUMP FEED →
        </a>
      </div>

      {/* Stats */}
      {!loading && (
        <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] mb-3">
          {tweets.length} tweet{tweets.length !== 1 ? "s" : ""}
          {query && ` matching "${query}"`}
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
          <div className="text-3xl mb-3">📭</div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {query ? `No tweets matching "${query}"` : "No tweets yet — run a refresh to pull the feed."}
          </p>
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {tweets.map((t) => <TweetCard key={t.id} tweet={t} />)}
        </div>
      )}
    </div>
  );
}
