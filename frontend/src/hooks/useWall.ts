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

export function useCooldown() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GmonadWallCoreABI,
    functionName: "cooldown",
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

// ─── Search read hooks (Phase 13A — mainnet-only, no UI wired yet) ──────────────
// Foundation for search by wallet address or Nad ID. Reads only. Results are
// filtered for hidden posts in the later UI step via the hiddenFlags column,
// exactly like the existing wall normalization.

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Reactive read of a wallet's posts (newest-first; the contract caps at 50).
// Disabled for undefined/zero addresses so getPostsByWallet is never called for 0x0.
export function usePostsByWallet(address: `0x${string}` | undefined, limit: number) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GmonadWallCoreABI,
    functionName: "getPostsByWallet",
    args: address ? [address, BigInt(limit)] : undefined,
    chainId: monadMainnet.id,
    query: { enabled: !!address && address.toLowerCase() !== ZERO_ADDRESS },
  });
}

// Resolves a Nad ID to its owner address. A zero-address result means "No Nad found".
// Disabled for undefined or non-positive Nad IDs.
export function useOwnerOfNad(nadId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GmonadWallCoreABI,
    functionName: "ownerOfNad",
    args: nadId !== undefined ? [nadId] : undefined,
    chainId: monadMainnet.id,
    query: { enabled: nadId !== undefined && nadId > 0n },
  });
}

// Optional helper: resolves a wallet to its Nad ID (0 = none). Useful for labeling
// a searched wallet's Nad number in the later UI step.
export function useNadIdOf(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: GmonadWallCoreABI,
    functionName: "nadIdOf",
    args: address ? [address] : undefined,
    chainId: monadMainnet.id,
    query: { enabled: !!address && address.toLowerCase() !== ZERO_ADDRESS },
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

export function useSetMaxTextLength() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function setMaxTextLength(newMax: number) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: GmonadWallCoreABI,
      functionName: "setMaxTextLength",
      args: [BigInt(newMax)],
      chainId: monadMainnet.id,
    });
  }

  return { setMaxTextLength, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useSetCooldown() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function setCooldown(newCooldown: number) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: GmonadWallCoreABI,
      functionName: "setCooldown",
      args: [BigInt(newCooldown)],
      chainId: monadMainnet.id,
    });
  }

  return { setCooldown, hash, isPending, isConfirming, isSuccess, error, reset };
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
