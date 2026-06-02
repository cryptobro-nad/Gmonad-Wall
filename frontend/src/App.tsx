import { useEffect, useState } from "react";
import { WalletButton } from "./components/WalletButton";
import { NetworkGuard } from "./components/NetworkGuard";
import { AdminPage } from "./components/AdminPage";
import { ArchiveWall } from "./components/ArchiveWall";
import { MainWallView } from "./components/MainWallView";

// Fix 4: usePaused() is NOT called here.
// It lives inside MainWallView, which is only rendered on the main wall route.
// ArchiveWall never triggers mainnet contract reads.

export function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const isAdmin   = hash === "#admin";
  const isArchive = hash === "#archive";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight whitespace-nowrap shrink-0">
            <img
              src="/gmonad-wall-mark.png"
              alt="Gmonad Wall logo"
              className="h-7 w-auto"
              draggable={false}
            />
            <span>
              <span className="text-white">Gmonad</span>
              <span className="text-purple-400"> Wall</span>
            </span>
          </span>

          {/* Fix 3: archive route hides Connect Wallet and shows a read-only badge instead.
              Main wall and admin retain the full wallet button. */}
          {isArchive ? (
            <span className="px-2.5 py-1 rounded text-[10px] font-semibold tracking-wider uppercase bg-gray-800 text-gray-500 border border-gray-700 whitespace-nowrap">
              Testnet Archive
            </span>
          ) : (
            <div className="flex flex-col items-center gap-0.5 min-w-0">
              <WalletButton />
              <span className="flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Monad Mainnet
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="overflow-x-hidden">
        {isAdmin ? (
          // Fix 2: admin route wrapped in NetworkGuard — admin actions blocked on wrong chain.
          // Not connected → NetworkGuard passes through → AdminPage shows "Connect wallet".
          // Wrong chain → NetworkGuard shows switch-to-mainnet prompt before admin renders.
          // Mainnet → NetworkGuard passes through → AdminPage shows owner check.
          <NetworkGuard>
            <AdminPage />
          </NetworkGuard>
        ) : isArchive ? (
          // Fix 4: ArchiveWall renders with no mainnet hook calls from this level.
          <ArchiveWall />
        ) : (
          // Fix 4: MainWallView owns usePaused() and refreshSignal internally.
          <MainWallView />
        )}

        {/* Admin back link */}
        {isAdmin && (
          <div className="text-center pb-6 pt-2">
            <a href="#" className="text-[10px] text-gray-700 hover:text-gray-500 transition-colors">
              ← wall
            </a>
          </div>
        )}

        {/* Archive back link */}
        {isArchive && (
          <div className="text-center pb-6 pt-2">
            <a href="#" className="text-[10px] text-gray-700 hover:text-gray-500 transition-colors">
              ← wall
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
