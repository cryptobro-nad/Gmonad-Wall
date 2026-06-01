import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { GmonadWallCoreABI } from "../abi/GmonadWallCore";
import { CONTRACT_ADDRESS, monadMainnet } from "../wagmiConfig";

// All hooks in this file target the mainnet GmonadWallCore contract only.
// No testnet references. No V1/V2 contracts. Archive reads live in useArchive.ts.

// ─── Read hooks ───────────────────────────────────────────────────────────────

export function usePaused() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GmonadWallCoreABI,
    functionName: "paused",
    chainId: monadMainnet.id,
  });
}

export function usePostCount() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GmonadWallCoreABI,
    functionName: "getPostCount",
    chainId: monadMainnet.id,
  });
}

export function useNadCount() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GmonadWallCoreABI,
    functionName: "getNadCount",
    chainId: monadMainnet.id,
  });
}

export function useLatestPosts(limit: number) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GmonadWallCoreABI,
    functionName: "getLatestPosts",
    args: [BigInt(limit)],
    chainId: monadMainnet.id,
  });
}

export function useMaxTextLength() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GmonadWallCoreABI,
    functionName: "maxTextLength",
    chainId: monadMainnet.id,
  });
}

export function useCooldownRemaining(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GmonadWallCoreABI,
    functionName: "getCooldownRemaining",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
    chainId: monadMainnet.id,
  });
}

// Imperative pagination read — uses usePublicClient to avoid reactive re-fetches on every render.
export function usePostsBefore() {
  const client = usePublicClient({ chainId: monadMainnet.id });

  async function fetchBefore(beforeId: bigint, limit: number) {
    if (!client) return null;
    return client.readContract({
      address: CONTRACT_ADDRESS,
      abi: GmonadWallCoreABI,
      functionName: "getPostsBefore",
      args: [beforeId, BigInt(limit)],
    });
  }

  return { fetchBefore };
}

export function useOwner() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GmonadWallCoreABI,
    functionName: "owner",
    chainId: monadMainnet.id,
  });
}

// ─── Write hooks ──────────────────────────────────────────────────────────────

export function usePostMessage() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function post(text: string) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: GmonadWallCoreABI,
      functionName: "postMessage",
      args: [text],
      chainId: monadMainnet.id,
    });
  }

  return { post, hash, isPending, isConfirming, isSuccess, error };
}

export function useHidePost() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function hide(postId: bigint, hidden: boolean) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: GmonadWallCoreABI,
      functionName: "hidePost",
      args: [postId, hidden],
      chainId: monadMainnet.id,
    });
  }

  return { hide, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function usePause() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function pause() {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: GmonadWallCoreABI,
      functionName: "pause",
      chainId: monadMainnet.id,
    });
  }

  return { pause, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useUnpause() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function unpause() {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: GmonadWallCoreABI,
      functionName: "unpause",
      chainId: monadMainnet.id,
    });
  }

  return { unpause, hash, isPending, isConfirming, isSuccess, error, reset };
}
