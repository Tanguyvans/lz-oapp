import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  try {
    // Get parameters from environment or set defaults
    const marketId = process.env.MARKET_ID || "3";
    const option = process.env.OPTION || "1"; // 0=No, 1=Yes, or other options if available
    const amount = process.env.AMOUNT || "0.01"; // ETH to bet

    // Flow contract address (from README)
    const FLOW_CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS || "";
    
    // Set up the provider for Flow
    const flowProvider = new ethers.providers.JsonRpcProvider(
      "https://testnet.evm.nodes.onflow.org"
    );
    
    // Create wallet using private key
    if (!process.env.PRIVATE_KEY) {
      throw new Error("Missing PRIVATE_KEY in .env file");
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    const flowWallet = wallet.connect(flowProvider);
    
    console.log("Placing Bet:");
    console.log("- Using address:", flowWallet.address);
    console.log("- Market ID:", marketId);
    console.log("- Option:", option, getOptionName(parseInt(option)));
    console.log("- Amount:", amount, "ETH");
    
    // Check ETH balance
    const balance = await flowWallet.getBalance();
    console.log("- Current balance:", ethers.utils.formatEther(balance), "ETH");
    
    const betAmount = ethers.utils.parseEther(amount);
    if (balance.lt(betAmount)) {
      throw new Error(`Insufficient balance. You have ${ethers.utils.formatEther(balance)} ETH but trying to bet ${amount} ETH`);
    }
    
    // Contract interface
    const flowContract = new ethers.Contract(
      FLOW_CONTRACT_ADDRESS,
      [
        "function placeBet(uint256 marketId, uint256 optionIndex) external payable",
        "function getMarketDetails(uint256 marketId) external view returns (uint256 id, string memory description, address creator, uint256 expirationDate, uint256 verificationTime, bool isResolved, uint256[] memory optionAmounts, uint256 requestTime, int256 outcome, uint8 category, string memory imageUrl, uint256 optionCount)",
        "function getUserBet(address user, uint256 marketId) external view returns (uint256[] memory optionAmounts, bool claimed)",
        "function getTotalPoolSize(uint256 marketId) external view returns (uint256)"
      ],
      flowWallet
    );
    
    // Get market details to validate the bet
    console.log("\nChecking market details...");
    const market = await flowContract.getMarketDetails(marketId);
    
    console.log("Market:", market.description);
    console.log("Expiration:", new Date(market.expirationDate.toNumber() * 1000).toISOString());
    console.log("Is Resolved:", market.isResolved);
    console.log("Option Count:", market.optionCount.toString());
    
    // Check if market is valid for betting
    if (market.isResolved) {
      throw new Error("Cannot bet on a resolved market");
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime >= market.expirationDate) {
      throw new Error(`Market has expired on ${new Date(market.expirationDate.toNumber() * 1000).toISOString()}`);
    }
    
    if (parseInt(option) >= market.optionCount) {
      throw new Error(`Invalid option index. Market has ${market.optionCount} options (0 to ${market.optionCount - 1})`);
    }
    
    // Check existing bets
    const userBet = await flowContract.getUserBet(flowWallet.address, marketId);
    console.log("\nYour current bets on this market:");
    
    let hasPreviousBets = false;
    for (let i = 0; i < userBet.optionAmounts.length; i++) {
      if (userBet.optionAmounts[i].gt(0)) {
        console.log(`- Option ${i} (${getOptionName(i)}): ${ethers.utils.formatEther(userBet.optionAmounts[i])} ETH`);
        hasPreviousBets = true;
      }
    }
    
    if (!hasPreviousBets) {
      console.log("None yet");
    }
    
    // Get pool size
    const poolSize = await flowContract.getTotalPoolSize(marketId);
    console.log("\nCurrent pool size:", ethers.utils.formatEther(poolSize), "ETH");
    
    // Place bet
    console.log("\nPlacing bet...");
    const tx = await flowContract.placeBet(marketId, option, {
      value: betAmount,
      gasLimit: 300000
    });
    
    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    
    // Check updated bets
    const updatedUserBet = await flowContract.getUserBet(flowWallet.address, marketId);
    console.log("\nYour updated bets on this market:");
    
    for (let i = 0; i < updatedUserBet.optionAmounts.length; i++) {
      if (updatedUserBet.optionAmounts[i].gt(0)) {
        console.log(`- Option ${i} (${getOptionName(i)}): ${ethers.utils.formatEther(updatedUserBet.optionAmounts[i])} ETH`);
      }
    }
    
    // Check updated pool size
    const updatedPoolSize = await flowContract.getTotalPoolSize(marketId);
    console.log("\nUpdated pool size:", ethers.utils.formatEther(updatedPoolSize), "ETH");
    
    console.log("\n✅ Bet placed successfully!");
    console.log("When the market is resolved and if your option wins, you can claim your winnings.");
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.error) {
      console.error("Internal error:", error.error.message);
    }
    if (error.transaction) {
      console.error("\nTransaction details:");
      console.error("- To:", error.transaction.to);
      if (error.transaction.value) {
        console.error("- Value:", ethers.utils.formatEther(error.transaction.value), "ETH");
      }
      if (error.transaction.gasLimit) {
        console.error("- Gas limit:", error.transaction.gasLimit.toString());
      }
    }
    process.exit(1);
  }
}

// Helper function to get option name (this is just a basic example)
function getOptionName(optionIndex: number): string {
  // This is a simplified example - you would customarily get this from the market details
  // The options are usually ["No", "Yes"] for a binary market
  const options = ["No", "Yes", "Option 2", "Option 3", "Option 4"];
  return options[optionIndex] || `Option ${optionIndex}`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 