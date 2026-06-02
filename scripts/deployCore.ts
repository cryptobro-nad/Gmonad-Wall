import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ─── Allowed networks ────────────────────────────────────────────────────────
// Any other network (hardhat, localhost, unknown) is rejected before deployment.
const ALLOWED_NETWORKS = ["monadMainnet", "monadTestnet"] as const;
type AllowedNetwork = typeof ALLOWED_NETWORKS[number];

function isAllowedNetwork(name: string): name is AllowedNetwork {
  return (ALLOWED_NETWORKS as readonly string[]).includes(name);
}

// ─── Expected chain IDs per network ─────────────────────────────────────────
// Verified against the actual RPC before any gas is spent.
const EXPECTED_CHAIN_IDS: Record<AllowedNetwork, number> = {
  monadMainnet: 143,
  monadTestnet: 10143,
};

// ─── Address validation ──────────────────────────────────────────────────────
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_RE   = /^0x[0-9a-fA-F]{40}$/;

function isValidAddress(address: string | undefined): address is string {
  if (!address) return false;
  if (!ADDRESS_RE.test(address)) return false;
  if (address === ZERO_ADDRESS) return false;
  return true;
}

// ─── Deployment output filename ───────────────────────────────────────────────
function outputFilename(networkName: AllowedNetwork): string {
  if (networkName === "monadMainnet") return "monadMainnet.json";
  return "monadTestnet-core.json";
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {

  // ── Abort check 1: unsupported network (synchronous — no RPC, no gas) ────
  if (!isAllowedNetwork(network.name)) {
    console.error(`\nABORT: deployCore.ts only runs on: ${ALLOWED_NETWORKS.join(", ")}`);
    console.error(`       Current network: "${network.name}"`);
    console.error(`       No gas was spent. No contract was deployed.\n`);
    process.exitCode = 1;
    return;
  }

  const networkName = network.name as AllowedNetwork;

  // ── Abort check 2: ADMIN_OWNER_ADDRESS validation (synchronous — no RPC) ─
  //
  // monadMainnet: ADMIN_OWNER_ADDRESS is mandatory.
  //   Missing, invalid, or zero → abort before any deployment.
  //
  // monadTestnet: ADMIN_OWNER_ADDRESS is recommended but optional.
  //   Missing → warn, continue (deployer remains owner for dry-run).
  //   Set but invalid/zero → abort (bad config is never silently ignored).

  const adminOwnerEnv = process.env.ADMIN_OWNER_ADDRESS;
  const adminDefined  = !!adminOwnerEnv && adminOwnerEnv.trim().length > 0;
  const adminValid    = isValidAddress(adminOwnerEnv);

  if (networkName === "monadMainnet") {
    if (!adminValid) {
      const reason = adminDefined
        ? `"${adminOwnerEnv}" is not a valid non-zero 40-hex address.`
        : `ADMIN_OWNER_ADDRESS is not set in .env.`;
      console.error(`\nABORT: monadMainnet requires a valid ADMIN_OWNER_ADDRESS.`);
      console.error(`       ${reason}`);
      console.error(`       Use a fresh dedicated admin wallet. Not a daily wallet.`);
      console.error(`       No gas was spent. No contract was deployed.\n`);
      process.exitCode = 1;
      return;
    }
  }

  if (networkName === "monadTestnet" && adminDefined && !adminValid) {
    console.error(`\nABORT: ADMIN_OWNER_ADDRESS is set but invalid on monadTestnet.`);
    console.error(`       Value: "${adminOwnerEnv}"`);
    console.error(`       Fix the address or unset ADMIN_OWNER_ADDRESS for a no-transfer dry run.`);
    console.error(`       No gas was spent. No contract was deployed.\n`);
    process.exitCode = 1;
    return;
  }

  // ── Abort check 3: verify actual RPC chain ID before spending any gas ─────
  // Catches misconfigured hardhat.config.ts (wrong RPC pointing to the wrong chain).
  const { chainId }     = await ethers.provider.getNetwork();
  const expectedChainId = EXPECTED_CHAIN_IDS[networkName];

  console.log(`\nChain ID verification:`);
  console.log(`  Hardhat network name: ${networkName}`);
  console.log(`  Expected chain ID:    ${expectedChainId}`);
  console.log(`  Actual RPC chain ID:  ${chainId.toString()}`);

  if (Number(chainId) !== expectedChainId) {
    console.error(`\nABORT: Chain ID mismatch.`);
    console.error(`       Expected: ${expectedChainId} (${networkName})`);
    console.error(`       Actual:   ${chainId.toString()}`);
    console.error(`       Check the rpcUrls in hardhat.config.ts for ${networkName}.`);
    console.error(`       No gas was spent. No contract was deployed.\n`);
    process.exitCode = 1;
    return;
  }

  console.log(`  Chain ID confirmed ✓`);

  // ── All abort checks passed — safe to proceed ─────────────────────────────

  const [deployer] = await ethers.getSigners();

  // ── Pre-deploy summary ────────────────────────────────────────────────────
  console.log("\n=== GmonadWallCore Deployment ===");
  console.log(`Network:         ${networkName}`);
  console.log(`Chain ID:        ${chainId.toString()}`);
  console.log(`Deployer:        ${deployer.address}`);
  if (adminValid) {
    console.log(`Admin owner:     ${adminOwnerEnv}`);
    console.log(`                 (ownership will be transferred after deploy)`);
  } else {
    console.warn(`Admin owner:     NOT SET — deployer will remain owner`);
    if (networkName === "monadTestnet") {
      console.warn(`                 This is acceptable for a dry-run test.`);
      console.warn(`                 Set ADMIN_OWNER_ADDRESS before mainnet launch.`);
    }
  }
  console.log("─────────────────────────────────");

  // ── Deploy ────────────────────────────────────────────────────────────────
  console.log("\nDeploying GmonadWallCore...");
  const Factory = await ethers.getContractFactory("GmonadWallCore");
  const wall    = await Factory.deploy();
  await wall.waitForDeployment();

  const contractAddress = await wall.getAddress();
  const txHash          = wall.deploymentTransaction()?.hash ?? "unknown";

  console.log(`Contract:        ${contractAddress}`);
  console.log(`Tx Hash:         ${txHash}`);

  // ── Transfer ownership ────────────────────────────────────────────────────
  let finalOwner = deployer.address;

  if (adminValid && adminOwnerEnv) {
    console.log(`\nTransferring ownership to ${adminOwnerEnv}...`);
    const transferTx = await wall.transferOwnership(adminOwnerEnv);
    await transferTx.wait();

    finalOwner = (await wall.owner()) as string;

    if (finalOwner.toLowerCase() !== adminOwnerEnv.toLowerCase()) {
      console.error(`\nERROR: owner() mismatch after transferOwnership.`);
      console.error(`  Expected: ${adminOwnerEnv}`);
      console.error(`  Actual:   ${finalOwner}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Ownership confirmed: ${finalOwner}`);
  } else {
    console.warn(`\nWARNING: transferOwnership() was not called — deployer remains owner.`);
    if (networkName === "monadTestnet") {
      console.warn(`         Set ADMIN_OWNER_ADDRESS before the mainnet deployment.\n`);
    }
  }

  // ── Post-deploy reads ─────────────────────────────────────────────────────
  const isPaused     = await wall.paused();
  const maxTextLen   = await wall.maxTextLength();
  const cooldownSecs = await wall.cooldown();
  const postCount    = await wall.getPostCount();
  const nadCount     = await wall.getNadCount();

  console.log("\n=== Post-Deploy State ===");
  console.log(`owner():           ${finalOwner}`);
  console.log(`paused():          ${isPaused}`);
  console.log(`maxTextLength():   ${maxTextLen.toString()}`);
  console.log(`cooldown():        ${cooldownSecs.toString()}s`);
  console.log(`getPostCount():    ${postCount.toString()}`);
  console.log(`getNadCount():     ${nadCount.toString()}`);

  // ── Save deployment JSON (public data only — no keys or secrets) ──────────
  const deploymentInfo = {
    network:         networkName,
    chainId:         Number(chainId),
    contractName:    "GmonadWallCore",
    contractAddress,
    deployer:        deployer.address,
    adminOwner:      adminValid ? adminOwnerEnv : null,
    owner:           finalOwner,
    transactionHash: txHash,
    deployedAt:      new Date().toISOString(),
    paused:          isPaused,
    maxTextLength:   maxTextLen.toString(),
    cooldown:        cooldownSecs.toString(),
    postCount:       postCount.toString(),
    nadCount:        nadCount.toString(),
  };

  const outDir   = path.join(__dirname, "..", "deployments");
  const filename = outputFilename(networkName);
  const outPath  = path.join(outDir, filename);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));

  // ── Next-step instructions ────────────────────────────────────────────────
  console.log(`\nSaved:           deployments/${filename}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Copy contractAddress to VITE_CONTRACT_ADDRESS in Vercel env vars.`);
  console.log(`  2. Run: npm run verify:mainnet -- ${contractAddress}`);
  if (!adminValid) {
    console.warn(`  3. ACTION REQUIRED: transferOwnership() was NOT called.`);
    console.warn(`     Set ADMIN_OWNER_ADDRESS and redeploy, or call manually.`);
  }
  console.log("\n=== Deployment complete ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
