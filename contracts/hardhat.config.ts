import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const RAW_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const PRIVATE_KEY = RAW_PRIVATE_KEY.trim().replace(/^"|"$/g, "").replace(/^0x/i, "");
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";

function isValidPrivateKeyHex(v: string): boolean {
  return v.length === 64 && /^[0-9a-fA-F]+$/.test(v);
}

const ACCOUNTS = isValidPrivateKeyHex(PRIVATE_KEY) ? [`0x${PRIVATE_KEY}`] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./src",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    bsc: {
      url: "https://bsc-dataseed1.binance.org",
      chainId: 56,
      accounts: ACCOUNTS,
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: ACCOUNTS,
    },
  },
  etherscan: {
    apiKey: BSCSCAN_API_KEY,
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
