// tasks/requestSettlement.ts

import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Options } from '@layerzerolabs/lz-v2-utilities';

// Hardcoded network EIDs
const NETWORK_EIDs = {
  'flow-testnet': 30401,
  'sepolia': 40161
};

export default task('request-settlement', 'Request settlement for a market')
  .addParam('marketId', 'The ID of the market to settle')
  .addParam('dstNetwork', 'The destination network (sepolia)')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { marketId, dstNetwork } = taskArgs;
    const [signer] = await hre.ethers.getSigners();

    const dstEid = NETWORK_EIDs[dstNetwork];
    if (!dstEid) {
      throw new Error(`Unsupported network: ${dstNetwork}`);
    }

    console.log('Requesting Settlement:');
    console.log('- From:', signer.address);
    console.log('- Market ID:', marketId);
    console.log('- Destination EID:', dstEid);

    try {
        const flowContract = await hre.deployments.get('FlowContract');
        console.log('Contract address:', flowContract.address);

        // Verify contract deployment
        const code = await hre.ethers.provider.getCode(flowContract.address);
        if (code === '0x') {
            throw new Error('Contract not deployed at this address');
        }

        const contract = await hre.ethers.getContractAt('FlowContract', flowContract.address, signer);

        // First check if market exists by getting total market count
        const marketCount = await contract.marketCount();
        console.log('\nTotal markets:', marketCount.toString());
        
        if (marketCount.lt(marketId)) {
            throw new Error(`Market ID ${marketId} does not exist. Total markets: ${marketCount}`);
        }

        // Check if user is admin
        const isAdmin = await contract.admins(signer.address);
        console.log('Is admin:', isAdmin);
        if (!isAdmin) {
            throw new Error('Caller is not an admin');
        }

        // Check market details
        const marketDetails = await contract.getMarketDetails(marketId);
        console.log('\nMarket Details:');
        console.log('- Description:', marketDetails.description);
        console.log('- Is Resolved:', marketDetails.isResolved);
        console.log('- Expiration:', new Date(marketDetails.expirationDate * 1000).toISOString());
        console.log('- Request Time:', marketDetails.requestTime.toString());

        if (marketDetails.isResolved) {
            throw new Error('Market already resolved');
        }

        if (marketDetails.requestTime.toString() !== '0') {
            throw new Error('Settlement already requested');
        }

        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime < marketDetails.expirationDate) {
            throw new Error(`Market has not expired yet. Expires at ${new Date(marketDetails.expirationDate * 1000).toISOString()}`);
        }

        // Set reward and bond amounts (0.1 ETH each)
        const reward = hre.ethers.utils.parseEther("0.1");
        const bond = hre.ethers.utils.parseEther("0.1");

        // Add executor options with higher gas limit
        const options = Options.newOptions()
            .addExecutorLzReceiveOption(350000, 0)
            .toBytes();

        // Get settlement fee
        console.log('\nGetting settlement fee...');
        const quotedFee = await contract.getSettlementFee(
            marketId,
            reward,
            bond,
            dstEid,
            options
        );
        
        const feeWithBuffer = quotedFee.nativeFee.mul(120).div(100);
        console.log('Fee (with 20% buffer):', hre.ethers.utils.formatEther(feeWithBuffer), 'ETH');

        // Check if user has enough ETH
        const balance = await signer.getBalance();
        if (balance.lt(feeWithBuffer)) {
            throw new Error(`Insufficient ETH balance. Need ${hre.ethers.utils.formatEther(feeWithBuffer)} ETH but have ${hre.ethers.utils.formatEther(balance)} ETH`);
        }

        // Request settlement with fixed gas limit
        console.log('\nRequesting settlement...');
        const tx = await contract.requestSettlement(
            marketId,
            reward,
            bond,
            dstEid,
            options,
            {
                value: feeWithBuffer,
                gasLimit: 500000 // Fixed gas limit instead of estimation
            }
        );

        console.log('Transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('Transaction confirmed in block:', receipt.blockNumber);
        console.log('Gas used:', receipt.gasUsed.toString());

        if (receipt.status === 0) {
            throw new Error('Transaction failed');
        }

        console.log('\nCheck status on LayerZero Scan:');
        console.log(`https://testnet.layerzeroscan.com/tx/${receipt.transactionHash}`);
    } catch (error: any) {
        console.error('\nError:', error.message);
        if (error.error) {
            console.error('Internal error:', error.error.message);
        }
        if (error.transaction) {
            console.error('\nTransaction details:');
            console.error('- To:', error.transaction.to);
            if (error.transaction.value) {
                console.error('- Value:', hre.ethers.utils.formatEther(error.transaction.value), 'ETH');
            }
            if (error.transaction.gasLimit) {
                console.error('- Gas limit:', error.transaction.gasLimit.toString());
            }
            console.error('- Data:', error.transaction.data);
        }
        process.exit(1);
    }
});