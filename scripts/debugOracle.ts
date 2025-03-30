import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  try {
    // Get market ID from environment or use default
    const marketId = process.env.MARKET_ID || "1";
    
    console.log(`Debugging oracle for market #${marketId}...`);
    
    // Sepolia contract address
    const SEPOLIA_CONTRACT_ADDRESS = "0x607eA3369d0d504103D18B7fE5774EE144aA1bBa";
    const UMA_ORACLE_ADDRESS = "0x9f1263B8f0355673619168b5B8c0248f1d03e88C";
    
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
    
    // Contract interfaces
    const sepoliaContract = new ethers.Contract(
      SEPOLIA_CONTRACT_ADDRESS,
      [
        "function getMarket(uint256 marketId) external view returns (uint256 _marketId, uint256 reward, uint256 bond, bytes memory questionText, uint256 verificationTime, uint256 optionCount, bool isResolved, int256 outcome, uint256 _requestTime, bool exists)",
        "function canSettle(uint256 marketId) external view returns (bool, string memory)"
      ],
      sepoliaWallet
    );
    
    const umaOracle = new ethers.Contract(
      UMA_ORACLE_ADDRESS,
      [
        "function getRequest(address requester, bytes32 identifier, uint256 timestamp, bytes memory ancillaryData) external view returns (tuple(address currency, uint256 reward, address finalFee, address proposer, address disputer, int256 proposedPrice, int256 resolvedPrice, bool settled, bool disputed, uint256 proposalTimestamp, uint256 resolveTimestamp) request)",
        "function hasPrice(address requester, bytes32 identifier, uint256 timestamp, bytes memory ancillaryData) external view returns (bool)"
      ],
      sepoliaWallet
    );
    
    // Get market details
    const market = await sepoliaContract.getMarket(marketId);
    console.log("\nMarket Details:");
    console.log("- Market ID:", market._marketId.toString());
    console.log("- Option Count:", market.optionCount.toString());
    console.log("- Request Time:", new Date(market._requestTime.toNumber() * 1000).toISOString());
    console.log("- Question Text Length:", market.questionText.length, "bytes");
    console.log("- Question Text (hex):", market.questionText);
    
    // Try to decode the question text as UTF-8
    try {
      const decodedText = ethers.utils.toUtf8String(market.questionText);
      console.log("- Question Text (decoded):", decodedText);
      
      // Try to parse as JSON
      try {
        const jsonQuestion = JSON.parse(decodedText);
        console.log("\nJSON Question Structure:");
        console.log("- Title:", jsonQuestion.title);
        console.log("- Description:", jsonQuestion.description);
        console.log("- Options:", jsonQuestion.options.map(opt => `${opt[0]} (${opt[1]})`).join(", "));
      } catch (e) {
        console.log("Question text is not valid JSON");
      }
    } catch (e) {
      console.log("Could not decode question text as UTF-8");
    }
    
    // Check if canSettle returns true
    const [canSettle, settleMessage] = await sepoliaContract.canSettle(marketId);
    console.log("\nCan Settle:", canSettle);
    console.log("Message:", settleMessage);
    
    // Get UMA oracle details
    console.log("\nChecking UMA Oracle...");
    const identifier = ethers.utils.formatBytes32String("MULTIPLE_CHOICE_QUERY");
    
    try {
      // Check if the oracle has a price
      const hasPrice = await umaOracle.hasPrice(
        SEPOLIA_CONTRACT_ADDRESS,
        identifier,
        market._requestTime,
        market.questionText
      );
      console.log("Oracle Has Price:", hasPrice);
      
      // Get the oracle request details
      const request = await umaOracle.getRequest(
        SEPOLIA_CONTRACT_ADDRESS,
        identifier,
        market._requestTime,
        market.questionText
      );
      
      console.log("\nOracle Request Details:");
      console.log("- Proposed Price:", request.proposedPrice.toString());
      console.log("- Resolved Price:", request.resolvedPrice.toString());
      console.log("- Settled:", request.settled);
      console.log("- Disputed:", request.disputed);
      console.log("- Proposal Timestamp:", request.proposalTimestamp.toString() !== "0" ? 
        new Date(request.proposalTimestamp.toNumber() * 1000).toISOString() : "None");
      console.log("- Resolve Timestamp:", request.resolveTimestamp.toString() !== "0" ? 
        new Date(request.resolveTimestamp.toNumber() * 1000).toISOString() : "None");
      
      // Check if the resolved price is within the valid range for the market
      if (request.resolvedPrice.toString() !== "0") {
        const resolvedPrice = request.resolvedPrice.toNumber();
        if (resolvedPrice < 0) {
          console.log("⚠️ ISSUE: Resolved price is negative:", resolvedPrice);
        } else if (resolvedPrice >= market.optionCount.toNumber()) {
          console.log("⚠️ ISSUE: Resolved price is outside valid option range:", resolvedPrice);
          console.log(`Valid options are 0 to ${market.optionCount.toNumber() - 1}`);
        } else {
          console.log("✅ Resolved price is within valid option range");
        }
      }
    } catch (error) {
      console.log("Error getting oracle details:", error.message);
    }
    
    // Get the LayerZero endpoint ID for Flow
    console.log("\nLayerZero Setup:");
    console.log("- Flow TestNet Endpoint ID:", 30401);
    
    // Check for common issues
    console.log("\nPotential Issues:");
    if (market.optionCount.toNumber() === 0) {
      console.log("⚠️ Market has 0 options - this will cause any result to fail the range check");
    }
    
    // Give recommendations
    console.log("\nRecommendations:");
    console.log("1. Check if the UMA oracle has returned a valid result (should be 0 or 1 for a Yes/No market)");
    console.log("2. If using LayerZero testnet, ensure endpoints are correctly configured");
    console.log("3. Try with a higher gas limit and fee for LayerZero messaging");
    console.log("4. Consider updating your contract with more detailed error messages");
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 