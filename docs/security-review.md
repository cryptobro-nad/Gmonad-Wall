# Security Review — GmonadWallCore.sol

**Date:** 2026-06-02
**Scope:** `contracts/GmonadWallCore.sol`
**Reviewer:** Internal (pre-deployment static analysis)
**Status:** No blockers found. Contract clear to proceed toward mainnet deployment.

---

## Tools and Checks

| Tool / Check | Version / Result |
|---|---|
| Slither static analyzer | 0.11.5 |
| solc (via solc-select) | 0.8.20 |
| Slither command | `slither . --hardhat-ignore-compile` |
| Hardhat test suite | 229 passing, 0 failing |
| Contracts analyzed | 9 (GmonadWallCore, GmonadWallV2, OZ Ownable, OZ Pausable, OZ Context, and 4 others) |

---

## Summary

| Severity | Count | Disposition |
|---|---|---|
| High | 0 | — |
| Medium | 0 | — |
| Low | 1 detector (multiple instances) | Accepted — see below |
| Informational | 3 detectors | Accepted / not actionable |

No high or medium severity findings were identified. All findings are low severity or informational and are either intentional design decisions or false positives from the static analyzer.

---

## Findings

### 1. `block.timestamp` — cooldown enforcement

**Detector:** `timestamp` (Low)
**Lines:** `GmonadWallCore._validatePost` (line 80), `getCooldownRemaining` (line 178)

Slither flags `block.timestamp >= lastPostTime[msg.sender] + cooldown` and `elapsed >= cooldown` as timestamp-dependent comparisons.

**Decision: Accepted.**

The cooldown is a UX rate-limiting mechanism (default 60 seconds). It is not used for randomness, financial logic, or any value-bearing decision. Miners can manipulate `block.timestamp` by approximately 15 seconds on PoW chains; on Monad (deterministic block production) this window is smaller still. A 60-second cooldown cannot be meaningfully exploited via timestamp manipulation. This pattern is standard and well-understood for UX-level rate limiting.

---

### 2. Loop bound comparisons under `timestamp` detector

**Detector:** `timestamp` (Low)
**Lines:** `getLatestPosts`, `getPostsBefore`, `getPostsByWallet` loop bounds (`i < count`, `limit < total`, etc.)

Slither's timestamp detector overgeneralizes and flags standard integer loop comparisons inside functions that also use `block.timestamp` elsewhere.

**Decision: False positive / detector overreach. Not actioned.**

These comparisons (`i < count`, `limit < total`) are pure integer arithmetic with no relationship to block time. They do not use `block.timestamp` and cannot be manipulated via timestamp. This is a known Slither detector limitation.

---

### 3. Mixed pragma versions

**Detector:** `pragma` (Informational)

> `GmonadWallCore.sol` uses exact `0.8.20` while OpenZeppelin dependency files use `^0.8.20`.

**Decision: Accepted. No action.**

`GmonadWallCore.sol` intentionally uses an exact pinned pragma (`pragma solidity 0.8.20`) as the production-safe practice. The OZ library files use `^0.8.20`, which is their standard for library compatibility. Both resolve to the same compiler version (`0.8.20`). The pragma mismatch Slither reports is between the contract and its dependencies, not a sign of an issue.

---

### 4. Solidity 0.8.20 known compiler warnings

**Detector:** `solc-version` (Informational)

Slither reports that `0.8.20` has three known compiler bugs:
- `VerbatimInvalidDeduplication`
- `FullInlinerNonExpressionSplitArgumentEvaluationOrder`
- `MissingSideEffectsOnSelectorAccess`

**Decision: Accepted. None apply to this contract.**

- `VerbatimInvalidDeduplication`: affects contracts using inline assembly with `verbatim` opcodes. `GmonadWallCore` contains no inline assembly.
- `FullInlinerNonExpressionSplitArgumentEvaluationOrder`: affects edge cases in argument evaluation order for inlined function calls. Not triggered by this contract's straightforward call patterns.
- `MissingSideEffectsOnSelectorAccess`: affects `.selector` usage. `GmonadWallCore` does not use `.selector`.

Slither emits this warning for any project using `0.8.20` regardless of whether the bugs are relevant to the specific code. They are not relevant here.

---

### 5. `Paused` / `Unpaused` events — unindexed address parameter

**Detector:** `unindexed-event-address` (Informational)
**Source:** `node_modules/@openzeppelin/contracts/utils/Pausable.sol`

> `Pausable.Paused(address)` and `Pausable.Unpaused(address)` have address parameters with no `indexed` modifier.

**Decision: Not actionable.**

These events are defined in OpenZeppelin's `Pausable.sol` library. `GmonadWallCore` inherits from OZ Pausable and cannot modify the event signatures in an external library. The unindexed `account` parameter is consistent across all OZ v5 Pausable deployments. This finding applies to the dependency, not to contract code under review.

---

## Conclusion

Slither 0.11.5 analyzed 9 contracts and produced 23 result instances across 4 detectors. All findings are low severity or informational.

- **No high findings.**
- **No medium findings.**
- **No actionable findings that require code changes.**

The single low-severity detector (`timestamp`) flags intended behavior (UX cooldown) and loop arithmetic false positives. The informational findings reflect standard OZ library patterns and the deliberate choice to pin the compiler version exactly.

`GmonadWallCore.sol` is clear to proceed toward mainnet deployment from a static analysis perspective. A professional security audit is still recommended before production launch with real user funds, as documented in the contract's unaudited disclaimer.
