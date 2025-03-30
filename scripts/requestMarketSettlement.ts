import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  try {
    // Get market ID from environment or use default
    const marketId = process.env.MARKET_ID || "2";
    
    console.log(`Requesting settlement for market #${marketId}...`);
    
    // Sepolia contract address
    const SEPOLIA_CONTRACT_ADDRESS = process.env.SEPOLIA_CONTRACT_ADDRESS || "";
    
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
    
    console.log("Using address:", sepoliaWallet.address);
    
    // Check ETH balance
    const ethBalance = await sepoliaWallet.getBalance();
    console.log("ETH Balance:", ethers.utils.formatEther(ethBalance), "ETH");
    
    if (ethBalance.lt(ethers.utils.parseEther("0.01"))) {
      throw new Error("Low ETH balance. You need at least 0.01 ETH for gas");
    }
    
    // Contract interface
    const sepoliaContract = new ethers.Contract(
      SEPOLIA_CONTRACT_ADDRESS,
      [
        "function requestSettlement(uint256 marketId) external",
        "function getMarket(uint256 marketId) external view returns (uint256 _marketId, uint256 reward, uint256 bond, bytes memory questionText, uint256 verificationTime, uint256 optionCount, bool isResolved, int256 outcome, uint256 _requestTime, bool exists)",
        "function getWETHBalance() external view returns (uint256)",
        "function depositETH() external payable"
      ],
      sepoliaWallet
    );
    
    // Check if market exists
    console.log("\nChecking market details...");
    try {
      const market = await sepoliaContract.getMarket(marketId);
      console.log("Market found:");
      console.log("- Market ID:", market._marketId.toString());
      console.log("- Reward:", ethers.utils.formatEther(market.reward), "WETH");
      console.log("- Bond:", ethers.utils.formatEther(market.bond), "WETH");
      console.log("- Is Resolved:", market.isResolved);
      console.log("- Request Time:", market._requestTime.toString() === "0" ? "Not requested" : new Date(market._requestTime.toNumber() * 1000).toISOString());
      
      if (market.isResolved) {
        throw new Error("Market is already resolved");
      }
      
      if (market._requestTime.toString() !== "0") {
        throw new Error("Settlement already requested at " + new Date(market._requestTime.toNumber() * 1000).toISOString());
      }
      
      // Check WETH balance
      const wethBalance = await sepoliaContract.getWETHBalance();
      console.log("\nContract WETH Balance:", ethers.utils.formatEther(wethBalance), "WETH");
      
      const requiredWETH = market.reward.add(market.bond);
      console.log("Required WETH:", ethers.utils.formatEther(requiredWETH), "WETH");
      
      // If we need more WETH, deposit ETH
      if (wethBalance.lt(requiredWETH)) {
        const needed = requiredWETH.sub(wethBalance);
        console.log(`\nDepositing ${ethers.utils.formatEther(needed)} ETH to get WETH...`);
        
        // Make sure we have enough ETH
        if (ethBalance.lt(needed.add(ethers.utils.parseEther("0.01")))) {
          throw new Error(`Insufficient ETH balance. Need at least ${ethers.utils.formatEther(needed.add(ethers.utils.parseEther("0.01")))} ETH`);
        }
        
        const depositTx = await sepoliaContract.depositETH({
          value: needed,
          gasLimit: 100000
        });
        
        console.log("Deposit transaction sent:", depositTx.hash);
        await depositTx.wait();
        
        // Verify new WETH balance
        const newWethBalance = await sepoliaContract.getWETHBalance();
        console.log("New Contract WETH Balance:", ethers.utils.formatEther(newWethBalance), "WETH");
        
        if (newWethBalance.lt(requiredWETH)) {
          throw new Error("WETH balance still insufficient after deposit");
        }
      }
      
      // Request settlement
      console.log("\nRequesting settlement...");
      const tx = await sepoliaContract.requestSettlement(marketId, {
        gasLimit: 500000
      });
      
      console.log("Transaction sent:", tx.hash);
      console.log("\nWaiting for confirmation...");
      const receipt = await tx.wait();
      console.log("Transaction confirmed in block:", receipt.blockNumber);
      
      console.log("\n✅ Settlement request successful!");
      console.log(`Request sent to UMA Oracle for Market #${marketId}`);
      console.log("Verification period has begun.");
      console.log(`Wait for the verification period (${market.verificationTime.toString()} seconds) to complete before settling.`);
      
      // Calculate when settlement will be possible
      const now = Math.floor(Date.now() / 1000);
      const settlementTime = now + market.verificationTime.toNumber();
      console.log("\nYou can settle the market after:", new Date(settlementTime * 1000).toISOString());
      console.log(`Run this command after that time: MARKET_ID=${marketId} npx hardhat run scripts/settleMarket.ts --network sepolia-testnet`);
      
    } catch (error: any) {
      if (error.message.includes("Market does not exist")) {
        console.error(`Market #${marketId} does not exist on Sepolia contract`);
      } else {
        throw error;
      }
    }
    
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });