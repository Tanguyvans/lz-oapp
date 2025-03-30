import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Options } from "@layerzerolabs/lz-v2-utilities";

task("settle-market", "Settle a market on Sepolia after verification time")
    .addParam("marketId", "The ID of the market to settle")
    .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
        try {
            const { marketId } = taskArgs;
            const [signer] = await hre.ethers.getSigners();

            console.log("Settling market on Sepolia:");
            console.log("- From:", signer.address);
            console.log("- Market ID:", marketId);

            const sepoliaContract = await hre.ethers.getContractAt(
                "SepoliaContract",
                "0x0bB490b50f08Ca02a74eC835F34D138389BE0e92"
            );

            // Check if market can be settled
            const [canSettle, reason] = await sepoliaContract.canSettle(marketId);
            console.log("\nSettlement Check:");
            console.log("- Can settle:", canSettle);
            console.log("- Reason:", reason);

            if (!canSettle) {
                throw new Error(`Cannot settle market: ${reason}`);
            }

            // Get market details
            const market = await sepoliaContract.getMarket(marketId);
            console.log("\nMarket Details:");
            console.log("- Question:", hre.ethers.utils.toUtf8String(market.questionText));
            console.log("- Is Resolved:", market.isResolved);

            // Add executor options
            const options = Options.newOptions()
                .addExecutorLzReceiveOption(500000, 0)
                .toBytes();

            // Calculate the LayerZero fee (approx. 0.05 ETH)
            const layerZeroFee = hre.ethers.utils.parseEther("0.05");
            console.log("\nUsing LayerZero fee:", hre.ethers.utils.formatEther(layerZeroFee), "ETH");

            // Settle market
            console.log("\nSettling market...");
            const tx = await sepoliaContract.settleMarket(
                marketId,
                options,
                {
                    value: layerZeroFee,
                    gasLimit: 500000
                }
            );

            console.log("Transaction sent:", tx.hash);
            console.log("\nWaiting for confirmation...");
            const receipt = await tx.wait();
            console.log("Transaction confirmed in block:", receipt.blockNumber);
            console.log("Gas used:", receipt.gasUsed.toString());

            if (receipt.status === 0) {
                throw new Error("Transaction failed");
            }

            // Get updated market details
            const updatedMarket = await sepoliaContract.getMarket(marketId);
            console.log("\nMarket settled successfully!");
            console.log("- Outcome:", updatedMarket.outcome.toString());
            console.log("- Is Resolved:", updatedMarket.isResolved);

            console.log("\nCheck status on LayerZero Scan:");
            console.log(`https://testnet.layerzeroscan.com/tx/${receipt.transactionHash}`);

        } catch (error: any) {
            console.error("\nError:", error.message);
            if (error.error) {
                console.error("Internal error:", error.error.message);
            }
            if (error.transaction) {
                console.error("\nTransaction details:");
                console.error("- To:", error.transaction.to);
                if (error.transaction.value) {
                    console.error("- Value:", hre.ethers.utils.formatEther(error.transaction.value), "ETH");
                }
                if (error.transaction.gasLimit) {
                    console.error("- Gas limit:", error.transaction.gasLimit.toString());
                }
            }
            process.exit(1);
        }
    });

export default {}; 