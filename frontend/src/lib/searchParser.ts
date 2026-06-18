// Pure, dependency-free parser for the mainnet search box (Phase 13A).
// No React, no contract calls — it only turns raw user input into a typed query.
//
// Accepts:
//   • a full wallet address: 0x + exactly 40 hex chars
//   • a Nad ID written as "18", "#18", "nad 18", or "nad #18" (case-insensitive)
//
// Rejects: 0, negatives, decimals, leading zeros, out-of-range/huge numbers,
//          partial addresses, and any other malformed input.

export type SearchQuery =
  | { kind: "empty" }
  | { kind: "address"; address: `0x${string}` }
  | { kind: "nad"; nadId: bigint }
  | { kind: "invalid"; reason: string };

// Exact full address: 0x followed by exactly 40 hex chars.
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// Optional "nad", optional "#", then a positive integer with no leading zero.
const NAD_RE = /^(?:nad)?\s*#?\s*([1-9][0-9]*)$/i;

// Nad IDs are uint256 on-chain; reject anything above the ceiling.
const MAX_UINT256 = (1n << 256n) - 1n;

export function parseSearchInput(raw: string): SearchQuery {
  const input = raw.trim();
  if (input === "") return { kind: "empty" };

  // Full wallet address.
  if (ADDRESS_RE.test(input)) {
    return { kind: "address", address: input.toLowerCase() as `0x${string}` };
  }

  // Looks address-like (starts with 0x) but is not a complete valid address.
  if (/^0x/i.test(input)) {
    return { kind: "invalid", reason: "Enter a full address (0x + 40 hex characters)." };
  }

  // Nad ID.
  const nadMatch = input.match(NAD_RE);
  if (nadMatch) {
    const digits = nadMatch[1];
    // Guard against absurdly long inputs before BigInt parsing.
    if (digits.length > 78) {
      return { kind: "invalid", reason: "Nad ID is out of range." };
    }
    const nadId = BigInt(digits);
    if (nadId === 0n) {
      return { kind: "invalid", reason: "Nad ID must be 1 or greater." };
    }
    if (nadId > MAX_UINT256) {
      return { kind: "invalid", reason: "Nad ID is out of range." };
    }
    return { kind: "nad", nadId };
  }

  return { kind: "invalid", reason: "Enter a wallet address or a Nad ID (e.g. #18)." };
}
