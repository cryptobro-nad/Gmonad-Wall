import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  console.log("Network:  ", network.name);
  console.log("Chain ID: ", chainId.toString());
  console.log("Deployer: ", deployer.address);

  const Factory = await ethers.getContractFactory("GmonadWall");
  const wall = await Factory.deploy();
  await wall.waitForDeployment();

  const address = await wall.getAddress();
  const txHash = wall.deploymentTransaction()?.hash ?? "unknown";
  console.log("Contract: ", address);
  console.log("Tx Hash:  ", txHash);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
