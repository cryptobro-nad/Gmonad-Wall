import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { useCooldownRemaining, usePostMessage } from "../hooks/useWall";
import { monadMainnet } from "../wagmiConfig";

const MAX_BYTES = 240;

function byteLength(str: string) {
  return new TextEncoder().encode(str).length;
}

function formatCooldown(seconds: bigint) {
  const s = Number(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${s}s`;
}

interface Props {
  onPosted: () => void;
  isPaused: boolean;
}

export function MessageInput({ onPosted, isPaused }: Props) {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  // Independent chain check — does not rely on NetworkGuard context
  const onCorrectChain = walletChainId === monadMainnet.id;
  const [text, setText] = useState("");
  const bytes = byteLength(text);
  const overLimit = bytes > MAX_BYTES;

  const { data: cooldown, refetch: refetchCooldown } = useCooldownRemaining(address);
  const { post, hash, isPending, isConfirming, isSuccess, error } = usePostMessage();
  const lastHandledHash = useRef<string | undefined>(undefined);

  // Tick cooldown down every second
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!cooldown || cooldown === 0n) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (tick > 0) refetchCooldown();
  }, [tick, refetchCooldown]);

  const onSuccess = useCallback(() => {
    setText("");
    refetchCooldown();
    onPosted();
  }, [refetchCooldown, onPosted]);

  useEffect(() => {
    if (isSuccess && hash && hash !== lastHandledHash.current) {
      lastHandledHash.current = hash;
      onSuccess();
    }
  }, [isSuccess, hash, onSuccess]);

  const inCooldown = !!cooldown && cooldown > 0n;
  // isPaused is an additional gate — cannot submit even if all other conditions are met
  const canSubmit =
    isConnected &&
    onCorrectChain &&
    !overLimit &&
    bytes > 0 &&
    !inCooldown &&
    !isPending &&
    !isConfirming &&
    !isPaused;

  // Paused banner — wall is readable but posting is blocked
  if (isPaused) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-yellow-400 text-sm font-medium">
          The wall is temporarily paused. All posts remain visible.
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <p className="text-center text-gray-500 text-sm py-3 md:py-4">
        Connect your wallet to post a message.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a short Gmonad message..."
        rows={2}
        className="w-full rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 text-white placeholder-gray-500 p-3 resize-none outline-none transition-colors min-h-[82px] md:min-h-[105px]"
      />
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs font-mono ${overLimit ? "text-red-400" : "text-gray-400"}`}>
          {bytes} / {MAX_BYTES} bytes
        </span>

        <div className="flex items-center gap-3">
          {inCooldown && (
            <span className="text-xs text-yellow-400">
              Cooldown: {formatCooldown(cooldown)}
            </span>
          )}
          <button
            onClick={() => { if (!onCorrectChain || isPaused) return; post(text); }}
            disabled={!canSubmit}
            className="px-5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending || isConfirming ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {isConnected && !onCorrectChain && (
        <p className="text-xs text-yellow-400">
          Switch to Monad Mainnet before posting.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400">
          {(error as { shortMessage?: string }).shortMessage ?? error.message}
        </p>
      )}
    </div>
  );
}
