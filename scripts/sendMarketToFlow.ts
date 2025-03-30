import { task } from 'hardhat/config';
import * as dotenv from "dotenv";
dotenv.config();

import { Options } from '@layerzerolabs/lz-v2-utilities';

async function main() {
  try {
    // Get hardhat runtime environment
    const hre = require("hardhat");
    const [signer] = await hre.ethers.getSigners();
    
    // Get market ID from environment or use default
    const marketId = process.env.MARKET_ID || "1";

    // Network configuration
    const srcNetwork = "sepolia-testnet";
    const dstNetwork = "flow-testnet";
    
    // Verify we're on Sepolia
    if (!hre.network.name.includes('sepolia')) {
      console.error(`You need to run this task on Sepolia network. Current network: ${hre.network.name}`);
      console.error('Try: npx hardhat run scripts/sendMarketToFlow.ts --network sepolia-testnet');
      return;
    }

    // Get destination network's EID
    const dstNetworkConfig = hre.config.networks[dstNetwork];
    if (!dstNetworkConfig || !dstNetworkConfig.eid) {
      console.error(`Destination network ${dstNetwork} not found or does not have an EID configured`);
      console.error('Make sure the network is defined in your hardhat.config.ts file');
      return;
    }
    const dstEid = dstNetworkConfig.eid;

    // Get current network's EID
    const srcNetworkConfig = hre.config.networks[hre.network.name];
    const srcEid = srcNetworkConfig?.eid;
    if (!srcEid) {
      console.error(`Current network ${hre.network.name} does not have an EID configured`);
      return;
    }
    
    console.log('Preparing to send market result:');
    console.log('- From:', signer.address);
    console.log('- Source network:', hre.network.name, `(EID: ${srcEid})`);
    console.log('- Destination:', dstNetwork, `(EID: ${dstEid})`);
    console.log('- Market ID:', marketId);
    
    // Sepolia contract address
    const SEPOLIA_CONTRACT_ADDRESS = process.env.SEPOLIA_CONTRACT_ADDRESS || "";
    if (!SEPOLIA_CONTRACT_ADDRESS) {
      throw new Error("Missing SEPOLIA_CONTRACT_ADDRESS in .env file");
    }
    console.log('- Contract address:', SEPOLIA_CONTRACT_ADDRESS);
    
    // Get the contract
    const sepoliaContract = await hre.ethers.getContractAt('SepoliaContract', SEPOLIA_CONTRACT_ADDRESS, signer);
    
    // Check market status
    try {
      const marketInfo = await sepoliaContract.getMarket(marketId);
      console.log("\nMarket details:");
      console.log("- ID:", marketInfo._marketId.toString());
      console.log("- Resolved:", marketInfo.isResolved);
      console.log("- Outcome:", marketInfo.outcome.toString());
      
      if (!marketInfo.isResolved) {
        console.log("\n❌ Market is not resolved yet. Cannot send result.");
        return;
      }
      
      // Try to get formatted message from contract
      let message;
      try {
        message = await sepoliaContract.formatMarketForMessage(marketId, marketInfo.outcome);
        console.log("\nFormatted message from contract:", message);
      } catch (error) {
        console.log("Error getting formatted message, using fallback format");
        // Fallback format if the contract function call fails
        message = `{"marketId":${marketId},"outcome":${marketInfo.outcome},"resolved":true}`;
      }
      
      // Add executor options with gas limit (same as in the task)
      const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toBytes();
      
      // Get quote for the message
      console.log('\nGetting quote...');
      try {
        const quotedFee = await sepoliaContract.quote(dstEid, message, options, false);
        console.log('Quoted fee:', hre.ethers.utils.formatEther(quotedFee.nativeFee), 'ETH');
        
        // Add 20% buffer to the fee
        const feeWithBuffer = quotedFee.nativeFee.mul(120).div(100);
        console.log('Fee with 20% buffer:', hre.ethers.utils.formatEther(feeWithBuffer), 'ETH');
        
        // Check if we have enough balance
        const balance = await signer.getBalance();
        console.log('Your wallet balance:', hre.ethers.utils.formatEther(balance), 'ETH');
        
        if (balance.lt(feeWithBuffer)) {
          console.log("❌ Insufficient balance for message fee");
          return;
        }
        
        // Send the message using the direct send method
        console.log('\nSending market result to Flow...');
        const tx = await sepoliaContract.send(dstEid, message, options, {
          value: feeWithBuffer,
          gasLimit: 1000000 // 1M gas limit
        });
        
        console.log('Transaction submitted:', tx.hash);
        console.log('Check on Etherscan: https://sepolia.etherscan.io/tx/' + tx.hash);
        console.log('\nWaiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log('\n✅ Transaction confirmed in block:', receipt.blockNumber);
        console.log('🎉 Market result sent to Flow!');
        console.log('Check on LayerZero Explorer: https://testnet.layerzeroscan.com/tx/' + receipt.transactionHash);
        
      } catch (error) {
        console.error('\n❌ Error quoting or sending message:');
        if (error.reason) {
          console.error('Reason:', error.reason);
        } else {
          console.error(error.message || error);
        }
      }
      
    } catch (error) {
      console.log("Error checking market:", error.message);
      return;
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