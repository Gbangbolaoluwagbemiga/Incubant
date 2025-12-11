/**
 * Deployment script for Incubant contracts
 * 
 * Usage:
 *   npm run deploy:devnet
 *   npm run deploy:testnet
 * 
 * Make sure to set DEPLOYER_SECRET_KEY in your .env file
 */

import { StacksTestnet, StacksMainnet, StacksDevnet } from "@stacks/network";
import {
  AnchorMode,
  broadcastTransaction,
  makeContractDeploy,
  PostConditionMode,
  TxBroadcastResultOk,
  TxBroadcastResultRejected,
} from "@stacks/transactions";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const CONTRACTS = [
  "incubation",
  "token-stream",
  "equity-token",
  "governance",
  "mentorship",
  "staking",
];

async function deployContract(
  contractName: string,
  network: StacksTestnet | StacksMainnet | StacksDevnet,
  deployerKey: string
) {
  const contractPath = path.join(__dirname, `../contracts/${contractName}.clar`);
  const contractCode = fs.readFileSync(contractPath, "utf8");

  const transaction = await makeContractDeploy({
    contractName,
    codeBody: contractCode,
    senderKey: deployerKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 10000,
    nonce: 0, // You'll need to track nonces properly
  });

  const result = await broadcastTransaction(transaction, network);

  if ((result as TxBroadcastResultRejected).error) {
    console.error(`Failed to deploy ${contractName}:`, result);
    throw new Error(`Deployment failed for ${contractName}`);
  }

  const txId = (result as TxBroadcastResultOk).txid;
  console.log(`✅ Deployed ${contractName}`);
  console.log(`   Transaction ID: ${txId}`);
  console.log(`   Contract ID: ${network.getCoreApiUrl()}/extended/v1/tx/${txId}`);

  return txId;
}

async function main() {
  const networkType = process.env.STACKS_NETWORK || "devnet";
  const deployerKey = process.env.DEPLOYER_SECRET_KEY;

  if (!deployerKey) {
    console.error("❌ DEPLOYER_SECRET_KEY not found in .env file");
    process.exit(1);
  }

  let network: StacksTestnet | StacksMainnet | StacksDevnet;
  
  switch (networkType) {
    case "mainnet":
      network = new StacksMainnet();
      break;
    case "testnet":
      network = new StacksTestnet();
      break;
    case "devnet":
    default:
      network = new StacksDevnet({ url: process.env.STACKS_RPC_URL || "http://localhost:20443" });
      break;
  }

  console.log(`🚀 Deploying contracts to ${networkType}...`);
  console.log(`   Network URL: ${network.getCoreApiUrl()}\n`);

  const deployedContracts: Record<string, string> = {};

  for (const contract of CONTRACTS) {
    try {
      const txId = await deployContract(contract, network, deployerKey);
      deployedContracts[contract] = txId;
      // Wait a bit between deployments
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Error deploying ${contract}:`, error);
      process.exit(1);
    }
  }

  console.log("\n✅ All contracts deployed successfully!");
  console.log("\n📝 Update your .env file with these contract addresses:");
  console.log("   (Note: You'll need to get the contract addresses from the transaction IDs)");
  
  // Save deployment info
  const deploymentInfo = {
    network: networkType,
    deployedAt: new Date().toISOString(),
    contracts: deployedContracts,
  };

  fs.writeFileSync(
    path.join(__dirname, "../deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n💾 Deployment info saved to deployment.json");
}

main().catch(console.error);

