import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("request-oracle-settlement", "Request UMA oracle settlement for a market")
    .addParam("marketId", "The ID of the market to settle")
    .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
        try {
            const { marketId } = taskArgs;
            const [signer] = await hre.ethers.getSigners();

            console.log("Requesting Oracle Settlement:");
            console.log("- From:", signer.address);
            console.log("- Market ID:", marketId);

            const sepoliaContract = await hre.ethers.getContractAt(
                "SepoliaContract",
                "0x0bB490b50f08Ca02a74eC835F34D138389BE0e92"
            );

            // Check market details first
            console.log("\nChecking market details...");
            const market = await sepoliaContract.getMarket(marketId);
            console.log("Market found:");
            console.log("- Question:", hre.ethers.utils.toUtf8String(market.questionText));
            console.log("- Is Resolved:", market.isResolved);
            console.log("- Reward:", hre.ethers.utils.formatEther(market.reward), "WETH");
            console.log("- Bond:", hre.ethers.utils.formatEther(market.bond), "WETH");

            if (market.isResolved) {
                throw new Error("Market is already resolved");
            }

            // Check WETH balance before deposit
            let wethBalance = await sepoliaContract.getWETHBalance();
            console.log("\nInitial Contract WETH Balance:", hre.ethers.utils.formatEther(wethBalance), "WETH");
            
            const requiredWETH = market.reward.add(market.bond);
            console.log("Required WETH:", hre.ethers.utils.formatEther(requiredWETH), "WETH");

            // If we need more WETH, deposit ETH
            if (wethBalance.lt(requiredWETH)) {
                const needed = requiredWETH.sub(wethBalance);
                console.log(`\nDepositing ${hre.ethers.utils.formatEther(needed)} ETH to get WETH...`);
                
                const depositTx = await sepoliaContract.depositETH({
                    value: needed,
                    gasLimit: 100000
                });
                
                console.log("Deposit transaction sent:", depositTx.hash);
                await depositTx.wait();
                
                // Verify new WETH balance
                wethBalance = await sepoliaContract.getWETHBalance();
                console.log("New Contract WETH Balance:", hre.ethers.utils.formatEther(wethBalance), "WETH");
                
                if (wethBalance.lt(requiredWETH)) {
                    throw new Error("WETH balance still insufficient after deposit");
                }
            }

            // Request oracle settlement
            console.log("\nRequesting oracle settlement...");
            const tx = await sepoliaContract.createOracleRequest(
                marketId,
                {
                    gasLimit: 500000 // Fixed gas limit for safety
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

            // Look for OracleRequestCreated event
            const oracleRequestEvent = receipt.events?.find(
                (e) => e.event === "OracleRequestCreated"
            );

            if (oracleRequestEvent) {
                console.log("\nOracle request created successfully!");
                console.log("- Market ID:", oracleRequestEvent.args?.marketId.toString());
                console.log("- Question:", hre.ethers.utils.toUtf8String(oracleRequestEvent.args?.questionText));
                console.log("- Timestamp:", new Date(oracleRequestEvent.args?.timestamp.toNumber() * 1000).toISOString());
            }

            // Check market status after request
            const updatedMarket = await sepoliaContract.getMarket(marketId);
            console.log("\nUpdated market status:");
            console.log("- Is Resolved:", updatedMarket.isResolved);
            console.log("- Current Outcome:", updatedMarket.outcome.toString());

            console.log("\nCheck the UMA Oracle for the request status.");

        } catch (error: any) {
            console.error("\nError:", error.message);
            if (error.error) {
                console.error("Internal error:", error.error.message);
            }
            if (error.transaction) {
                console.error("\nTransaction details:");
                console.error("- To:", error.transaction.to);
                if (error.transaction.gasLimit) {
                    console.error("- Gas limit:", error.transaction.gasLimit.toString());
                }
            }
            process.exit(1);
        }
    });

export default {}; 