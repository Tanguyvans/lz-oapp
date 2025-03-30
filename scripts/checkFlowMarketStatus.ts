import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  try {
    // Market ID
    const marketId = process.env.MARKET_ID || "1";
    
    console.log(`Checking status of market #${marketId} on Flow...`);
    
    // Contract address
    const FLOW_CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS || "0x48C8C23092119b0FAa574C312851fEFbf389B2c8";
    
    // Set up provider and wallet
    const flowProvider = new ethers.providers.JsonRpcProvider(
      process.env.FLOW_RPC_URL || "https://testnet.evm.nodes.onflow.org"
    );
    
    // Create a contract interface
    const flowContract = new ethers.Contract(
      FLOW_CONTRACT_ADDRESS,
      [
        "function getMarketDetails(uint256 marketId) external view returns (uint256 id, string memory description, address creator, uint256 expirationDate, uint256 verificationTime, bool isResolved, uint256[] memory optionAmounts, uint256 requestTime, int256 outcome, uint8 category, string memory imageUrl, uint256 optionCount)"
      ],
      flowProvider
    );
    
    // Check market status
    const market = await flowContract.getMarketDetails(marketId);
    
    console.log("\nFlow Market details:");
    console.log("- Market ID:", market.id.toString());
    console.log("- Description:", market.description);
    console.log("- Is Resolved:", market.isResolved);
    
    if (market.isResolved) {
      console.log("- Outcome:", market.outcome.toString());
      console.log("\n✅ This market is ALREADY RESOLVED on Flow with outcome:", market.outcome.toString());
      console.log("This is why your transaction is failing - the result was already sent!");
    } else {
      console.log("\n❌ Market is NOT resolved on Flow yet.");
      console.log("We need to investigate why sending the result is failing.");
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 