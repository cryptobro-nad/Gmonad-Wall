import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { defineChain } from "viem";

// ─── Monad Mainnet ───────────────────────────────────────────────────────────
// Only chain in the wagmi config. Testnet is NOT included here.
// Testnet access lives exclusively in hooks/useArchive.ts (read-only).
export const monadMainnet = defineChain({
  id: 143,
  name: "Monad Mainnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Monadscan",
      url: "https://monadscan.com",
    },
  },
});

// ─── WalletConnect ───────────────────────────────────────────────────────────

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

if (!projectId) {
  console.warn("VITE_WALLETCONNECT_PROJECT_ID is not set — WalletConnect will not work.");
}

// ─── Wagmi config ────────────────────────────────────────────────────────────

export const wagmiConfig = createConfig({
  chains: [monadMainnet],
  connectors: [
    injected({ shimDisconnect: true }),
    ...(projectId ? [walletConnect({ projectId, showQrModal: true })] : []),
  ],
  transports: {
    [monadMainnet.id]: http("https://rpc.monad.xyz"),
  },
});

// ─── Mainnet contract address ─────────────────────────────────────────────────
// Reads from VITE_CONTRACT_ADDRESS only.
// Testnet addresses live in useArchive.ts — never imported from here.
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}`;

// ─── Contract readiness guard ─────────────────────────────────────────────────
// Returns true only when CONTRACT_ADDRESS is a valid, non-zero 40-hex address.
// Zero address (placeholder) and missing/malformed values are treated as not ready.
// Use this to disable write buttons and avoid wallet prompts before deployment.
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_RE   = /^0x[0-9a-fA-F]{40}$/;

export function isContractReady(address: string | undefined): boolean {
  if (!address) return false;
  if (!ADDRESS_RE.test(address)) return false;
  if (address === ZERO_ADDRESS) return false;
  return true;
}

export const CONTRACT_CONFIGURED = isContractReady(import.meta.env.VITE_CONTRACT_ADDRESS);
