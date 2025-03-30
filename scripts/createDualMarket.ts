import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// Market parameters interface
interface MarketParams {
  title: string;
  description: string;
  options: string[];
  expirationDate: number;
  verificationTime: number;
  imageUrl: string;
  category: number;
  reward: string;
  bond: string;
}

async function main() {
  try {
    // Contract addresses from README verification commands
    const FLOW_CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS || "";
    const SEPOLIA_CONTRACT_ADDRESS = process.env.SEPOLIA_CONTRACT_ADDRESS || "";
    
    // Use your actual address that has bet creator privileges
    const WALLET_ADDRESS = "0x504b635B7E22F8DF7d037cf31639811AE583E9f0";
    
    console.log("Contract addresses:");
    console.log("- Flow:", FLOW_CONTRACT_ADDRESS);
    console.log("- Sepolia:", SEPOLIA_CONTRACT_ADDRESS);
    console.log("Using wallet address:", WALLET_ADDRESS);
    
    // Set up providers directly
    const flowProvider = new ethers.providers.JsonRpcProvider(
      "https://testnet.evm.nodes.onflow.org"
    );
    
    const sepoliaProvider = new ethers.providers.JsonRpcProvider(
      "https://eth-sepolia.g.alchemy.com/v2/NC8ECPLoaJ3SxtjqH9AVBli3wAxzWpxr"
    );
    
    // Create wallet using private key
    if (!process.env.PRIVATE_KEY) {
      throw new Error("Missing PRIVATE_KEY in .env file");
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    const flowWallet = wallet.connect(flowProvider);
    const sepoliaWallet = wallet.connect(sepoliaProvider);
    
    console.log("Connected wallet addresses:");
    console.log("- Flow:", flowWallet.address);
    console.log("- Sepolia:", sepoliaWallet.address);
    
    // Verify that connected wallet is the right one
    if (flowWallet.address.toLowerCase() !== WALLET_ADDRESS.toLowerCase()) {
      throw new Error(`The wallet address from your private key (${flowWallet.address}) doesn't match the expected address (${WALLET_ADDRESS})`);
    }
    
    // Check if Flow contract exists
    console.log("\nVerifying Flow contract...");
    const flowCode = await flowProvider.getCode(FLOW_CONTRACT_ADDRESS);
    
    if (flowCode === "0x") {
      throw new Error(`Flow contract at ${FLOW_CONTRACT_ADDRESS} doesn't exist on the network`);
    }
    console.log("✓ Flow contract verified");
    
    // Check if Sepolia contract exists
    console.log("\nVerifying Sepolia contract...");
    const sepoliaCode = await sepoliaProvider.getCode(SEPOLIA_CONTRACT_ADDRESS);
    
    if (sepoliaCode === "0x") {
      throw new Error(`Sepolia contract at ${SEPOLIA_CONTRACT_ADDRESS} doesn't exist on the network`);
    }
    console.log("✓ Sepolia contract verified");

    // Setup contract instances with the correct providers and wallets
    const flowContract = new ethers.Contract(
      FLOW_CONTRACT_ADDRESS,
      [
        "function createMarketAdmin(string memory title, string memory description, string[] memory options, uint256 expirationDate, uint256 _verificationTime, string memory imageUrl, uint8 category) external",
        "function getMarketDetails(uint256 marketId) external view returns (uint256, string memory, address, uint256, uint256, bool, uint256[] memory, uint256, int256, uint8, string memory, uint256)",
        "function betCreators(address) external view returns (bool)",
        "function marketCount() external view returns (uint256)"
      ],
      flowWallet
    );
    
    const sepoliaContract = new ethers.Contract(
      SEPOLIA_CONTRACT_ADDRESS,
      [
        "function createMarket(uint256 marketId, uint256 reward, uint256 bond, string memory jsonQuestion, uint256 verificationTime, uint256 optionCount) external",
        "function markets(uint256) view returns (uint256 marketId, uint256 reward, uint256 bond, bytes questionText, uint256 verificationTime, uint256 optionCount, bool isResolved, int256 outcome, uint256 requestTime, bool exists)"
      ],
      sepoliaWallet
    );
    
    // Check if user is a bet creator
    const isBetCreator = await flowContract.betCreators(flowWallet.address);
    console.log("Is bet creator on Flow:", isBetCreator);
    
    if (!isBetCreator) {
      console.log("\n⚠️ WARNING: You are not registered as a bet creator on Flow!");
      console.log("You need to run a script to set up your roles before creating markets.");
      return;
    }
    
    // Get current market count to know the next market ID
    const currentMarketCount = await flowContract.marketCount();
    const nextMarketId = currentMarketCount.add(1);
    console.log("\nCurrent market count:", currentMarketCount.toString());
    console.log("Next market ID will be:", nextMarketId.toString());
    
    // Market parameters
    const marketParams = {
      title: "Will Barca win the champions league?",
      description: "Price on Coinbase exchange",
      options: ["No", "Yes"],
      expirationDate: Math.floor(Date.now() / 1000) + 360, // 24 hours from now
      verificationTime: 360, // 2 hours
      imageUrl: "https://example.com/eth.jpg",
      category: 1, // CRYPTO category
      reward: "0.1", // ETH
      bond: "0.1" // ETH
    };
    
    console.log("\nMarket Parameters:");
    console.log("- Title:", marketParams.title);
    console.log("- Description:", marketParams.description);
    console.log("- Options:", marketParams.options.join(", "));
    console.log("- Expiration:", new Date(marketParams.expirationDate * 1000).toISOString());
    console.log("- Verification Time:", marketParams.verificationTime, "seconds");
    console.log("- Category:", marketParams.category);
    
    // STEP 1: Create market on Flow
    console.log("\n1. Creating market on Flow chain...");
    
    // Create market on Flow
    const flowTx = await flowContract.createMarketAdmin(
      marketParams.title,
      marketParams.description,
      marketParams.options,
      marketParams.expirationDate,
      marketParams.verificationTime,
      marketParams.imageUrl,
      marketParams.category,
      {
        gasLimit: 4000000
      }
    );
    
    console.log("Flow transaction sent:", flowTx.hash);
    console.log("Waiting for confirmation...");
    const flowReceipt = await flowTx.wait();
    console.log("Flow transaction confirmed in block:", flowReceipt.blockNumber);
    
    // Get the new market count to confirm the market ID
    const newMarketCount = await flowContract.marketCount();
    const marketId = newMarketCount;
    console.log("New market count:", newMarketCount.toString());
    console.log(`Market created with ID: ${marketId}`);
    
    // Format UMA question for oracle
    const questionText = formatUMAQuestion(
      marketParams.title,
      marketParams.description,
      marketParams.options
    );
    console.log("\nFormatted Oracle Question:");
    console.log(questionText);
    
    // STEP 2: Create market on Sepolia with the same ID
    console.log("\n2. Creating market on Sepolia chain...");
    
    // Convert ETH amounts to Wei
    const rewardWei = ethers.utils.parseEther(marketParams.reward);
    const bondWei = ethers.utils.parseEther(marketParams.bond);
    
    // Create market on Sepolia
    const sepoliaTx = await sepoliaContract.createMarket(
      marketId,
      rewardWei,
      bondWei,
      questionText,
      marketParams.verificationTime,
      marketParams.options.length,
      {
        gasLimit: 500000
      }
    );
    
    console.log("Sepolia transaction sent:", sepoliaTx.hash);
    console.log("Waiting for confirmation...");
    const sepoliaReceipt = await sepoliaTx.wait();
    console.log("Sepolia transaction confirmed in block:", sepoliaReceipt.blockNumber);
    
    console.log("\n✅ Market created successfully on both chains!");
    console.log(`Market ID: ${marketId}`);
    console.log(`Flow Transaction: ${flowTx.hash}`);
    console.log(`Sepolia Transaction: ${sepoliaTx.hash}`);
    
    console.log("\nNext Steps:");
    console.log("1. Place bets on the Flow chain market");
    console.log("2. After market expiration (", new Date(marketParams.expirationDate * 1000).toISOString(), "):");
    console.log(`   Run: MARKET_ID=${marketId} npx hardhat run scripts/requestMarketSettlement.ts --network sepolia-testnet`);
    console.log("3. After verification period (", marketParams.verificationTime, " seconds):");
    console.log(`   Run: MARKET_ID=${marketId} npx hardhat run scripts/settleMarket.ts --network sepolia-testnet`);
    
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
    if (error.code === 'NETWORK_ERROR') {
      console.error("\nNetwork Error: Please check your network configuration and try again.");
      console.error("Make sure you're connected to the correct networks:");
      console.error("- Flow Testnet: https://testnet.evm.nodes.onflow.org");
      console.error("- Sepolia: https://eth-sepolia.g.alchemy.com");
    }
    process.exit(1);
  }
}

// Helper function to format UMA oracle question
function formatUMAQuestion(title: string, description: string, options: string[]): string {
  let jsonStart = '{"title":"';
  let jsonTitleEnd = '","description":"';
  let jsonDescEnd = '","options":[';

  // Start building the JSON
  let formattedQuestion = jsonStart + title + jsonTitleEnd + description + jsonDescEnd;

  // Add options
  for (let i = 0; i < options.length; i++) {
    // Format: ["Option1","0"],["Option2","1"]
    if (i > 0) {
      formattedQuestion += ",";
    }
    formattedQuestion += '["' + options[i] + '","' + i + '"]';
  }

  // Close the JSON object
  formattedQuestion += "]}";

  return formattedQuestion;
}

// Helper to get readable category name
function getCategoryName(category: number): string {
  const categories = [
    "CULTURE",
    "CRYPTO",
    "SPORTS",
    "POLITICS",
    "MEMECOINS",
    "GAMING",
    "ECONOMY",
    "AI"
  ];
  
  return categories[category] || "UNKNOWN";
}

// Helper for CLI confirmation
async function confirmAction(message: string): Promise<boolean> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    readline.question(`${message} (y/N): `, (answer: string) => {
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