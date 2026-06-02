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

  // ── 1. Network abort check (synchronous — no gas spent) ─────────────────
  // Must happen before any contract factory or provider call.
  if (!isAllowedNetwork(network.name)) {
    console.error(`\nABORT: deployCore.ts only runs on: ${ALLOWED_NETWORKS.join(", ")}`);
    console.error(`       Current network: "${network.name}"`);
    console.error(`       No gas was spent. No contract was deployed.\n`);
    process.exitCode = 1;
    return;
  }

  const networkName = network.name as AllowedNetwork;

  // ── 2. Read environment ──────────────────────────────────────────────────
  const { chainId }   = await ethers.provider.getNetwork();
  const [deployer]    = await ethers.getSigners();
  const adminOwnerEnv = process.env.ADMIN_OWNER_ADDRESS;
  const hasAdmin      = isValidAddress(adminOwnerEnv);

  // ── 3. Pre-deploy summary ─────────────────────────────────────────────────
  console.log("\n=== GmonadWallCore Deployment ===");
  console.log(`Network:         ${networkName}`);
  console.log(`Chain ID:        ${chainId.toString()}`);
  console.log(`Deployer:        ${deployer.address}`);
  if (hasAdmin) {
    console.log(`Admin owner:     ${adminOwnerEnv}`);
    console.log(`                 (ownership will be transferred after deploy)`);
  } else {
    console.warn(`Admin owner:     NOT SET`);
    console.warn(`                 Deployer will remain owner after deploy.`);
    console.warn(`                 Set ADMIN_OWNER_ADDRESS in .env before mainnet launch.`);
  }
  console.log("─────────────────────────────────");

  // ── 4. Deploy ─────────────────────────────────────────────────────────────
  console.log("\nDeploying GmonadWallCore...");
  const Factory = await ethers.getContractFactory("GmonadWallCore");
  const wall    = await Factory.deploy();
  await wall.waitForDeployment();

  const contractAddress = await wall.getAddress();
  const txHash          = wall.deploymentTransaction()?.hash ?? "unknown";

  console.log(`Contract:        ${contractAddress}`);
  console.log(`Tx Hash:         ${txHash}`);

  // ── 5. Transfer ownership ─────────────────────────────────────────────────
  let finalOwner = deployer.address;

  if (hasAdmin && adminOwnerEnv) {
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
    console.warn(`\nWARNING: No ADMIN_OWNER_ADDRESS — deployer remains owner.`);
    console.warn(`         Call transferOwnership() manually before mainnet launch.\n`);
  }

  // ── 6. Post-deploy reads ──────────────────────────────────────────────────
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

  // ── 7. Save deployment JSON (public data only — no keys or secrets) ───────
  const deploymentInfo = {
    network:         networkName,
    chainId:         Number(chainId),
    contractName:    "GmonadWallCore",
    contractAddress,
    deployer:        deployer.address,
    adminOwner:      hasAdmin ? adminOwnerEnv : null,
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

  // ── 8. Next-step instructions ─────────────────────────────────────────────
  console.log(`\nSaved:           deployments/${filename}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Copy contractAddress to VITE_CONTRACT_ADDRESS in Vercel env vars.`);
  console.log(`  2. Run: npm run verify:mainnet -- ${contractAddress}`);
  if (!hasAdmin) {
    console.warn(`  3. ACTION REQUIRED: transferOwnership() was NOT called.`);
    console.warn(`     Set ADMIN_OWNER_ADDRESS and redeploy, or call manually.`);
  }
  console.log("\n=== Deployment complete ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
