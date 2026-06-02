import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { monadMainnet } from "../wagmiConfig";

// NetworkGuard uses wagmi's useSwitchChain instead of window.ethereum directly.
// This ensures chain-switch requests route through the active connector:
//   - WalletConnect session → switch request goes to the mobile wallet, not the desktop extension
//   - Injected (Rabby/MetaMask) → goes through window.ethereum as before
// wagmi's injected connector already handles the 4902 → wallet_addEthereumChain fallback internally.

interface Props {
  children: React.ReactNode;
}

export function NetworkGuard({ children }: Props) {
  const { isConnected, chainId, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect whether the active connector is WalletConnect so we can tailor error messages.
  const isWalletConnect = connector?.id === "walletConnect";

  async function handleSwitch() {
    setSwitching(true);
    setError(null);
    try {
      // Connector-aware: routes through WalletConnect session OR window.ethereum automatically.
      // wagmi handles the 4902 → wallet_addEthereumChain fallback for injected connectors.
      await switchChainAsync({ chainId: monadMainnet.id });
    } catch (err: any) {
      setError(
        (err as { shortMessage?: string }).shortMessage ??
        err.message ??
        "Failed to switch network"
      );
    } finally {
      setSwitching(false);
    }
  }

  if (!isConnected) return <>{children}</>;
  if (chainId === monadMainnet.id) return <>{children}</>;

  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center max-w-sm mx-auto">
      <div className="text-4xl">⚠️</div>
      <p className="text-gray-300 text-lg">
        Wrong network. Switch to{" "}
        <span className="text-purple-400 font-semibold">Monad Mainnet</span>.
      </p>
      <button
        onClick={handleSwitch}
        disabled={switching}
        className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors disabled:opacity-50"
      >
        {switching ? "Switching…" : "Switch to Monad Mainnet"}
      </button>

      {error && (
        <div className="w-full flex flex-col gap-3 text-left">
          <p className="text-red-400 text-sm">{error}</p>
          {isWalletConnect ? (
            <p className="text-gray-400 text-sm">
              Please switch to Monad Mainnet in your mobile wallet app, then reconnect.
            </p>
          ) : (
            <p className="text-gray-400 text-sm">
              Some wallets do not switch custom networks automatically.
              Add Monad Mainnet manually in your wallet, then reconnect.
            </p>
          )}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs font-mono space-y-1">
            <div><span className="text-gray-500">Network Name: </span><span className="text-gray-200">Monad Mainnet</span></div>
            <div><span className="text-gray-500">RPC URL:      </span><span className="text-gray-200">https://rpc.monad.xyz</span></div>
            <div><span className="text-gray-500">Chain ID:     </span><span className="text-gray-200">143</span></div>
            <div><span className="text-gray-500">Currency:     </span><span className="text-gray-200">MON</span></div>
            <div><span className="text-gray-500">Explorer:     </span><span className="text-gray-200">https://monadscan.com</span></div>
          </div>
        </div>
      )}

      <p className="text-gray-600 text-xs mt-2">
        Connected chain: {chainId} · Expected: {monadMainnet.id}
      </p>
    </div>
  );
}
