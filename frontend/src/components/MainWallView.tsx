// MainWallView — rendered only on the main wall route (not on archive, not on admin).
// Isolates usePaused() so the archive route never triggers mainnet contract reads.
import { useState } from "react";
import { NetworkGuard } from "./NetworkGuard";
import { MessageInput } from "./MessageInput";
import { MessageWall } from "./MessageWall";
import { usePaused } from "../hooks/useWall";

export function MainWallView() {
  const [refreshSignal, setRefreshSignal] = useState(0);

  // usePaused() lives here, not in App, so it is never called on /#archive.
  const { data: isPausedData } = usePaused();
  const isPaused = isPausedData === true;

  return (
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
          Share what's on your mind. The wall won't judge.
        </p>
      </section>

      {/* Composer */}
      <div className="max-w-3xl mx-auto px-4 pb-2">
        <NetworkGuard>
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 md:p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Write on the wall
            </h2>
            <MessageInput
              onPosted={() => setRefreshSignal((n) => n + 1)}
              isPaused={isPaused}
            />
          </section>
        </NetworkGuard>
      </div>

      {/* Wall */}
      <div className="max-w-6xl mx-auto px-4 pb-6 pt-2">
        <MessageWall refreshSignal={refreshSignal} />
      </div>

      {/* Archive link — subtle, no wallet required */}
      <div className="text-center pb-6">
        <a
          href="#archive"
          className="text-[10px] text-gray-700 hover:text-gray-500 transition-colors"
        >
          testnet archive →
        </a>
      </div>
    </>
  );
}
