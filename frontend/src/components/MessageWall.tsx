import { useCallback, useEffect, useMemo, useState } from "react";
import { useLatestPosts, usePostCount, usePostsBefore } from "../hooks/useWall";
import {
  useArchiveLatestMessages,
  useArchiveLatestPostsV2,
  useArchiveMessageCount,
  useArchivePostCountV2,
} from "../hooks/useArchive";
import { MessageCard, UnifiedPost } from "./MessageCard";

const FETCH_LIMIT = 50;
const LOAD_MORE_LIMIT = 25;

interface Props {
  refreshSignal: number;
}

export function MessageWall({ refreshSignal }: Props) {
  // Mainnet pagination state (testnet posts load once — no extra pagination needed)
  const [extraPosts, setExtraPosts] = useState<UnifiedPost[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreAttempted, setLoadMoreAttempted] = useState(false);

  // ── Mainnet reads ─────────────────────────────────────────────────────────
  const { data: postsData, isLoading: mainnetLoading, isError: mainnetError, refetch } =
    useLatestPosts(FETCH_LIMIT);
  const { data: mainnetCount } = usePostCount();
  const { fetchBefore } = usePostsBefore();

  // ── Testnet archive reads (read-only, no pagination) ──────────────────────
  const { data: v1Data, isLoading: v1Loading } = useArchiveLatestMessages(FETCH_LIMIT);
  const { data: v2Data, isLoading: v2Loading } = useArchiveLatestPostsV2(FETCH_LIMIT);
  const { data: v1Count } = useArchiveMessageCount();
  const { data: v2Count } = useArchivePostCountV2();

  useEffect(() => {
    if (refreshSignal > 0) refetch();
  }, [refreshSignal, refetch]);

  // Reset mainnet pagination when fresh data arrives (e.g. after a new post)
  useEffect(() => {
    if (!postsData) return;
    const [ids] = postsData as unknown as [bigint[], ...unknown[]];
    setExtraPosts([]);
    setHasMore(ids.length >= FETCH_LIMIT);
    setLoadMoreAttempted(false);
  }, [postsData]);

  // ── Normalize mainnet posts ───────────────────────────────────────────────
  const mainnetPosts = useMemo<UnifiedPost[]>(() => {
    if (!postsData) return [];
    const [ids, , nadIds, texts, mediaURIs, mediaTypes, timestamps, hiddenFlags] = postsData as [
      bigint[], string[], bigint[], string[], string[], number[], bigint[], boolean[]
    ];
    return (ids as bigint[]).map((id, i) => ({
      source: "mainnet" as const,
      id,
      nadId: (nadIds as bigint[])[i],
      text: (texts as string[])[i],
      mediaURI: (mediaURIs as string[])[i],
      mediaType: Number((mediaTypes as number[])[i]),
      timestamp: (timestamps as bigint[])[i],
      hidden: (hiddenFlags as boolean[])[i],
    }));
  }, [postsData]);

  // ── Normalize testnet V1 posts ────────────────────────────────────────────
  const v1Posts = useMemo<UnifiedPost[]>(() => {
    if (!v1Data) return [];
    const [ids, texts, timestamps, hiddenFlags] = v1Data as [
      bigint[], string[], bigint[], boolean[]
    ];
    return (ids as bigint[]).map((id, i) => ({
      source: "v1" as const,
      id,
      nadId: null,
      text: (texts as string[])[i],
      mediaURI: "",
      mediaType: 0,
      timestamp: (timestamps as bigint[])[i],
      hidden: (hiddenFlags as boolean[])[i],
    }));
  }, [v1Data]);

  // ── Normalize testnet V2 posts ────────────────────────────────────────────
  const v2Posts = useMemo<UnifiedPost[]>(() => {
    if (!v2Data) return [];
    const [ids, , nadIds, texts, mediaURIs, mediaTypes, timestamps, hiddenFlags] = v2Data as [
      bigint[], string[], bigint[], string[], string[], number[], bigint[], boolean[]
    ];
    return (ids as bigint[]).map((id, i) => ({
      source: "v2" as const,
      id,
      nadId: (nadIds as bigint[])[i],
      text: (texts as string[])[i],
      mediaURI: (mediaURIs as string[])[i],
      mediaType: Number((mediaTypes as number[])[i]),
      timestamp: (timestamps as bigint[])[i],
      hidden: (hiddenFlags as boolean[])[i],
    }));
  }, [v2Data]);

  // ── Merge all sources, dedup by composite key, filter hidden, sort newest-first
  const mergedPosts = useMemo<UnifiedPost[]>(() => {
    const seen = new Set<string>();
    const all = [...mainnetPosts, ...extraPosts, ...v1Posts, ...v2Posts].filter((p) => {
      if (p.hidden) return false;
      const key = `${p.source}-${p.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    all.sort((a, b) => (a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0));
    return all;
  }, [mainnetPosts, extraPosts, v1Posts, v2Posts]);

  // ── loadMore paginates mainnet only — testnet posts are fully loaded ───────
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setLoadMoreAttempted(true);
    const allMainnet = [...mainnetPosts, ...extraPosts];
    if (allMainnet.length === 0) return;
    const oldestId = allMainnet.reduce((min, p) => (p.id < min ? p.id : min), allMainnet[0].id);
    setIsLoadingMore(true);
    try {
      const raw = await fetchBefore(oldestId, LOAD_MORE_LIMIT);
      if (!raw) return;
      const [ids, , nadIds, texts, mediaURIs, mediaTypes, timestamps, hiddenFlags] = raw as [
        bigint[], string[], bigint[], string[], string[], number[], bigint[], boolean[]
      ];
      if (ids.length === 0) { setHasMore(false); return; }
      const newPosts = ids.map((id, i) => ({
        source: "mainnet" as const,
        id,
        nadId: nadIds[i],
        text: texts[i],
        mediaURI: mediaURIs[i],
        mediaType: Number(mediaTypes[i]),
        timestamp: timestamps[i],
        hidden: hiddenFlags[i],
      }));
      setExtraPosts((prev) => [...prev, ...newPosts]);
      if (ids.length < LOAD_MORE_LIMIT) setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, mainnetPosts, extraPosts, fetchBefore]);

  // Total count across all sources for display
  const totalCount =
    Number(mainnetCount ?? 0n) +
    Number(v1Count ?? 0n) +
    Number(v2Count ?? 0n);

  // Show loading only while mainnet is loading (testnet loads in background)
  const isLoading = mainnetLoading && v1Loading && v2Loading;
  const isError   = mainnetError;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="text-purple-400 animate-pulse">Loading messages…</span>
      </div>
    );
  }

  if (isError) {
    return <p className="text-center text-red-400 py-10">Failed to load messages.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-bold text-white">Community Wall</h2>
        {totalCount > 0 && (
          <span className="text-xs text-gray-500">{totalCount} total posts</span>
        )}
      </div>

      {/* Grid */}
      {mergedPosts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-gray-500">
          <span className="text-4xl">🫙</span>
          <p>No messages yet. Be the first!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {mergedPosts.map((post, i) => (
              <MessageCard
                key={`${post.source}-${post.id.toString()}`}
                post={post}
                isNewest={i === 0}
              />
            ))}
          </div>

          {/* Load more (mainnet pagination only) */}
          <div className="flex justify-center pt-4">
            {isLoadingMore ? (
              <span className="text-sm text-purple-400 animate-pulse">Loading older posts…</span>
            ) : hasMore ? (
              <button
                onClick={loadMore}
                className="px-5 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-purple-500 text-sm text-gray-300 hover:text-white transition-colors"
              >
                Load older posts
              </button>
            ) : loadMoreAttempted ? (
              <span className="text-sm text-gray-600">All posts loaded</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
