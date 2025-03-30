import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { exit } from "process";
dotenv.config();

async function main() {
  try {
    // Get market ID from environment or use default
    const marketId = process.env.MARKET_ID || "2";

    // Sepolia contract address
    const SEPOLIA_CONTRACT_ADDRESS = process.env.SEPOLIA_CONTRACT_ADDRESS || "";
    if (!SEPOLIA_CONTRACT_ADDRESS) {
      throw new Error("Missing SEPOLIA_CONTRACT_ADDRESS in .env file");
    }
    
    // Set up the provider
    const sepoliaProvider = new ethers.providers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/NC8ECPLoaJ3SxtjqH9AVBli3wAxzWpxr"
    );
    
    // Create wallet
    if (!process.env.PRIVATE_KEY) {
      throw new Error("Missing PRIVATE_KEY in .env file");
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    const sepoliaWallet = wallet.connect(sepoliaProvider);
    
    console.log("Settling Market:");
    console.log("- Using address:", sepoliaWallet.address);
    console.log("- Market ID:", marketId);
    
    // Contract interface - simplified to just what we need
    const sepoliaContract = new ethers.Contract(
      SEPOLIA_CONTRACT_ADDRESS,
      [
        "function settleMarket(uint256 marketId)",
        "function getMarket(uint256 marketId) external view returns (uint256 _marketId, uint256 reward, uint256 bond, bytes memory questionText, uint256 verificationTime, uint256 optionCount, bool isResolved, int256 outcome, uint256 _requestTime, bool exists)"
      ],
      sepoliaWallet
    );
    
    // Check if market exists and isn't already resolved
    try {
      const marketInfo = await sepoliaContract.getMarket(marketId);
      console.log("Market found with ID:", marketId);
      
      if (marketInfo.isResolved) {
        console.log("Market is already resolved with outcome:", marketInfo.outcome.toString());
        return;
      }
      
      if (marketInfo._requestTime.toString() === "0") {
        console.log("Error: Settlement has not been requested yet");
        return;
      }
    } catch (error) {
      console.log("Error checking market:", error.message);
      return;
    }
    
    // Settle the market
    console.log("Settling market...");
    
    try {
      const tx = await sepoliaContract.settleMarket(marketId, {
        gasLimit: 500000
      });
      
      console.log("Transaction sent: " + tx.hash);
      console.log("Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log("✅ Market settled successfully in block: " + receipt.blockNumber);
      console.log("Transaction hash:", receipt.transactionHash);
      
      // Try to get the updated market details
      try {
        const updatedMarket = await sepoliaContract.getMarket(marketId);
        console.log("Market is now resolved:", updatedMarket.isResolved);
        console.log("Final outcome:", updatedMarket.outcome.toString());
      } catch (error) {
        console.log("Could not get updated market details");
      }
    } catch (error) {
      console.log("❌ Error settling market:", error.message);
    }
    
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Helper function to prompt for yes/no
async function promptYesNo(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    readline.question(`${question} (y/N): `, (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 