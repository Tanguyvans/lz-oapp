// tasks/sendMessage.ts

import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

import {Options} from '@layerzerolabs/lz-v2-utilities';

export default task('sendMessage', 'Send a message from Sepolia to Flow')
  .addParam('dstNetwork', 'The destination network name (e.g., flow-testnet)')
  .addParam('message', 'The message to send')
  .addOptionalParam('address', 'The FlowContract address on Sepolia (optional)')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const {message, dstNetwork, address} = taskArgs;
    const [signer] = await hre.ethers.getSigners();

    // Verify we're on Sepolia
    if (!hre.network.name.includes('sepolia')) {
      console.error(`You need to run this task on Sepolia network. Current network: ${hre.network.name}`);
      console.error('Try: npx hardhat sendMessage --network sepolia-testnet ...');
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

    console.log('Sending message:');
    console.log('- From:', signer.address);
    console.log('- Source network:', hre.network.name, `(EID: ${srcEid})`);
    console.log('- Destination:', dstNetwork, `(EID: ${dstEid})`);
    console.log('- Message:', message);

    // Get contract address either from parameter or deployments
    let contractAddress;
    if (address) {
      contractAddress = address;
      console.log('Using provided contract address:', contractAddress);
    } else {
      try {
        const myOApp = await hre.deployments.get('FlowContract');
        contractAddress = myOApp.address;
        console.log('Using deployed contract address:', contractAddress);
      } catch (error) {
        console.error('Error: No deployment found for FlowContract and no address provided');
        
        // Try to list available deployments to help
        console.log('\nAvailable deployments on this network:');
        try {
          const deployments = await hre.deployments.all();
          if (Object.keys(deployments).length === 0) {
            console.log('No deployments found on this network.');
          } else {
            Object.keys(deployments).forEach(name => {
              console.log(`- ${name}: ${deployments[name].address}`);
            });
          }
        } catch (e) {
          console.log('Could not retrieve deployments list.');
        }
        
        console.log('\nPlease deploy the contract first or provide the address with --address parameter');
        return;
      }
    }
    
    const contract = await hre.ethers.getContractAt('FlowContract', contractAddress, signer);

    // Add executor options with gas limit
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toBytes();

    // Get quote for the message
    console.log('Getting quote...');
    try {
      const quotedFee = await contract.quote(dstEid, message, options, false);
      console.log('Quoted fee:', hre.ethers.utils.formatEther(quotedFee.nativeFee), 'ETH');

      // Send the message
      console.log('Sending message...');
      const tx = await contract.send(dstEid, message, options, {value: quotedFee.nativeFee});

      console.log('Transaction submitted. Waiting for confirmation...');
      const receipt = await tx.wait();
      console.log('🎉 Message sent! Transaction hash:', receipt.transactionHash);
      console.log(
        'Check message status on LayerZero Scan: https://testnet.layerzeroscan.com/tx/' +
          receipt.transactionHash,
      );
    } catch (error) {
      console.error('Error sending message:');
      console.error(error);
      
      // Try to provide more helpful information about the error
      if (error instanceof Error && 'reason' in error) {
        console.error('Reason:', error.reason);
      }
    }
  });