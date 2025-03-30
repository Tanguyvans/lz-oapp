import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Options } from '@layerzerolabs/lz-v2-utilities';

export default task('simplesend', 'Send a simple message from one chain to another')
  .addParam('dstnetwork', 'The destination network name')
  .addParam('message', 'The message to send')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { message, dstnetwork } = taskArgs;
    const [signer] = await hre.ethers.getSigners();

    // Get destination network's EID
    const dstNetworkConfig = hre.config.networks[dstnetwork];
    if (!dstNetworkConfig || !dstNetworkConfig.eid) {
      throw new Error(`Destination network ${dstnetwork} not configured with EID`);
    }
    const dstEid = dstNetworkConfig.eid;

    // Get the contract address from environment variables
    let contractAddress;
    let contractName;
    
    // Determine which contract to use based on current network
    if (hre.network.name.includes('sepolia')) {
      contractAddress = process.env.SEPOLIA_CONTRACT_ADDRESS;
      contractName = 'SepoliaContract';
    } else if (hre.network.name.includes('flow')) {
      contractAddress = process.env.FLOW_CONTRACT_ADDRESS;
      contractName = 'FlowContract';
    } else {
      throw new Error(`Unsupported network: ${hre.network.name}`);
    }
    
    if (!contractAddress) {
      throw new Error(`No contract address found for ${hre.network.name}`);
    }

    console.log('Sending message:');
    console.log('- From:', signer.address);
    console.log('- Source network:', hre.network.name);
    console.log('- Destination:', dstnetwork, `(EID: ${dstEid})`);
    console.log('- Message:', message);
    console.log('- Using contract:', contractName, 'at', contractAddress);

    // Get contract instance
    const contract = await hre.ethers.getContractAt(contractName, contractAddress, signer);
    
    // List available functions
    console.log('Available contract functions:');
    const functionNames = Object.keys(contract.functions)
      .filter(name => !name.includes('(')) // Filter out function signatures with parameters
      .sort();
    console.log(functionNames);
    
    // Add executor options with gas limit
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toBytes();

    // Use a reasonable default gas amount (0.01 ETH)
    const defaultGasAmount = hre.ethers.utils.parseEther('0.01');
    console.log('Using fixed gas amount:', hre.ethers.utils.formatEther(defaultGasAmount), 'ETH');
    
    // Check which method to use for sending
    if (typeof contract.send === 'function') {
      console.log('Found send() function, using it to send message...');
      const tx = await contract.send(dstEid, message, options, {value: defaultGasAmount});
      const receipt = await tx.wait();
      console.log('🎉 Message sent! Transaction hash:', receipt.transactionHash);
    } 
    else {
      console.log('No send() function found. Looking for alternatives...');
      
      // Check if there's any function with "send" in its name
      const sendFunctions = functionNames.filter(name => 
        name.toLowerCase().includes('send') || 
        name.toLowerCase().includes('message')
      );
      
      if (sendFunctions.length === 0) {
        throw new Error('No suitable send function found on the contract. Available functions: ' + functionNames.join(', '));
      }
      
      console.log('Found possible send functions:', sendFunctions);
      console.log('Please modify the script to use one of these functions, or check your contract deployment.');
      throw new Error('No direct send function available. Please modify the script.');
    }
    
    console.log('Check message status on LayerZero Scan: https://testnet.layerzeroscan.com/');
  }); 