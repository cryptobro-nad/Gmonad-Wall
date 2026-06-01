import { useEffect, useState } from "react";
import { WalletButton } from "./components/WalletButton";
import { NetworkGuard } from "./components/NetworkGuard";
import { MessageInput } from "./components/MessageInput";
import { MessageWall } from "./components/MessageWall";
import { AdminPage } from "./components/AdminPage";

export function App() {
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const isAdmin = hash === "#admin";

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
          <div className="flex flex-col items-end gap-0.5 min-w-0">
            <WalletButton />
            <span className="flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              Monad Testnet
            </span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="overflow-x-hidden">
        {isAdmin ? (
          <AdminPage />
        ) : (
          <>
            {/* Hero */}
            <section className="max-w-3xl mx-auto px-4 pt-3 pb-2 text-center md:pt-4 md:pb-3">
              <h1
                className="leading-tight text-white mb-1.5"
                style={{
                  fontFamily: "'Bebas Neue', 'Arial Narrow', sans-serif",
                  fontSize: "clamp(24px, 5.5vw, 38px)",
                  letterSpacing: "0.04em",
                }}
              >
                Leave your mark on{" "}
                <span className="text-purple-400">Monad</span>
              </h1>
              <p className="text-xs text-gray-500 leading-relaxed">
                One wallet. One message. One piece of Monad community history.
              </p>
            </section>

            {/* Composer */}
            <div className="max-w-3xl mx-auto px-4 pb-2">
              <NetworkGuard>
                <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 md:p-5">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Write on the wall
                  </h2>
                  <p className="text-xs text-gray-600 mb-3">
                    Public on Monad testnet. Keep it short and fun.
                  </p>
                  <MessageInput onPosted={() => setRefreshSignal((n) => n + 1)} />
                </section>
              </NetworkGuard>
            </div>

            {/* Wall */}
            <div className="max-w-6xl mx-auto px-4 pb-6 pt-2">
              <MessageWall refreshSignal={refreshSignal} />
            </div>
          </>
        )}

        {/* Admin back link — only shown on admin page */}
        {isAdmin && (
          <div className="text-center pb-6 pt-2">
            <a
              href="#"
              className="text-[10px] text-gray-700 hover:text-gray-500 transition-colors"
            >
              ← wall
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
