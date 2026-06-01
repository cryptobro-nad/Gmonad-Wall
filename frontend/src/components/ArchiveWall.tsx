// ArchiveWall — read-only view of testnet V1/V2 history.
//
// Safety rules enforced in this component:
//   - No wallet hooks (no useAccount, no useConnect, no useWalletClient)
//   - No write hooks (no useWriteContract, no sendTransaction)
//   - No composer, no MessageInput, no NetworkGuard
//   - No admin controls
//   - No imports from useWall.ts (mainnet)
//   - All reads come exclusively from useArchive.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useArchiveLatestMessages,
  useArchiveLatestPostsV2,
  useArchiveMessageCount,
  useArchivePostCountV2,
  useArchivePostsBeforeV2,
} from "../hooks/useArchive";
import { MessageCard, UnifiedPost } from "./MessageCard";

const FETCH_LIMIT = 50;
const LOAD_MORE_LIMIT = 25;

export function ArchiveWall() {
  const [extraV2Posts, setExtraV2Posts] = useState<UnifiedPost[]>([]);
  const [hasMoreV2, setHasMoreV2] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreAttempted, setLoadMoreAttempted] = useState(false);

  const { data: v1Data, isLoading: v1Loading, isError: v1Error } = useArchiveLatestMessages(FETCH_LIMIT);
  const { data: v2Data, isLoading: v2Loading, isError: v2Error } = useArchiveLatestPostsV2(FETCH_LIMIT);
  const { data: v1Count } = useArchiveMessageCount();
  const { data: v2Count } = useArchivePostCountV2();
  const { fetchBefore } = useArchivePostsBeforeV2();

  // Reset pagination state when V2 data first loads
  useEffect(() => {
    if (!v2Data) return;
    const [ids] = v2Data as unknown as [bigint[], ...unknown[]];
    setExtraV2Posts([]);
    setHasMoreV2(ids.length >= FETCH_LIMIT);
    setLoadMoreAttempted(false);
  }, [v2Data]);

  const totalCount =
    (v1Count !== undefined ? Number(v1Count) : 0) +
    (v2Count !== undefined ? Number(v2Count) : 0);

  // Normalize V1 posts → UnifiedPost[]
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

  // Normalize V2 posts → UnifiedPost[]
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

  // Merge V1 + V2 + extra, dedup, filter hidden, sort newest-first
  const mergedPosts = useMemo<UnifiedPost[]>(() => {
    const seen = new Set<string>();
    const all = [...v1Posts, ...v2Posts, ...extraV2Posts].filter((p) => {
      if (p.hidden) return false;
      const key = `${p.source}-${p.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    all.sort((a, b) => (a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0));
    return all;
  }, [v1Posts, v2Posts, extraV2Posts]);

  // Cursor uses V2-only IDs — never mixes V1 IDs into the pagination cursor
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMoreV2) return;
    setLoadMoreAttempted(true);
    const allV2 = [...v2Posts, ...extraV2Posts];
    if (allV2.length === 0) return;
    const oldestId = allV2.reduce((min, p) => (p.id < min ? p.id : min), allV2[0].id);
    setIsLoadingMore(true);
    try {
      const raw = await fetchBefore(oldestId, LOAD_MORE_LIMIT);
      if (!raw) return;
      const [ids, , nadIds, texts, mediaURIs, mediaTypes, timestamps, hiddenFlags] = raw as [
        bigint[], string[], bigint[], string[], string[], number[], bigint[], boolean[]
      ];
      if (ids.length === 0) { setHasMoreV2(false); return; }
      const newPosts = ids.map((id, i) => ({
        source: "v2" as const,
        id,
        nadId: nadIds[i],
        text: texts[i],
        mediaURI: mediaURIs[i],
        mediaType: Number(mediaTypes[i]),
        timestamp: timestamps[i],
        hidden: hiddenFlags[i],
      }));
      setExtraV2Posts((prev) => [...prev, ...newPosts]);
      if (ids.length < LOAD_MORE_LIMIT) setHasMoreV2(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreV2, v2Posts, extraV2Posts, fetchBefore]);

  const isLoading = v1Loading && v2Loading;
  const isError   = v1Error && v2Error;

  return (
    <div className="max-w-6xl mx-auto px-4 pb-6 pt-4 flex flex-col gap-4">

      {/* Archive header — clearly labeled read-only */}
      <div className="flex flex-col gap-1 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-white">Testnet Archive</h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-gray-800 text-gray-400 border border-gray-700">
            Read Only
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Historical messages from Monad Testnet V1 and V2. No new posts can be made here.
          {totalCount > 0 && <span className="ml-1">{totalCount} total archived posts.</span>}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span className="text-purple-400 animate-pulse">Loading archive…</span>
        </div>
      ) : isError ? (
        <p className="text-center text-red-400 py-10">
          Failed to load archive. The testnet RPC may be unavailable.
        </p>
      ) : mergedPosts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-gray-500">
          <span className="text-4xl">🗂️</span>
          <p>No archived posts found.</p>
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

          {/* Load more */}
          <div className="flex justify-center pt-4">
            {isLoadingMore ? (
              <span className="text-sm text-purple-400 animate-pulse">Loading older posts…</span>
            ) : hasMoreV2 ? (
              <button
                onClick={loadMore}
                className="px-5 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-purple-500 text-sm text-gray-300 hover:text-white transition-colors"
              >
                Load older posts
              </button>
            ) : loadMoreAttempted ? (
              <span className="text-sm text-gray-600">All archived posts loaded</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
