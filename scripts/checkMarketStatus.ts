import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  try {
    // Get market ID from environment or use default
    const marketId = process.env.MARKET_ID || "1";
    
    console.log(`Checking market #${marketId} status...`);
    
    // Contract address
    const SEPOLIA_CONTRACT_ADDRESS = "0x607eA3369d0d504103D18B7fE5774EE144aA1bBa";
    
    // Set up the provider for Sepolia
    const sepoliaProvider = new ethers.providers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/NC8ECPLoaJ3SxtjqH9AVBli3wAxzWpxr"
    );
    
    // Create wallet using private key
    if (!process.env.PRIVATE_KEY) {
      throw new Error("Missing PRIVATE_KEY in .env file");
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    const sepoliaWallet = wallet.connect(sepoliaProvider);
    
    // Contract interface
    const sepoliaContract = new ethers.Contract(
      SEPOLIA_CONTRACT_ADDRESS,
      [
        "function getMarket(uint256 marketId) external view returns (uint256 _marketId, uint256 reward, uint256 bond, bytes memory questionText, uint256 verificationTime, uint256 optionCount, bool isResolved, int256 outcome, uint256 _requestTime, bool exists)",
        "function canSettle(uint256 marketId) external view returns (bool, string memory)"
      ],
      sepoliaWallet
    );
    
    // Get market details
    const market = await sepoliaContract.getMarket(marketId);
    console.log("\nMarket Details:");
    console.log("- Market ID:", market._marketId.toString());
    console.log("- Is Resolved:", market.isResolved);
    console.log("- Outcome:", market.outcome.toString());
    console.log("- Request Time:", market._requestTime.toString() === "0" ? 
      "Not requested" : new Date(market._requestTime.toNumber() * 1000).toISOString());
    
    if (market.isResolved) {
      console.log("\n✅ Market is already resolved with outcome:", market.outcome.toString());
      console.log("No further action needed on Sepolia. Check the Flow contract to see if it received the result.");
      return;
    }
    
    // Check if can settle
    const [canSettle, message] = await sepoliaContract.canSettle(marketId);
    console.log("\nCan Settle:", canSettle);
    console.log("Message:", message);
    
    if (!canSettle) {
      console.log("\n❌ Market cannot be settled:", message);
      console.log("Please address this issue before trying to settle again.");
      return;
    }
    
    console.log("\n📋 Recommendation: The market appears ready to be settled.");
    console.log("Previous transactions might have failed due to LayerZero issues.");
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 