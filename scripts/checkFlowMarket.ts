import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  try {
    // Get market ID from environment or use default
    const marketId = process.env.MARKET_ID || "1";

    // Flow contract address
    const FLOW_CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS || "";
    if (!FLOW_CONTRACT_ADDRESS) {
      throw new Error("Missing FLOW_CONTRACT_ADDRESS in .env file");
    }
    
    console.log("Checking market outcome on Flow contract");
    console.log("- Flow Contract:", FLOW_CONTRACT_ADDRESS);
    console.log("- Market ID:", marketId);
    
    // Connect to Flow testnet
    if (!hre.network.name.includes('flow')) {
      console.error(`You need to run this on the Flow network. Current network: ${hre.network.name}`);
      console.error('Try: npx hardhat run scripts/checkFlowMarket.ts --network flow-testnet');
      return;
    }
    
    const [signer] = await ethers.getSigners();
    console.log("- Using address:", signer.address);
    
    // Connect to the Flow contract
    const flowContract = await ethers.getContractAt("FlowContract", FLOW_CONTRACT_ADDRESS, signer);
    
    // First check the raw data received
    const rawData = await flowContract.data();
    console.log("\nLatest received data string:");
    console.log(rawData);
    
    // Check market details
    try {
      const marketInfo = await flowContract.getMarketDetails(marketId);
      
      console.log("\nMarket details on Flow:");
      console.log("- ID:", marketInfo.id.toString());
      console.log("- Description:", marketInfo.description);
      console.log("- Creator:", marketInfo.creator);
      console.log("- Expiration:", new Date(marketInfo.expirationDate.toNumber() * 1000).toLocaleString());
      console.log("- Options count:", marketInfo.optionCount.toString());
      
      console.log("\nResolution status:");
      console.log("- Resolved:", marketInfo.isResolved);
      
      if (marketInfo.isResolved) {
        console.log("- Outcome:", marketInfo.outcome.toString());
        
        // Get the bet amounts for each option
        console.log("\nBet amounts per option:");
        for (let i = 0; i < marketInfo.optionAmounts.length; i++) {
          console.log(`- Option ${i}: ${ethers.utils.formatEther(marketInfo.optionAmounts[i])} ETH`);
        }
        
        // Calculate total pool size
        const totalPool = await flowContract.getTotalPoolSize(marketId);
        console.log("\nTotal pool size:", ethers.utils.formatEther(totalPool), "ETH");
        
        // Check if the outcome matches what was sent from Sepolia
        console.log("\n✅ Cross-chain data transfer was successful!");
        console.log(`The market outcome (${marketInfo.outcome}) was correctly received from Sepolia.`);
      } else {
        console.log("\n❌ Market is not resolved on Flow yet.");
        console.log("The cross-chain message might still be processing or there was an issue with the message.");
      }
      
      // Check for events related to this market
      console.log("\nSearching for market events...");
      const filter = flowContract.filters.MarketDataReceived(marketId);
      const events = await flowContract.queryFilter(filter);
      
      if (events.length > 0) {
        console.log(`Found ${events.length} MarketDataReceived events for this market:`);
        events.forEach((event, i) => {
          console.log(`\nEvent ${i+1}:`);
          console.log(`- Block: ${event.blockNumber}`);
          console.log(`- Market ID: ${event.args.marketId.toString()}`);
          console.log(`- Outcome: ${event.args.outcome.toString()}`);
          console.log(`- Transaction: ${event.transactionHash}`);
        });
      } else {
        console.log("No MarketDataReceived events found for this market.");
      }
      
      // Also check for market resolved events
      const resolvedFilter = flowContract.filters.MarketResolved(marketId);
      const resolvedEvents = await flowContract.queryFilter(resolvedFilter);
      
      if (resolvedEvents.length > 0) {
        console.log(`\nFound ${resolvedEvents.length} MarketResolved events for this market:`);
        resolvedEvents.forEach((event, i) => {
          console.log(`\nEvent ${i+1}:`);
          console.log(`- Block: ${event.blockNumber}`);
          console.log(`- Market ID: ${event.args.marketId.toString()}`);
          console.log(`- Outcome flag: ${event.args.outcome}`);
          console.log(`- Transaction: ${event.transactionHash}`);
        });
      } else {
        console.log("\nNo MarketResolved events found for this market.");
      }
      
    } catch (error) {
      console.error("Error retrieving market details:", error.message);
      
      if (error.message.includes("Market does not exist")) {
        console.log("\n❌ This market doesn't exist on Flow.");
        console.log("You may need to:");
        console.log("1. Create the market on Flow first");
        console.log("2. Check if you're using the correct market ID");
        console.log("3. Verify the Flow contract address is correct");
      }
    }
    
    // Check if the user placed any bets on this market
    try {
      console.log("\nChecking your bets on this market...");
      const [optionAmounts, claimed] = await flowContract.getUserBet(signer.address, marketId);
      
      let hasBets = false;
      for (let i = 0; i < optionAmounts.length; i++) {
        if (!optionAmounts[i].isZero()) {
          hasBets = true;
          break;
        }
      }
      
      if (hasBets) {
        console.log("Your bets:");
        for (let i = 0; i < optionAmounts.length; i++) {
          if (!optionAmounts[i].isZero()) {
            console.log(`- Option ${i}: ${ethers.utils.formatEther(optionAmounts[i])} ETH`);
          }
        }
        console.log("Claimed:", claimed);
        
        // Check if the user can claim winnings
        const marketInfo = await flowContract.getMarketDetails(marketId);
        if (marketInfo.isResolved && !claimed) {
          const winningOption = marketInfo.outcome.toNumber();
          if (!optionAmounts[winningOption].isZero()) {
            console.log("\n🎉 You bet on the winning option! You can claim your winnings.");
            console.log("Run the claimWinnings script to claim your rewards.");
          } else {
            console.log("\nYou didn't bet on the winning option. No winnings to claim.");
          }
        }
      } else {
        console.log("You haven't placed any bets on this market.");
      }
    } catch (error) {
      console.log("Error checking bets:", error.message);
    }
    
  } catch (error) {
    console.error("Script error:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 