import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { GmonadWallABI } from "../abi/GmonadWall";
import { GmonadWallV2ABI } from "../abi/GmonadWallV2";
import { CONTRACT_ADDRESS_V1, CONTRACT_ADDRESS_V2, monadTestnet } from "../wagmiConfig";

// ─── V1 hooks (read-only) ────────────────────────────────────────────────────

export function useMessageCount() {
  return useReadContract({
    address: CONTRACT_ADDRESS_V1,
    abi: GmonadWallABI,
    functionName: "getMessageCount",
    chainId: monadTestnet.id,
  });
}

export function useLatestMessages(limit: number) {
  return useReadContract({
    address: CONTRACT_ADDRESS_V1,
    abi: GmonadWallABI,
    functionName: "getLatestMessages",
    args: [BigInt(limit)],
    chainId: monadTestnet.id,
  });
}

// ─── V2 hooks ────────────────────────────────────────────────────────────────

export function usePostCountV2() {
  return useReadContract({
    address: CONTRACT_ADDRESS_V2,
    abi: GmonadWallV2ABI,
    functionName: "getPostCount",
    chainId: monadTestnet.id,
  });
}

export function useLatestPostsV2(limit: number) {
  return useReadContract({
    address: CONTRACT_ADDRESS_V2,
    abi: GmonadWallV2ABI,
    functionName: "getLatestPosts",
    args: [BigInt(limit)],
    chainId: monadTestnet.id,
  });
}

export function useCooldownRemainingV2(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS_V2,
    abi: GmonadWallV2ABI,
    functionName: "getCooldownRemaining",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
    chainId: monadTestnet.id,
  });
}

export function usePostsBeforeV2() {
  const client = usePublicClient({ chainId: monadTestnet.id });

  async function fetchBefore(beforeId: bigint, limit: number) {
    if (!client) return null;
    return client.readContract({
      address: CONTRACT_ADDRESS_V2,
      abi: GmonadWallV2ABI,
      functionName: "getPostsBefore",
      args: [beforeId, BigInt(limit)],
    });
  }

  return { fetchBefore };
}

export function useNadCountV2() {
  return useReadContract({
    address: CONTRACT_ADDRESS_V2,
    abi: GmonadWallV2ABI,
    functionName: "getNadCount",
    chainId: monadTestnet.id,
  });
}

export function useOwnerV2() {
  return useReadContract({
    address: CONTRACT_ADDRESS_V2,
    abi: GmonadWallV2ABI,
    functionName: "owner",
    chainId: monadTestnet.id,
  });
}

export function useHidePostV2() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function hide(postId: bigint, hidden: boolean) {
    writeContract({
      address: CONTRACT_ADDRESS_V2,
      abi: GmonadWallV2ABI,
      functionName: "hidePost",
      args: [postId, hidden],
      chainId: monadTestnet.id,
    });
  }

  return { hide, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function usePostMessageV2() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function post(text: string) {
    writeContract({
      address: CONTRACT_ADDRESS_V2,
      abi: GmonadWallV2ABI,
      functionName: "postMessage",
      args: [text],
      chainId: monadTestnet.id,
    });
  }

  return { post, hash, isPending, isConfirming, isSuccess, error };
}
