import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  console.log("Network:  ", network.name);
  console.log("Chain ID: ", chainId.toString());
  console.log("Deployer: ", deployer.address);

  const Factory = await ethers.getContractFactory("GmonadWallV2");
  const wall = await Factory.deploy();
  await wall.waitForDeployment();

  const address = await wall.getAddress();
  const txHash = wall.deploymentTransaction()?.hash ?? "unknown";

  console.log("Contract: ", address);
  console.log("Tx Hash:  ", txHash);

  const deploymentInfo = {
    network: network.name,
    chainId: Number(chainId),
    contractName: "GmonadWallV2",
    contractAddress: address,
    deployer: deployer.address,
    transactionHash: txHash,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "monadTestnet-v2.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Saved:    deployments/monadTestnet-v2.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
