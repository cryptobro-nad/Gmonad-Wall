export interface UnifiedPost {
  source: "v1" | "v2";
  id: bigint;
  nadId: bigint | null;
  text: string;
  mediaURI: string;
  mediaType: number;
  timestamp: bigint;
  hidden: boolean;
}

const ACCENTS = [
  { border: "border-purple-500/50", pin: "bg-purple-400", label: "text-purple-400" },
  { border: "border-pink-500/50",   pin: "bg-pink-400",   label: "text-pink-400"   },
  { border: "border-blue-500/50",   pin: "bg-blue-400",   label: "text-blue-400"   },
  { border: "border-emerald-500/50",pin: "bg-emerald-400",label: "text-emerald-400"},
  { border: "border-amber-500/50",  pin: "bg-amber-400",  label: "text-amber-400"  },
] as const;

const ROTATIONS = [
  "rotate-[-0.5deg]",
  "rotate-[0.3deg]",
  "rotate-[-0.3deg]",
  "rotate-[0.5deg]",
  "rotate-0",
] as const;

function timeAgo(unixSeconds: bigint) {
  const diff = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (diff < 60) return "just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(diff / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

interface Props {
  post: UnifiedPost;
  isNewest?: boolean;
}

export function MessageCard({ post, isNewest }: Props) {
  const idx = Number(post.id) % ACCENTS.length;
  const accent = ACCENTS[idx];
  const rotation = ROTATIONS[Number(post.id) % ROTATIONS.length];

  const label =
    post.source === "v1"
      ? `Post #${post.id.toString()}`
      : `Nad #${post.nadId?.toString() ?? post.id.toString()}`;

  return (
    <div
      className={`relative bg-gray-900 border-2 ${accent.border} rounded-xl p-4 pt-5 flex flex-col gap-2 ${rotation} hover:-translate-y-1 hover:shadow-xl transition-all duration-200`}
    >
      {/* pin dot */}
      <span className={`absolute -top-2 left-5 w-3 h-3 rounded-full ${accent.pin} ring-2 ring-gray-950`} />

      {/* NEW badge */}
      {isNewest && (
        <span className="absolute -top-2.5 right-4 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-purple-600 text-white uppercase">
          NEW
        </span>
      )}

      <p className="text-gray-100 text-sm leading-relaxed break-words">{post.text}</p>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className={`font-mono ${accent.label}`}>{label}</span>
        <span>{timeAgo(post.timestamp)}</span>
      </div>
    </div>
  );
}
