import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { exit } from "process";
dotenv.config();

async function main() {
  try {
    // Market ID - Set to your market ID (change if needed)
    const marketId = process.env.MARKET_ID || "1";
    // Outcome - Default to 1 (YES) but can be changed via env var
    const outcome = parseInt(process.env.OUTCOME || "1");
    
    console.log(`Settling market #${marketId} with outcome: ${outcome}`);
    
    // Contract address - adjust if your address is different
    const SEPOLIA_CONTRACT_ADDRESS = process.env.SEPOLIA_CONTRACT_ADDRESS || "0xB0b9A0F69D4B9F7a2C954b73BF0F89281d264e73";
    
    // Set up provider and wallet
    const sepoliaProvider = new ethers.providers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/NC8ECPLoaJ3SxtjqH9AVBli3wAxzWpxr"
    );
    
    if (!process.env.PRIVATE_KEY) {
      throw new Error("Missing PRIVATE_KEY in .env file");
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    const sepoliaWallet = wallet.connect(sepoliaProvider);
    
    console.log("Using address:", sepoliaWallet.address);
    
    // Check ETH balance
    const ethBalance = await sepoliaWallet.getBalance();
    console.log("ETH Balance:", ethers.utils.formatEther(ethBalance), "ETH");
    
    if (ethBalance.lt(ethers.utils.parseEther("0.2"))) {
      console.log("⚠️ Warning: Low ETH balance. You may need at least 0.2 ETH for gas and LayerZero fees.");
    }
    
    // Contract interface
    const sepoliaContract = new ethers.Contract(
      SEPOLIA_CONTRACT_ADDRESS,
      [
        "function getMarket(uint256 marketId) external view returns (uint256 _marketId, uint256 reward, uint256 bond, bytes memory questionText, uint256 verificationTime, uint256 optionCount, bool isResolved, int256 outcome, uint256 _requestTime, bool exists)",
        "function emergencySettleMarket(uint256 marketId, int256 outcome) external",
        "function sendMarketResult(uint256 marketId) external payable",
        "function owner() external view returns (address)"
      ],
      sepoliaWallet
    );
    
    // Check if caller is the owner
    const owner = await sepoliaContract.owner();
    if (owner.toLowerCase() !== sepoliaWallet.address.toLowerCase()) {
      console.log("⚠️ Warning: You are not the contract owner. Some operations may fail.");
    }
    
    // Check market status
    console.log("\nChecking market status...");
    const market = await sepoliaContract.getMarket(marketId);
    
    console.log("Market details:");
    console.log("- Market ID:", market._marketId.toString());
    console.log("- Is Resolved:", market.isResolved);
    if (market.isResolved) {
      console.log("- Current Outcome:", market.outcome.toString());
    }
    console.log("- Option Count:", market.optionCount.toString());
    
    // Validate outcome is within range of options
    if (outcome < 0 || outcome >= market.optionCount) {
      console.error(`\n⚠️ ERROR: Outcome ${outcome} is out of range. This market has ${market.optionCount} options (0 to ${market.optionCount - 1}).`);
      exit(1);
    }
    
    // If market is not resolved yet on Sepolia, we need to settle it first
    if (!market.isResolved) {
      console.log(`\nMarket is not resolved on Sepolia yet. Settling with outcome = ${outcome}...`);
      
      const settleTx = await sepoliaContract.emergencySettleMarket(marketId, outcome);
      console.log("Transaction sent:", settleTx.hash);
      console.log("Waiting for confirmation...");
      
      const receipt = await settleTx.wait();
      console.log("Transaction confirmed in block:", receipt.blockNumber);
      
      if (receipt.status === 1) {
        console.log(`Market successfully settled on Sepolia with outcome: ${outcome} ✅`);
      } else {
        throw new Error("Market settlement transaction failed");
      }
    } else if (market.outcome.toString() !== outcome.toString()) {
      console.log(`\n⚠️ WARNING: Market is already resolved with outcome ${market.outcome.toString()}, but you specified ${outcome}.`);
      
      const continueWithExisting = await promptYesNo("Do you want to continue sending the existing outcome to Flow?");
      if (!continueWithExisting) {
        console.log("Operation cancelled by user.");
        exit(0);
      }
    } else {
      console.log(`\nMarket is already resolved on Sepolia with outcome: ${market.outcome.toString()}`);
    }
    
    // Now send the result to Flow using the string format
    console.log("\nSending the result to Flow using string format...");
    
    // We need to send a high value for LayerZero fees to ensure it goes through
    const layerZeroFee = ethers.utils.parseEther("0.2"); // 0.2 ETH
    
    const sendTx = await sepoliaContract.sendMarketResult(marketId, {
      value: layerZeroFee,
      gasLimit: 1000000
    });
    
    console.log("Transaction sent:", sendTx.hash);
    console.log("LayerZero Fee:", ethers.utils.formatEther(layerZeroFee), "ETH");
    console.log("Waiting for confirmation...");
    
    const sendReceipt = await sendTx.wait();
    console.log("Transaction confirmed in block:", sendReceipt.blockNumber);
    
    if (sendReceipt.status === 1) {
      console.log("\n🎉 Success! Result has been sent to Flow");
      console.log(`Market outcome (${market.isResolved ? market.outcome.toString() : outcome}) has been sent to the Flow chain`);
      console.log("Users can now claim their winnings on the Flow contract");
      
      console.log("\nNext steps:");
      console.log(`1. Wait for the message to be processed by LayerZero (might take a few minutes)`);
      console.log(`2. Check that the market is resolved on Flow using your checkBets.ts script`);
      console.log(`3. Users can claim winnings with: npx hardhat run scripts/claimWinnings.ts`);
    } else {
      console.log("\n❌ Transaction failed");
      console.log("The transaction was included in a block but failed");
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
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