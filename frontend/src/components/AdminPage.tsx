import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import {
  useCooldown,
  useHidePost,
  useLatestPosts,
  useMaxTextLength,
  useOwner,
  usePause,
  usePaused,
  useSetCooldown,
  useSetMaxTextLength,
  useUnpause,
} from "../hooks/useWall";
import { CONTRACT_CONFIGURED } from "../wagmiConfig";

// hidePost(postId, false) = unhide — fully supported by GmonadWallCore.
// The contract takes a boolean: true = hide, false = unhide.
// Both operations use the same useHidePost hook.

function timeAgo(unixSeconds: bigint) {
  const diff = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (diff < 60) return "just now";
  if (diff < 3600) { const m = Math.floor(diff / 60); return `${m}m ago`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h}h ago`; }
  const d = Math.floor(diff / 86400); return `${d}d ago`;
}

function truncateAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Section heading ─────────────────────────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-white border-b border-gray-800 pb-2">{children}</h2>;
}

// ─── Setting row ─────────────────────────────────────────────────────────────
interface SettingRowProps {
  label: string;
  currentValue: string;
  inputValue: string;
  onInputChange: (v: string) => void;
  onSet: () => void;
  busy: boolean;
  isSuccess: boolean;
  error: Error | null;
  hint: string;
  placeholder: string;
}

function SettingRow({
  label, currentValue, inputValue, onInputChange, onSet,
  busy, isSuccess, error, hint, placeholder,
}: SettingRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm text-gray-300">
          {label}: <span className="font-mono text-purple-300">{currentValue}</span>
        </span>
        <span className="text-[10px] text-gray-600">{hint}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 text-white placeholder-gray-500 px-3 py-1.5 text-sm outline-none transition-colors"
        />
        <button
          onClick={onSet}
          disabled={busy || inputValue.trim() === ""}
          className="px-4 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {busy ? (busy ? "Confirming…" : "Confirm in wallet…") : "Set"}
        </button>
      </div>
      {isSuccess && (
        <p className="text-xs text-emerald-400">Updated successfully.</p>
      )}
      {error && (
        <p className="text-xs text-red-400">
          {(error as { shortMessage?: string }).shortMessage ?? error.message}
        </p>
      )}
    </div>
  );
}

// ─── AdminPage ────────────────────────────────────────────────────────────────
export function AdminPage() {
  const { address, isConnected } = useAccount();

  // ── Owner / state reads ───────────────────────────────────────────────────
  const { data: owner } = useOwner();
  const { data: postsData, refetch } = useLatestPosts(50);
  const { data: isPausedData } = usePaused();
  const isPaused = isPausedData === true;
  const { data: maxTextLengthData } = useMaxTextLength();
  const { data: cooldownData } = useCooldown();

  // ── Pause/unpause ─────────────────────────────────────────────────────────
  const { pause, isPending: pauseIsPending, isConfirming: pauseIsConfirming,
    isSuccess: pauseIsSuccess, error: pauseError, reset: pauseReset } = usePause();
  const { unpause, isPending: unpauseIsPending, isConfirming: unpauseIsConfirming,
    isSuccess: unpauseIsSuccess, error: unpauseError, reset: unpauseReset } = useUnpause();
  const pauseBusy = pauseIsPending || pauseIsConfirming || unpauseIsPending || unpauseIsConfirming;

  // ── setMaxTextLength ──────────────────────────────────────────────────────
  const [newMaxText, setNewMaxText] = useState("");
  const { setMaxTextLength, isPending: maxIsPending, isConfirming: maxIsConfirming,
    isSuccess: maxIsSuccess, error: maxError, reset: maxReset } = useSetMaxTextLength();
  const maxBusy = maxIsPending || maxIsConfirming;

  // ── setCooldown ───────────────────────────────────────────────────────────
  const [newCooldown, setNewCooldown] = useState("");
  const { setCooldown, isPending: cdIsPending, isConfirming: cdIsConfirming,
    isSuccess: cdIsSuccess, error: cdError, reset: cdReset } = useSetCooldown();
  const cdBusy = cdIsPending || cdIsConfirming;

  // ── Hide/unhide ───────────────────────────────────────────────────────────
  const { hide, isPending: hideIsPending, isConfirming: hideIsConfirming,
    isSuccess: hideIsSuccess, error: hideError, reset: hideReset } = useHidePost();
  const [pendingHideId, setPendingHideId] = useState<bigint | null>(null);
  const lastHandledHide = useRef<string | undefined>(undefined);
  const hideBusy = hideIsPending || hideIsConfirming;

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { if (pauseIsSuccess) pauseReset(); }, [pauseIsSuccess, pauseReset]);
  useEffect(() => { if (unpauseIsSuccess) unpauseReset(); }, [unpauseIsSuccess, unpauseReset]);
  useEffect(() => { if (maxIsSuccess) { setNewMaxText(""); maxReset(); } }, [maxIsSuccess, maxReset]);
  useEffect(() => { if (cdIsSuccess) { setNewCooldown(""); cdReset(); } }, [cdIsSuccess, cdReset]);
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

  const isOwner =
    isConnected && !!owner && !!address &&
    address.toLowerCase() === (owner as string).toLowerCase();

  // ── Normalize posts — include authors and all hidden posts for admin review
  const posts = useMemo(() => {
    if (!postsData) return [];
    const [ids, authors, nadIds, texts, , , timestamps, hiddenFlags] = postsData as [
      bigint[], string[], bigint[], string[], string[], number[], bigint[], boolean[]
    ];
    return (ids as bigint[]).map((id, i) => ({
      id,
      author: (authors as string[])[i],
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

  function handleSetMaxText() {
    const v = parseInt(newMaxText, 10);
    if (isNaN(v) || v < 10 || v > 500) return;
    setMaxTextLength(v);
  }

  function handleSetCooldown() {
    const v = parseInt(newCooldown, 10);
    if (isNaN(v) || v < 30 || v > 600) return;
    setCooldown(v);
  }

  // ── Guards ────────────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">

      {/* ── 1. Contract Status ─────────────────────────────────────────────── */}
      <div>
        <SectionHeading>Contract Status</SectionHeading>
        <div className="mt-3 flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isPaused ? "bg-red-400" : "bg-emerald-400"}`} />
            <span className="text-sm text-gray-400">
              Contract:{" "}
              <span className={isPaused ? "text-red-400 font-medium" : "text-emerald-400 font-medium"}>
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
          <p className="text-xs text-red-400 mt-1">
            {((pauseError || unpauseError) as { shortMessage?: string })?.shortMessage ??
             (pauseError || unpauseError)?.message}
          </p>
        )}
      </div>

      {/* ── 2. Admin Settings ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <SectionHeading>Admin Settings</SectionHeading>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-4">

          {/* Max Text Length */}
          <SettingRow
            label="Max Text Length"
            currentValue={maxTextLengthData !== undefined ? `${maxTextLengthData.toString()} bytes` : "…"}
            inputValue={newMaxText}
            onInputChange={setNewMaxText}
            onSet={handleSetMaxText}
            busy={maxBusy}
            isSuccess={maxIsSuccess}
            error={maxError}
            hint="Min 10 · Max 500"
            placeholder="e.g. 240"
          />

          <div className="border-t border-gray-800" />

          {/* Cooldown */}
          <SettingRow
            label="Cooldown"
            currentValue={cooldownData !== undefined ? `${cooldownData.toString()}s` : "…"}
            inputValue={newCooldown}
            onInputChange={setNewCooldown}
            onSet={handleSetCooldown}
            busy={cdBusy}
            isSuccess={cdIsSuccess}
            error={cdError}
            hint="Min 30s · Max 600s"
            placeholder="e.g. 60"
          />
        </div>
      </div>

      {/* ── 3. Moderation ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionHeading>Moderate Posts</SectionHeading>
          <span className="text-xs text-gray-600 font-mono">{posts.length} posts loaded</span>
        </div>

        {/* Unhide note — contract supports it */}
        <p className="text-[11px] text-gray-600">
          Hidden posts are visible here only. Use Unhide to restore a post to the public wall.
          Both hide and unhide are supported by the contract (<code className="font-mono">hidePost(id, false)</code>).
        </p>

        {posts.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-gray-500 text-sm">
            No posts yet. Hide / Unhide controls will appear here per post as users post to the wall.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((post) => {
              const isActing = pendingHideId === post.id && hideBusy;
              return (
                <div
                  key={post.id.toString()}
                  className={`flex flex-col gap-2 rounded-xl border p-4 transition-opacity ${
                    post.hidden
                      ? "border-gray-800 bg-gray-900/40 opacity-60"
                      : "border-gray-700 bg-gray-900"
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-purple-400">
                        #{post.id.toString()}
                      </span>
                      <span className="text-xs font-mono text-gray-500">
                        Nad {post.nadId.toString()}
                      </span>
                      <span className="text-xs font-mono text-gray-600" title={post.author}>
                        {truncateAddr(post.author)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
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

                  {/* Post text */}
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
    </div>
  );
}
