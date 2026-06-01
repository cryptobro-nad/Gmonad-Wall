import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useHidePostV2, useLatestPostsV2, useOwnerV2 } from "../hooks/useWall";

function timeAgo(unixSeconds: bigint) {
  const diff = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (diff < 60) return "just now";
  if (diff < 3600) { const m = Math.floor(diff / 60); return `${m}m ago`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h}h ago`; }
  const d = Math.floor(diff / 86400); return `${d}d ago`;
}

export function AdminPage() {
  const { address, isConnected } = useAccount();
  const { data: owner } = useOwnerV2();
  const { data: postsData, refetch } = useLatestPostsV2(50);
  const { hide, isPending, isConfirming, isSuccess, error, reset } = useHidePostV2();
  const [pendingId, setPendingId] = useState<bigint | null>(null);
  const lastHandled = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isSuccess && pendingId !== null) {
      const key = pendingId.toString();
      if (key !== lastHandled.current) {
        lastHandled.current = key;
        refetch();
        reset();
        setPendingId(null);
      }
    }
  }, [isSuccess, pendingId, refetch, reset]);

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
    setPendingId(id);
    hide(id, !currentlyHidden);
  }, [hide]);

  const isBusy = isPending || isConfirming;

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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Moderate Posts</h2>
        <span className="text-xs text-gray-600 font-mono">{posts.length} posts loaded</span>
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-500 text-sm">No posts yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => {
            const isActing = pendingId === post.id && isBusy;
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
                      disabled={isBusy}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        post.hidden
                          ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                          : "bg-red-900/50 hover:bg-red-800/60 text-red-300"
                      }`}
                    >
                      {isActing
                        ? isPending ? "Confirm in wallet…" : "Confirming…"
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

      {error && (
        <p className="text-xs text-red-400">
          {(error as { shortMessage?: string }).shortMessage ?? error.message}
        </p>
      )}
    </div>
  );
}
