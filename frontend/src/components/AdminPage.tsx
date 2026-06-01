import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useHidePost, useLatestPosts, useOwner, usePause, usePaused, useUnpause } from "../hooks/useWall";
import { CONTRACT_CONFIGURED } from "../wagmiConfig";

function timeAgo(unixSeconds: bigint) {
  const diff = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (diff < 60) return "just now";
  if (diff < 3600) { const m = Math.floor(diff / 60); return `${m}m ago`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h}h ago`; }
  const d = Math.floor(diff / 86400); return `${d}d ago`;
}

export function AdminPage() {
  const { address, isConnected } = useAccount();
  const { data: owner } = useOwner();
  const { data: postsData, refetch } = useLatestPosts(50);
  const { data: isPausedData } = usePaused();
  const isPaused = isPausedData === true;

  // Hide/unhide
  const { hide, isPending: hideIsPending, isConfirming: hideIsConfirming, isSuccess: hideIsSuccess, error: hideError, reset: hideReset } = useHidePost();
  const [pendingHideId, setPendingHideId] = useState<bigint | null>(null);
  const lastHandledHide = useRef<string | undefined>(undefined);

  // Pause/unpause
  const { pause, isPending: pauseIsPending, isConfirming: pauseIsConfirming, isSuccess: pauseIsSuccess, error: pauseError, reset: pauseReset } = usePause();
  const { unpause, isPending: unpauseIsPending, isConfirming: unpauseIsConfirming, isSuccess: unpauseIsSuccess, error: unpauseError, reset: unpauseReset } = useUnpause();
  const pauseBusy = pauseIsPending || pauseIsConfirming || unpauseIsPending || unpauseIsConfirming;

  useEffect(() => {
    if (hideIsSuccess && pendingHideId !== null) {
      const key = pendingHideId.toString();
      if (key !== lastHandledHide.current) {
        lastHandledHide.current = key;
        refetch();
        hideReset();
        setPendingHideId(null);
      }
    }
  }, [hideIsSuccess, pendingHideId, refetch, hideReset]);

  useEffect(() => {
    if (pauseIsSuccess) { pauseReset(); }
  }, [pauseIsSuccess, pauseReset]);

  useEffect(() => {
    if (unpauseIsSuccess) { unpauseReset(); }
  }, [unpauseIsSuccess, unpauseReset]);

  const isOwner =
    isConnected &&
    !!owner &&
    !!address &&
    address.toLowerCase() === (owner as string).toLowerCase();

  const posts = useMemo(() => {
    if (!postsData) return [];
    const [ids, , nadIds, texts, , , timestamps, hiddenFlags] = postsData as [
      bigint[], string[], bigint[], string[], string[], number[], bigint[], boolean[]
    ];
    return (ids as bigint[]).map((id, i) => ({
      id,
      nadId: (nadIds as bigint[])[i],
      text: (texts as string[])[i],
      timestamp: (timestamps as bigint[])[i],
      hidden: (hiddenFlags as boolean[])[i],
    }));
  }, [postsData]);

  const handleToggle = useCallback((id: bigint, currentlyHidden: boolean) => {
    setPendingHideId(id);
    hide(id, !currentlyHidden);
  }, [hide]);

  const hideBusy = hideIsPending || hideIsConfirming;

  if (!CONTRACT_CONFIGURED) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500 text-sm">
        Mainnet contract is not configured yet.
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400 text-sm">
        Connect your wallet to access moderation.
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400 text-sm">
        This wallet is not the contract owner. Connect the owner wallet to moderate.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">

      {/* Contract status section */}
      <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isPaused ? "bg-red-400" : "bg-emerald-400"}`} />
          <span className="text-sm text-gray-400">
            Contract: <span className={isPaused ? "text-red-400 font-medium" : "text-emerald-400 font-medium"}>
              {isPaused ? "Paused" : "Active"}
            </span>
          </span>
        </div>
        <button
          onClick={() => isPaused ? unpause() : pause()}
          disabled={pauseBusy}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isPaused
              ? "bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-300"
              : "bg-red-900/50 hover:bg-red-800/60 text-red-300"
          }`}
        >
          {pauseBusy
            ? (pauseIsPending || unpauseIsPending ? "Confirm in wallet…" : "Confirming…")
            : isPaused ? "Resume Wall" : "Pause Wall"}
        </button>
      </div>

      {(pauseError || unpauseError) && (
        <p className="text-xs text-red-400">
          {((pauseError || unpauseError) as { shortMessage?: string })?.shortMessage ??
           (pauseError || unpauseError)?.message}
        </p>
      )}

      {/* Moderation section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Moderate Posts</h2>
        <span className="text-xs text-gray-600 font-mono">{posts.length} posts loaded</span>
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-500 text-sm">No posts yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => {
            const isActing = pendingHideId === post.id && hideBusy;
            return (
              <div
                key={post.id.toString()}
                className={`flex flex-col gap-1 rounded-xl border p-4 transition-opacity ${
                  post.hidden
                    ? "border-gray-800 bg-gray-900/40 opacity-50"
                    : "border-gray-700 bg-gray-900"
                }`}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-xs font-mono text-purple-400">
                    Nad #{post.nadId.toString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {post.hidden && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 uppercase tracking-wider">
                        Hidden
                      </span>
                    )}
                    <span className="text-xs text-gray-600">{timeAgo(post.timestamp)}</span>
                    <button
                      onClick={() => handleToggle(post.id, post.hidden)}
                      disabled={hideBusy}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        post.hidden
                          ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                          : "bg-red-900/50 hover:bg-red-800/60 text-red-300"
                      }`}
                    >
                      {isActing
                        ? hideIsPending ? "Confirm in wallet…" : "Confirming…"
                        : post.hidden ? "Unhide" : "Hide from wall"}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-300 break-words">{post.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {hideError && (
        <p className="text-xs text-red-400">
          {(hideError as { shortMessage?: string }).shortMessage ?? hideError.message}
        </p>
      )}
    </div>
  );
}
