// Archive hooks — testnet V1/V2 read-only access.
//
// Safety rules enforced in this file:
//   - No wagmi hooks (no useReadContract, no useWriteContract, no useAccount)
//   - No wallet connection, no network switching, no signing
//   - No imports from the mainnet contract or GmonadWallCoreABI
//   - Uses standalone viem createPublicClient — not connected to wagmi config
//   - Reads VITE_TESTNET_* env vars only — never VITE_CONTRACT_ADDRESS
//
// All hooks return read-only data. No write hooks exist in this file.

import { useState, useEffect } from "react";
import { createPublicClient, http, defineChain } from "viem";
import { GmonadWallABI } from "../abi/GmonadWall";
import { GmonadWallV2ABI } from "../abi/GmonadWallV2";

// Testnet chain definition — local to this file only.
// NOT exported. NOT added to wagmi chains. NOT used for wallet connection.
const _monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz"],
    },
  },
});

// Standalone viem public client for testnet archive reads.
// Independent of wagmi. Cannot sign transactions.
const archiveClient = createPublicClient({
  chain: _monadTestnet,
  transport: http(import.meta.env.VITE_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz"),
});

// Testnet contract addresses — from archive env vars only.
const V1_ADDRESS = (import.meta.env.VITE_TESTNET_CONTRACT_ADDRESS_V1 || "0x") as `0x${string}`;
const V2_ADDRESS = (import.meta.env.VITE_TESTNET_CONTRACT_ADDRESS_V2 || "0x") as `0x${string}`;

// ─── V1 archive hooks ────────────────────────────────────────────────────────

export function useArchiveMessageCount() {
  const [data, setData] = useState<bigint | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    archiveClient
      .readContract({ address: V1_ADDRESS, abi: GmonadWallABI, functionName: "getMessageCount" })
      .then((result) => {
        if (!cancelled) { setData(result as bigint); setIsLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setIsError(true); setIsLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  return { data, isLoading, isError };
}

export function useArchiveLatestMessages(limit: number) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    archiveClient
      .readContract({
        address: V1_ADDRESS,
        abi: GmonadWallABI,
        functionName: "getLatestMessages",
        args: [BigInt(limit)],
      })
      .then((result) => {
        if (!cancelled) { setData(result); setIsLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setIsError(true); setIsLoading(false); }
      });
    return () => { cancelled = true; };
  }, [limit]);

  return { data, isLoading, isError };
}

// ─── V2 archive hooks ────────────────────────────────────────────────────────

export function useArchivePostCountV2() {
  const [data, setData] = useState<bigint | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    archiveClient
      .readContract({ address: V2_ADDRESS, abi: GmonadWallV2ABI, functionName: "getPostCount" })
      .then((result) => {
        if (!cancelled) { setData(result as bigint); setIsLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setIsError(true); setIsLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  return { data, isLoading, isError };
}

export function useArchiveLatestPostsV2(limit: number) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    archiveClient
      .readContract({
        address: V2_ADDRESS,
        abi: GmonadWallV2ABI,
        functionName: "getLatestPosts",
        args: [BigInt(limit)],
      })
      .then((result) => {
        if (!cancelled) { setData(result); setIsLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setIsError(true); setIsLoading(false); }
      });
    return () => { cancelled = true; };
  }, [limit]);

  return { data, isLoading, isError };
}

// Imperative cursor-based pagination — called on "Load older posts" click.
export function useArchivePostsBeforeV2() {
  async function fetchBefore(beforeId: bigint, limit: number) {
    return archiveClient.readContract({
      address: V2_ADDRESS,
      abi: GmonadWallV2ABI,
      functionName: "getPostsBefore",
      args: [beforeId, BigInt(limit)],
    });
  }

  return { fetchBefore };
}
