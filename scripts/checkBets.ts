import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  try {
    // Get parameters from environment or set defaults
    const address = process.env.ADDRESS || ""; // If empty, will use the wallet address
    
    // Flow contract address
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
    
    // Determine which address to check
    const addressToCheck = address || flowWallet.address;
    
    console.log("Checking Bets:");
    console.log("- For address:", addressToCheck);
    
    // Contract interface
    const flowContract = new ethers.Contract(
      FLOW_CONTRACT_ADDRESS,
      [
        "function getAllMarketIds() external view returns (uint256[] memory)",
        "function getMarketDetails(uint256 marketId) external view returns (uint256 id, string memory description, address creator, uint256 expirationDate, uint256 verificationTime, bool isResolved, uint256[] memory optionAmounts, uint256 requestTime, int256 outcome, uint8 category, string memory imageUrl, uint256 optionCount)",
        "function getUserBet(address user, uint256 marketId) external view returns (uint256[] memory optionAmounts, bool claimed)",
        "function getTotalPoolSize(uint256 marketId) external view returns (uint256)"
      ],
      flowProvider
    );
    
    // Get all market IDs
    console.log("\nRetrieving all markets...");
    const marketIds = await flowContract.getAllMarketIds();
    console.log(`Found ${marketIds.length} markets`);
    
    let activeBets = 0;
    let totalBetAmount = ethers.BigNumber.from(0);
    let potentialWinnings = ethers.BigNumber.from(0);
    
    console.log("\n=== ACTIVE BETS ===");
    
    // Check each market
    for (const marketId of marketIds) {
      try {
        const market = await flowContract.getMarketDetails(marketId);
        const userBet = await flowContract.getUserBet(addressToCheck, marketId);
        
        let hasBets = false;
        let userTotalBet = ethers.BigNumber.from(0);
        
        for (let i = 0; i < userBet.optionAmounts.length; i++) {
          if (userBet.optionAmounts[i].gt(0)) {
            hasBets = true;
            userTotalBet = userTotalBet.add(userBet.optionAmounts[i]);
          }
        }
        
        if (hasBets) {
          activeBets++;
          totalBetAmount = totalBetAmount.add(userTotalBet);
          
          // Get market information
          const expirationDate = new Date(market.expirationDate.toNumber() * 1000);
          const isExpired = Date.now() > expirationDate.getTime();
          const poolSize = await flowContract.getTotalPoolSize(marketId);
          
          // Calculate status
          let status = "";
          if (market.isResolved) {
            if (userBet.claimed) {
              status = "CLAIMED";
            } else {
              if (market.outcome >= 0 && userBet.optionAmounts[market.outcome].gt(0)) {
                status = "WON (UNCLAIMED)";
              } else {
                status = "LOST";
              }
            }
          } else if (isExpired) {
            status = "PENDING RESOLUTION";
          } else {
            status = "ACTIVE";
          }
          
          console.log(`\nMarket #${marketId}: ${market.description}`);
          console.log(`Status: ${status}`);
          console.log(`Expiration: ${expirationDate.toISOString()}`);
          console.log(`Total Pool: ${ethers.utils.formatEther(poolSize)} ETH`);
          console.log("Your Bets:");
          
          for (let i = 0; i < userBet.optionAmounts.length; i++) {
            if (userBet.optionAmounts[i].gt(0)) {
              const optionName = getOptionName(i, market.optionCount.toNumber());
              console.log(`- ${optionName}: ${ethers.utils.formatEther(userBet.optionAmounts[i])} ETH`);
              
              // Calculate potential winnings (simplified version)
              if (!market.isResolved && !isExpired) {
                const totalOnOption = market.optionAmounts[i];
                const remainingPool = poolSize.sub(totalOnOption);
                
                if (totalOnOption.gt(0)) {
                  const winShare = userBet.optionAmounts[i].mul(remainingPool).div(totalOnOption);
                  const potentialWin = userBet.optionAmounts[i].add(winShare);
                  console.log(`  Potential Win: ~${ethers.utils.formatEther(potentialWin)} ETH (if this option wins)`);
                }
              }
            }
          }
          
          // If market is resolved and user won, calculate actual winnings
          if (market.isResolved && market.outcome >= 0 && userBet.optionAmounts[market.outcome].gt(0) && !userBet.claimed) {
            const winningOption = market.outcome.toNumber();
            const totalWinningAmount = market.optionAmounts[winningOption];
            let totalLosingAmount = ethers.BigNumber.from(0);
            
            for (let i = 0; i < market.optionCount.toNumber(); i++) {
              if (i !== winningOption) {
                totalLosingAmount = totalLosingAmount.add(market.optionAmounts[i]);
              }
            }
            
            let winnings;
            if (totalLosingAmount.gt(0)) {
              winnings = userBet.optionAmounts[winningOption].add(
                userBet.optionAmounts[winningOption].mul(totalLosingAmount).div(totalWinningAmount)
              );
            } else {
              winnings = userBet.optionAmounts[winningOption];
            }
            
            console.log(`\n🏆 UNCLAIMED WINNINGS: ${ethers.utils.formatEther(winnings)} ETH`);
            console.log(`   To claim, run: MARKET_ID=${marketId} npx hardhat run scripts/claimWinnings.ts`);
            
            potentialWinnings = potentialWinnings.add(winnings);
          }
        }
      } catch (error) {
        console.error(`Error checking market ${marketId}:`, error.message);
      }
    }
    
    // Summary
    console.log("\n=== SUMMARY ===");
    console.log(`Active Markets: ${activeBets}`);
    console.log(`Total Bet Amount: ${ethers.utils.formatEther(totalBetAmount)} ETH`);
    
    if (potentialWinnings.gt(0)) {
      console.log(`Unclaimed Winnings: ${ethers.utils.formatEther(potentialWinnings)} ETH`);
    }
    
    if (activeBets === 0) {
      console.log("No active bets found for this address.");
    }
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.error) {
      console.error("Internal error:", error.error.message);
    }
    process.exit(1);
  }
}

// Helper function to get option name
function getOptionName(optionIndex: number, optionCount: number): string {
  // For binary markets (Yes/No)
  if (optionCount === 2) {
    return optionIndex === 0 ? "No" : "Yes";
  }
  
  // For markets with more options
  const options = ["No", "Yes", "Option 2", "Option 3", "Option 4", "Option 5"];
  return options[optionIndex] || `Option ${optionIndex}`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 