import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("get-sepolia-markets", "Get details of markets on Sepolia contract")
    .setAction(async (_, hre: HardhatRuntimeEnvironment) => {
        try {
            // Get the SepoliaContract
            const sepoliaContract = await hre.ethers.getContractAt(
                "SepoliaContract",
                "0x0bB490b50f08Ca02a74eC835F34D138389BE0e92"
            );

            console.log("Checking markets on Sepolia...\n");

            // Try to get details for first few markets (1-5)
            for (let marketId = 1; marketId <= 5; marketId++) {
                try {
                    const market = await sepoliaContract.getMarket(marketId);
                    console.log(`Market ${marketId}:`);
                    console.log("- Market ID:", market._marketId.toString());
                    console.log("- Reward:", hre.ethers.utils.formatEther(market.reward), "ETH");
                    console.log("- Bond:", hre.ethers.utils.formatEther(market.bond), "ETH");
                    console.log("- Question:", hre.ethers.utils.toUtf8String(market.questionText));
                    console.log("- Verification Time:", market.verificationTime.toString());
                    console.log("- Option Count:", market.optionCount.toString());
                    console.log("- Is Resolved:", market.isResolved);
                    console.log("- Outcome:", market.outcome.toString());
                    console.log(""); // Empty line for readability
                } catch (error: any) {
                    if (error.message.includes("Market does not exist")) {
                        console.log(`Market ${marketId} does not exist\n`);
                        break; // Stop checking if we hit a non-existent market
                    } else {
                        console.error(`Error checking market ${marketId}:`, error.message);
                    }
                }
            }

            // Get WETH balance of contract
            const wethBalance = await sepoliaContract.getWETHBalance();
            console.log("Contract WETH Balance:", hre.ethers.utils.formatEther(wethBalance), "WETH");

        } catch (error) {
            console.error("Error:", error);
            process.exit(1);
        }
    });

export default {}; 