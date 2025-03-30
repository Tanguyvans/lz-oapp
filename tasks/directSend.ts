import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Options } from '@layerzerolabs/lz-v2-utilities';

export default task('directsend', 'Send a message directly using contract address')
  .addParam('message', 'The message to send')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { message } = taskArgs;
    const [signer] = await hre.ethers.getSigners();

    // Flow testnet EID
    const flowEid = 40351;

    // Get contract address from .env
    const contractAddress = process.env.SEPOLIA_CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error('SEPOLIA_CONTRACT_ADDRESS not found in .env file');
    }

    console.log('Sending message:');
    console.log('- From:', signer.address);
    console.log('- Source network:', hre.network.name);
    console.log('- Destination: flow-testnet (EID:', flowEid, ')');
    console.log('- Message:', message);
    console.log('- Using contract at:', contractAddress);

    // Get contract instance
    const contract = await hre.ethers.getContractAt('SepoliaContract', contractAddress, signer);
    
    // Add executor options with gas limit
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toBytes();

    // Use higher gas amount (0.05 ETH)
    const gasAmount = hre.ethers.utils.parseEther('0.05');
    console.log('Using gas amount:', hre.ethers.utils.formatEther(gasAmount), 'ETH');
    
    try {
      console.log('Calling send function...');
      const tx = await contract.send(flowEid, message, options, { 
        value: gasAmount,
        gasLimit: 500000  // Set explicit gas limit
      });
      
      console.log('Transaction sent! Waiting for confirmation...');
      const receipt = await tx.wait();
      console.log('🎉 Message sent! Transaction hash:', receipt.transactionHash);
      console.log('Check message status on LayerZero Scan: https://testnet.layerzeroscan.com/tx/' + receipt.transactionHash);
    } catch (error) {
      console.error('Error sending message:');
      console.error(error);
      
      // Try to extract useful information from error
      if (error.error?.data) {
        console.log('Error data:', error.error.data);
      }
    }
  }); 