import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  try {
    // Get market ID from environment or use default
    const marketId = process.env.MARKET_ID || "2";

    // Contract addresses
    const SEPOLIA_CONTRACT_ADDRESS = process.env.SEPOLIA_CONTRACT_ADDRESS || "";
    const FLOW_CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS || "";
    
    if (!SEPOLIA_CONTRACT_ADDRESS) {
      throw new Error("Missing SEPOLIA_CONTRACT_ADDRESS in .env file");
    }
    if (!FLOW_CONTRACT_ADDRESS) {
      throw new Error("Missing FLOW_CONTRACT_ADDRESS in .env file");
    }
    
    console.log("Checking Market Outcomes on Both Chains");
    console.log("- Market ID:", marketId);
    console.log("- Sepolia Contract:", SEPOLIA_CONTRACT_ADDRESS);
    console.log("- Flow Contract:", FLOW_CONTRACT_ADDRESS);
    
    // We'll need to run separate commands for each network
    // Let's start with Sepolia
    
    console.log("\n=== Sepolia Contract Check ===");
    console.log("Running: npx hardhat run scripts/checkSepoliaMarket.js --network sepolia-testnet");
    
    // Create temporary scripts for each network check
    const fs = require('fs');
    const path = require('path');
    
    // Create Sepolia check script
    const sepoliaScriptContent = `
    const hre = require("hardhat");
    const ethers = hre.ethers;

    async function main() {
      try {
        const marketId = "${marketId}";
        const SEPOLIA_CONTRACT_ADDRESS = "${SEPOLIA_CONTRACT_ADDRESS}";
        
        console.log("Checking Sepolia Contract Market Data");
        
        const [signer] = await ethers.getSigners();
        console.log("Using address:", signer.address);
        
        const sepoliaContract = await ethers.getContractAt(
          "SepoliaContract",
          SEPOLIA_CONTRACT_ADDRESS,
          signer
        );
        
        // Get market data
        const market = await sepoliaContract.getMarket(marketId);
        console.log("Market details on Sepolia:");
        console.log("- ID:", market._marketId.toString());
        console.log("- Resolved:", market.isResolved);
        console.log("- Outcome:", market.outcome.toString());
        console.log("- Option count:", market.optionCount.toString());
        
        // Get formatted message
        try {
          const message = await sepoliaContract.formatMarketForMessage(marketId, market.outcome);
          console.log("\\nFormatted message:");
          console.log(message);
          
          // Create alternative message format with quoted outcome
          const fixedMessage = JSON.stringify({
            marketId: Number(marketId),
            outcome: market.outcome.toString(),
            resolved: true
          });
          console.log("\\nAlternative message format with quoted outcome:");
          console.log(fixedMessage);
        } catch (error) {
          console.log("Error getting formatted message:", error.message);
        }
        
      } catch (error) {
        console.error("Error:", error.message);
      }
    }

    main()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
    `;
    
    // Create Flow check script
    const flowScriptContent = `
    const hre = require("hardhat");
    const ethers = hre.ethers;

    async function main() {
      try {
        const marketId = "${marketId}";
        const FLOW_CONTRACT_ADDRESS = "${FLOW_CONTRACT_ADDRESS}";
        
        console.log("Checking Flow Contract Market Data");
        
        const [signer] = await ethers.getSigners();
        console.log("Using address:", signer.address);
        
        const flowContract = await ethers.getContractAt(
          "FlowContract",
          FLOW_CONTRACT_ADDRESS,
          signer
        );
        
        // Get raw received data
        const rawData = await flowContract.data();
        console.log("Raw data received on Flow:");
        console.log(rawData);
        
        // Test the parsing function
        console.log("\\nTesting different message formats with the parsing function:");
        
        // Test 1: Standard format
        const message1 = \`{"marketId":${marketId},"outcome":2,"resolved":true}\`;
        console.log("\\nMessage format 1 (standard):", message1);
        const parsed1 = await flowContract.parseMarketData(message1);
        console.log("Parsed outcome:", parsed1.outcome.toString());
        
        // Test 2: Quoted outcome format
        const message2 = \`{"marketId":${marketId},"outcome":"2","resolved":true}\`;
        console.log("\\nMessage format 2 (quoted outcome):", message2);
        const parsed2 = await flowContract.parseMarketData(message2);
        console.log("Parsed outcome:", parsed2.outcome.toString());
        
        // Test 3: Spaced format
        const message3 = \`{"marketId": ${marketId}, "outcome": 2, "resolved": true}\`;
        console.log("\\nMessage format 3 (with spaces):", message3);
        const parsed3 = await flowContract.parseMarketData(message3);
        console.log("Parsed outcome:", parsed3.outcome.toString());
        
        // Get actual market details
        try {
          const marketDetails = await flowContract.getMarketDetails(marketId);
          console.log("\\nActual market details on Flow:");
          console.log("- ID:", marketDetails.id.toString());
          console.log("- Is resolved:", marketDetails.isResolved);
          console.log("- Outcome:", marketDetails.outcome.toString());
          console.log("- Option count:", marketDetails.optionCount.toString());
        } catch (error) {
          console.log("Error getting market details:", error.message);
        }
        
      } catch (error) {
        console.error("Error:", error.message);
      }
    }

    main()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
    `;
    
    // Write temporary scripts
    const sepoliaScriptPath = path.join(__dirname, 'checkSepoliaMarket.js');
    const flowScriptPath = path.join(__dirname, 'checkFlowMarket.js');
    
    fs.writeFileSync(sepoliaScriptPath, sepoliaScriptContent);
    fs.writeFileSync(flowScriptPath, flowScriptContent);
    
    console.log("Created temporary scripts for each network check");
    
    // Execute the scripts
    const { execSync } = require('child_process');
    
    try {
      console.log("\nRunning Sepolia check...");
      const sepoliaResult = execSync('npx hardhat run scripts/checkSepoliaMarket.js --network sepolia-testnet').toString();
      console.log(sepoliaResult);
    } catch (error) {
      console.error("Error running Sepolia check:", error.message);
      if (error.stdout) console.log(error.stdout.toString());
    }
    
    try {
      console.log("\n=== Flow Contract Check ===");
      console.log("Running: npx hardhat run scripts/checkFlowMarket.js --network flow-testnet");
      console.log("\nRunning Flow check...");
      const flowResult = execSync('npx hardhat run scripts/checkFlowMarket.js --network flow-testnet').toString();
      console.log(flowResult);
    } catch (error) {
      console.error("Error running Flow check:", error.message);
      if (error.stdout) console.log(error.stdout.toString());
    }
    
    console.log("\n=== Analysis and Solution ===");
    console.log("Based on the test results, we can see if the Flow contract parses the outcome correctly.");
    console.log("\nIf the quoted format works but the standard format doesn't, let's send a new message with quoted outcomes:");
    console.log(`npx hardhat run scripts/sendMarketToFlowFixed.ts --network sepolia-testnet`);
    
    // Cleanup
    try {
      fs.unlinkSync(sepoliaScriptPath);
      fs.unlinkSync(flowScriptPath);
      console.log("Temporary script files cleaned up");
    } catch (error) {
      console.log("Error cleaning up temporary files:", error.message);
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