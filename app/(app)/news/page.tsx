"use client";

import { useEffect, useState, useCallback, useRef } from "react";

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

const FETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function NewsPage() {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState("");
  const lastFetchRef = useRef<number>(0);

  // Read tweets from DB
  const loadTweets = useCallback(async (q: string) => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (q) params.set("q", q);
      const res = await fetch(`/api/tweets?${params}`);
      const data = await res.json();
      setTweets(Array.isArray(data) ? data : []);
    } catch {
      // keep stale data on error
    }
  }, []);

  // Trigger a live scrape then reload from DB
  const triggerRefresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    setRefreshError("");
    try {
      const res = await fetch("/api/tweets/refresh", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (!silent) setRefreshError(d.error ?? "Refresh failed");
      } else {
        setLastRefresh(new Date());
        lastFetchRef.current = Date.now();
      }
    } catch {
      if (!silent) setRefreshError("Network error");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  // On mount: trigger a scrape, then load tweets
  useEffect(() => {
    async function init() {
      setLoading(true);
      await triggerRefresh(true);
      await loadTweets(query);
      setLoading(false);
      setLastRefresh(new Date());
      lastFetchRef.current = Date.now();
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll DB every 60s; re-scrape every 5 minutes
  useEffect(() => {
    const interval = setInterval(async () => {
      await loadTweets(query);
      if (Date.now() - lastFetchRef.current >= FETCH_INTERVAL_MS) {
        triggerRefresh(true).then(() => loadTweets(query));
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [query, loadTweets, triggerRefresh]);

  // Re-load when query changes
  useEffect(() => {
    loadTweets(query);
  }, [query, loadTweets]);

  async function handleManualRefresh() {
    await triggerRefresh(false);
    await loadTweets(query);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(keyword);
  }

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-mono font-extrabold tracking-wider">
            ⚡ WALTER BLOOMBERG
          </h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            @DeItaone · live feed
            {lastRefresh && (
              <span className="ml-2 text-[10px]">
                refreshed {timeAgo(lastRefresh.toISOString())}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] text-[10px] font-mono font-bold tracking-wider rounded-lg border border-[hsl(var(--accent))]/30 disabled:opacity-50 active:scale-95 transition-transform shrink-0"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={refreshing ? "animate-spin" : ""}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          {refreshing ? "FETCHING..." : "REFRESH"}
        </button>
      </div>

      {refreshError && (
        <p className="text-[11px] font-mono text-red-400 mb-3">{refreshError}</p>
      )}

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
            {query ? `No tweets matching "${query}"` : "No tweets yet — try refreshing."}
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
