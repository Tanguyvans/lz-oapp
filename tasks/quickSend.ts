import { task } from 'hardhat/config';
import * as dotenv from 'dotenv';
dotenv.config();

task('quickSend', 'Send a message from Sepolia to Flow using the contract addresses in .env')
  .addParam('message', 'The message to send (e.g., "1:0")')
  .setAction(async (taskArgs, hre) => {
    const { message } = taskArgs;
    const [signer] = await hre.ethers.getSigners();
    
    // Get contract addresses from .env
    const sepoliaContractAddress = process.env.SEPOLIA_CONTRACT_ADDRESS;
    const flowContractAddress = process.env.FLOW_CONTRACT_ADDRESS;
    
    if (!sepoliaContractAddress) {
      throw new Error("SEPOLIA_CONTRACT_ADDRESS not set in .env file");
    }
    
    if (!flowContractAddress) {
      throw new Error("FLOW_CONTRACT_ADDRESS not set in .env file");
    }
    
    console.log("Sending message from Sepolia to Flow:");
    console.log("- Sender address:", signer.address);
    console.log("- Sepolia contract:", sepoliaContractAddress);
    console.log("- Flow contract:", flowContractAddress);
    console.log("- Message:", message);
    
    // Flow endpoint ID
    const FLOW_EID = 40351; // From your error message
    
    // Create contract instance
    const sepoliaContract = await hre.ethers.getContractAt(
      [
        "function send(uint32 _dstEid, string memory _message, bytes calldata _options) external payable returns (tuple(bytes32 guid, uint256 nonce, bytes32 hash))"
      ],
      sepoliaContractAddress,
      signer
    );
    
    // Create options for LayerZero
    const options = hre.ethers.utils.solidityPack(
      ["uint16", "uint256"],
      [1, 500000] // Gas type 1, gas limit 500,000
    );
    
    // Set a high fee for LayerZero
    const layerZeroFee = hre.ethers.utils.parseEther("0.05"); // 0.05 ETH
    
    console.log(`- LayerZero Fee: ${hre.ethers.utils.formatEther(layerZeroFee)} ETH`);
    
    try {
      console.log("\n📨 Sending message...");
      const tx = await sepoliaContract.send(
        FLOW_EID,
        message,
        options,
        {
          value: layerZeroFee,
          gasLimit: 500000
        }
      );
      
      console.log("Transaction sent:", tx.hash);
      console.log("Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log("Transaction confirmed in block:", receipt.blockNumber);
      
      if (receipt.status === 1) {
        console.log("\n✅ Success! Message sent to Flow contract");
        console.log(`The message "${message}" has been sent to Flow through LayerZero`);
        console.log("\nCheck message status on LayerZero Scan:");
        console.log(`https://testnet.layerzeroscan.com/tx/${receipt.transactionHash}`);
      } else {
        console.log("\n❌ Transaction failed");
      }
    } catch (error) {
      console.error("\n❌ Error sending message:", error.message);
    }
  }); 