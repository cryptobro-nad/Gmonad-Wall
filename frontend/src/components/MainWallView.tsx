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
      {/* Subtitle */}
      <p className="max-w-3xl mx-auto px-4 pt-2 pb-2 text-center text-sm text-gray-300 leading-relaxed">
        Share what&apos;s on your mind.{" "}
        <span className="text-purple-400/80">The wall won&apos;t judge.</span>
      </p>

      {/* Composer */}
      <div className="max-w-3xl mx-auto px-4 pb-2">
        <NetworkGuard>
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 md:p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
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

    </>
  );
}
