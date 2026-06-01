import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

if (!projectId) {
  console.warn("VITE_WALLETCONNECT_PROJECT_ID is not set — WalletConnect will not work.");
}

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [
    injected({ shimDisconnect: true }),
    ...(projectId ? [walletConnect({ projectId, showQrModal: true })] : []),
  ],
  transports: {
    [monadTestnet.id]: http("https://testnet-rpc.monad.xyz"),
  },
});

export const CONTRACT_ADDRESS_V1 = (
  import.meta.env.VITE_CONTRACT_ADDRESS_V1 ?? import.meta.env.VITE_CONTRACT_ADDRESS
) as `0x${string}`;

export const CONTRACT_ADDRESS_V2 = import.meta.env
  .VITE_CONTRACT_ADDRESS_V2 as `0x${string}`;

// Legacy alias — keeps any code that still references CONTRACT_ADDRESS working
export const CONTRACT_ADDRESS = CONTRACT_ADDRESS_V1;
