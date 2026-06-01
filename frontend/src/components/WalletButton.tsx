import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import type { Connector } from "wagmi";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type WalletInfo = { name: string; icon: string };

function detectInjectedWallet(): WalletInfo | null {
  if (typeof window === "undefined") return null;
  const eth = (window as any).ethereum;
  if (!eth) return null;
  if (eth.isRabby) return { name: "Rabby", icon: "🐇" };
  if (eth.isMetaMask) return { name: "MetaMask", icon: "🦊" };
  return { name: "Browser Wallet", icon: "🔐" };
}

interface WalletOptionProps {
  icon: string;
  name: string;
  subtitle: string;
  onClick?: () => void;
  disabled?: boolean;
}

function WalletOption({ icon, name, subtitle, onClick, disabled }: WalletOptionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-4 w-full p-4 rounded-xl border text-left transition-all
        ${disabled
          ? "border-gray-700 opacity-40 cursor-not-allowed"
          : "border-purple-700 hover:border-purple-400 hover:bg-purple-900/30 cursor-pointer"
        }`}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-white font-medium text-sm">{name}</div>
        <div className="text-gray-400 text-xs">{subtitle}</div>
      </div>
    </button>
  );
}

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [injectedWallet, setInjectedWallet] = useState<WalletInfo | null>(null);

  useEffect(() => {
    setInjectedWallet(detectInjectedWallet());
  }, []);

  // Close modal automatically once wallet connects successfully
  useEffect(() => {
    if (isConnected) setOpen(false);
  }, [isConnected]);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-purple-300 font-mono">{truncate(address)}</span>
        <button
          onClick={() => disconnect()}
          className="px-4 py-1.5 rounded-lg border border-purple-500 text-purple-300 text-sm hover:bg-purple-500/20 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  const injectedConnector = connectors.find((c) => c.id === "injected");
  const wcConnector = connectors.find((c) => c.id === "walletConnect");

  function handleConnect(connector: Connector) {
    connect({ connector });
    // For WalletConnect, keep our modal open so the WC QR modal can overlay it
    // and errors remain visible. For injected wallets close immediately.
    if (connector.id !== "walletConnect") {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="whitespace-nowrap px-3 sm:px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-medium transition-colors"
      >
        Connect Wallet
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-gray-900 border border-purple-800 rounded-2xl p-6 w-80 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Connect Wallet</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white transition-colors text-2xl leading-none pb-0.5"
              >
                ×
              </button>
            </div>

            {connectError && (
              <p className="text-red-400 text-xs mb-1 break-words">
                {connectError.message}
              </p>
            )}

            <div className="flex flex-col gap-3">
              {injectedConnector ? (
                <WalletOption
                  icon={injectedWallet?.icon ?? "🦊"}
                  name={injectedWallet?.name ?? "Rabby / MetaMask"}
                  subtitle="Browser extension"
                  onClick={() => handleConnect(injectedConnector)}
                />
              ) : (
                <WalletOption
                  icon="🦊"
                  name="Rabby / MetaMask"
                  subtitle="No wallet extension detected"
                  disabled
                />
              )}

              {wcConnector ? (
                <WalletOption
                  icon="📱"
                  name="WalletConnect"
                  subtitle="Mobile & hardware wallets"
                  onClick={() => handleConnect(wcConnector)}
                />
              ) : (
                <WalletOption
                  icon="📱"
                  name="WalletConnect"
                  subtitle="Project ID not configured"
                  disabled
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
