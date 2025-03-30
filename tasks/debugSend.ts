import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Options } from '@layerzerolabs/lz-v2-utilities';

export default task('debugsend', 'Debug sending a message with enhanced error handling')
  .addParam('message', 'The message to send')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { message } = taskArgs;
    const [signer] = await hre.ethers.getSigners();

    // Flow testnet EID - Now using the one from config to ensure correctness
    const flowConfig = hre.config.networks['flow-testnet'];
    if (!flowConfig || !flowConfig.eid) {
      throw new Error('Flow testnet not properly configured in hardhat.config.ts');
    }
    const flowEid = flowConfig.eid;

    // Get contract address from .env
    const contractAddress = process.env.SEPOLIA_CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error('SEPOLIA_CONTRACT_ADDRESS not found in .env file');
    }

    console.log('Setting up message sending:');
    console.log('- From:', signer.address);
    console.log('- Source network:', hre.network.name);
    console.log('- Destination: flow-testnet (EID:', flowEid, ')');
    console.log('- Message:', message);
    console.log('- Using contract at:', contractAddress);

    // Get contract instance
    const contract = await hre.ethers.getContractAt('SepoliaContract', contractAddress, signer);
    
    // List all available functions to verify
    console.log('\nVerifying contract interface...');
    const functions = Object.keys(contract.functions)
      .filter(key => !key.includes('('))
      .sort();
    console.log('Available functions:', functions);
    
    // Check if the contract is properly configured
    try {
      // Verify account balance
      const balance = await signer.getBalance();
      console.log(`\nAccount balance: ${hre.ethers.utils.formatEther(balance)} ETH`);
      
      if (balance.lt(hre.ethers.utils.parseEther('0.1'))) {
        console.warn('Warning: Low account balance may cause issues with LayerZero fees');
      }
      
      // Set a much higher gas amount for LayerZero fees
      const gasAmount = hre.ethers.utils.parseEther('0.1'); // Increased to 0.1 ETH
      console.log('Using gas amount:', hre.ethers.utils.formatEther(gasAmount), 'ETH');
      
      // Add executor options with high gas limit
      const options = Options.newOptions().addExecutorLzReceiveOption(500000, 0).toBytes();
      console.log('Using executor gas limit of 500000');
      
      // Check if we need to use a different function
      if (functions.includes('send')) {
        console.log('\nAttempting to use send() function...');
        const tx = await contract.send(flowEid, message, options, {
          value: gasAmount,
          gasLimit: 1000000, // Increased to 1M
        });
        
        console.log('Transaction sent! Waiting for confirmation...');
        const receipt = await tx.wait();
        console.log('🎉 Message sent! Transaction hash:', receipt.transactionHash);
        console.log('Check message status on LayerZero Scan: https://testnet.layerzeroscan.com/tx/' + receipt.transactionHash);
      } else {
        console.error('send() function not found on contract');
        throw new Error('Contract does not have the expected send function');
      }
    } catch (error) {
      console.error('\n❌ Error sending message:');
      
      // Analyze the error
      if (error.reason) {
        console.error(`Reason: ${error.reason}`);
      }
      
      if (error.data) {
        console.error(`Error data: ${error.data}`);
      }
      
      if (error.transaction) {
        console.log('\nTransaction details that failed:');
        console.log('- To:', error.transaction.to);
        console.log('- Value:', hre.ethers.utils.formatEther(error.transaction.value), 'ETH');
        console.log('- Gas limit:', error.transaction.gasLimit.toString());
        
        // Try to decode the function call data
        const calldata = error.transaction.data;
        console.log('- Call data:', calldata);
        
        // Get transaction receipt if available
        if (error.receipt) {
          console.log('\nTransaction receipt:');
          console.log('- Status:', error.receipt.status === 0 ? 'Failed' : 'Success');
          console.log('- Gas used:', error.receipt.gasUsed.toString());
          console.log('- Block number:', error.receipt.blockNumber);
        }
      }
      
      console.log('\n📋 Suggested troubleshooting steps:');
      console.log('1. Verify the contract at address is the correct one');
      console.log('2. Make sure your account has permission to call send() if required');
      console.log('3. Check the LayerZero endpoint is correctly configured');
      console.log('4. Consider increasing gas amount for LayerZero fees');
      console.log('5. Verify the Flow EID is correct');
      console.log('6. Check the contract on Etherscan to see if there are owner-only restrictions');
    }
  }); 