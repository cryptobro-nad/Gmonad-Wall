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
