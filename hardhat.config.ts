import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY       = process.env.PRIVATE_KEY       || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    // ─── Testnet (unchanged) ─────────────────────────────────
    monadTestnet: {
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // ─── Mainnet ─────────────────────────────────────────────
    monadMainnet: {
      url: "https://rpc.monad.xyz",
      chainId: 143,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      monadTestnet: "abc",
      monadMainnet: ETHERSCAN_API_KEY,
    },
    customChains: [
      // ─── Testnet (unchanged) ───────────────────────────────
      {
        network: "monadTestnet",
        chainId: 10143,
        urls: {
          apiURL:     "https://testnet.monadexplorer.com/api",
          browserURL: "https://testnet.monadexplorer.com",
        },
      },
      // ─── Mainnet — Etherscan v2 (primary verification) ────
      {
        network: "monadMainnet",
        chainId: 143,
        urls: {
          apiURL:     "https://api.etherscan.io/v2/api?chainid=143",
          browserURL: "https://monadscan.com",
        },
      },
    ],
  },
  // ─── Sourcify — Monad custom endpoint ──────────────────────
  sourcify: {
    enabled: true,
    apiUrl:     "https://sourcify-api-monad.blockvision.org",
    browserUrl: "https://monadvision.com",
  },
};

export default config;