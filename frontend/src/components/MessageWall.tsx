import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useLatestPosts,
  usePostCount,
  usePostsBefore,
  usePostsByWallet,
  useOwnerOfNad,
} from "../hooks/useWall";
import {
  useArchiveLatestMessages,
  useArchiveLatestPostsV2,
  useArchiveMessageCount,
  useArchivePostCountV2,
} from "../hooks/useArchive";
import { MessageCard, UnifiedPost } from "./MessageCard";
import { parseSearchInput } from "../lib/searchParser";

const FETCH_LIMIT = 50;
const LOAD_MORE_LIMIT = 25;
const SEARCH_LIMIT = 50;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

interface Props {
  refreshSignal: number;
}

export function MessageWall({ refreshSignal }: Props) {
  // Mainnet pagination state (testnet posts load once — no extra pagination needed)
  const [extraPosts, setExtraPosts] = useState<UnifiedPost[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreAttempted, setLoadMoreAttempted] = useState(false);

  // Mainnet-only search state (Phase 13B)
  const [searchText, setSearchText] = useState("");

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

  // ── Mainnet-only search (Phase 13B) ────────────────────────────────────────
  const parsed = useMemo(() => parseSearchInput(searchText), [searchText]);

  // Nad → owner resolution (disabled unless a valid Nad ID is parsed)
  const nadIdArg = parsed.kind === "nad" ? parsed.nadId : undefined;
  const ownerQuery = useOwnerOfNad(nadIdArg);
  const resolvedOwner =
    parsed.kind === "nad" ? (ownerQuery.data as `0x${string}` | undefined) : undefined;
  const ownerIsZero = !!resolvedOwner && resolvedOwner.toLowerCase() === ZERO_ADDRESS;

  // Wallet to query: direct address, or the Nad's resolved (non-zero) owner
  const searchAddress: `0x${string}` | undefined =
    parsed.kind === "address"
      ? parsed.address
      : parsed.kind === "nad" && resolvedOwner && !ownerIsZero
      ? resolvedOwner
      : undefined;
  const walletQuery = usePostsByWallet(searchAddress, SEARCH_LIMIT);

  // Map the getPostsByWallet tuple → UnifiedPost[], dropping hidden posts via hiddenFlags
  const searchResults = useMemo<UnifiedPost[]>(() => {
    const raw = walletQuery.data;
    if (!raw) return [];
    const [ids, , nadIds, texts, mediaURIs, mediaTypes, timestamps, hiddenFlags] = raw as [
      bigint[], string[], bigint[], string[], string[], number[], bigint[], boolean[]
    ];
    return (ids as bigint[])
      .map((id, i) => ({
        source: "mainnet" as const,
        id,
        nadId: (nadIds as bigint[])[i],
        text: (texts as string[])[i],
        mediaURI: (mediaURIs as string[])[i],
        mediaType: Number((mediaTypes as number[])[i]),
        timestamp: (timestamps as bigint[])[i],
        hidden: (hiddenFlags as boolean[])[i],
      }))
      .filter((p) => !p.hidden);
  }, [walletQuery.data]);

  // Raw (pre-hidden-filter) count, to know if the 50-result cap was hit
  const rawResultCount = useMemo(() => {
    const raw = walletQuery.data;
    if (!raw) return 0;
    const [ids] = raw as unknown as [bigint[], ...unknown[]];
    return ids.length;
  }, [walletQuery.data]);

  // Total count across all sources for display
  const totalCount =
    Number(mainnetCount ?? 0n) +
    Number(v1Count ?? 0n) +
    Number(v2Count ?? 0n);

  // Show loading only while mainnet is loading (testnet loads in background)
  const isLoading = mainnetLoading && v1Loading && v2Loading;
  const isError   = mainnetError;

  // Search-mode derived display values (computed with proper narrowing)
  const isSearching = parsed.kind === "address" || parsed.kind === "nad";
  const isNadSearch = parsed.kind === "nad";
  const searchLoading = ownerQuery.isLoading || walletQuery.isLoading;
  let searchLabel = "";
  if (parsed.kind === "address") searchLabel = `Searching by wallet ${shortAddr(parsed.address)}`;
  else if (parsed.kind === "nad") searchLabel = `Searching by Nad #${parsed.nadId.toString()}`;

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
      {/* Wall header — title/count, then the search input below it (Phase 13B) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-bold text-white">Community Wall</h2>
          {totalCount > 0 && (
            <span className="text-xs text-gray-500">{totalCount} total posts</span>
          )}
        </div>

        {/* Search input — full width on mobile, capped and left-aligned on desktop */}
        <div className="w-full sm:max-w-sm">
          <div className="relative">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search Nad # or full 0x wallet"
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded-lg bg-gray-900 border border-gray-700 focus:border-purple-500 outline-none px-3 py-1.5 pr-8 text-sm text-gray-200 placeholder-gray-500 transition-colors"
            />
            {searchText.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchText("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          {parsed.kind === "invalid" && (
            <p className="mt-1 text-xs text-gray-500">{parsed.reason}</p>
          )}
        </div>
      </div>

      {isSearching ? (
        /* ── Search mode (mainnet only) ──────────────────────────────────── */
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2">
              <h3 className="text-base font-semibold text-white">Mainnet search results</h3>
              <span className="text-[11px] uppercase tracking-wider text-purple-400/80">
                Mainnet posts only
              </span>
            </div>
            <p className="text-xs text-gray-500">{searchLabel}</p>
          </div>

          {searchLoading ? (
            <div className="flex justify-center py-12">
              <span className="text-purple-400 animate-pulse">Searching…</span>
            </div>
          ) : isNadSearch && ownerIsZero ? (
            <p className="py-10 text-center text-gray-500">No Nad found.</p>
          ) : searchResults.length === 0 ? (
            <p className="py-10 text-center text-gray-500">
              {isNadSearch
                ? "No mainnet posts found for this Nad."
                : "No mainnet posts found for this wallet."}
            </p>
          ) : (
            <>
              <div className="columns-1 md:columns-2 xl:columns-3 gap-6">
                {searchResults.map((post) => (
                  <div
                    key={`${post.source}-${post.id.toString()}`}
                    className="break-inside-avoid mb-6 pt-3"
                  >
                    <MessageCard post={post} />
                  </div>
                ))}
              </div>
              {rawResultCount >= SEARCH_LIMIT && (
                <p className="text-center text-xs text-gray-600">Showing up to 50 results.</p>
              )}
            </>
          )}
        </div>
      ) : mergedPosts.length === 0 ? (
        /* ── Normal feed: empty ──────────────────────────────────────────── */
        <div className="flex flex-col items-center gap-2 py-16 text-gray-500">
          <span className="text-4xl">🫙</span>
          <p>No messages yet. Be the first!</p>
        </div>
      ) : (
        /* ── Normal feed ─────────────────────────────────────────────────── */
        <>
          <div className="columns-1 md:columns-2 xl:columns-3 gap-6">
            {mergedPosts.map((post, i) => (
              <div
                key={`${post.source}-${post.id.toString()}`}
                className="break-inside-avoid mb-6 pt-3"
              >
                <MessageCard
                  post={post}
                  isNewest={i === 0}
                />
              </div>
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
