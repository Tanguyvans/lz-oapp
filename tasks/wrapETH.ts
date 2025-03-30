import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const WETH_ABI = [
    "function deposit() payable",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

const WETH_ADDRESS = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9"; // Sepolia WETH

task("wrap-eth", "Wrap ETH to WETH and approve Sepolia contract")
    .addParam("amount", "Amount of ETH to wrap (in ETH)")
    .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
        try {
            const { amount } = taskArgs;
            const [signer] = await hre.ethers.getSigners();

            // Get the deployed Sepolia contract address
            const sepoliaContract = await hre.deployments.get('SepoliaContract');
            console.log("Sepolia Contract Address:", sepoliaContract.address);

            console.log("\nWrapping ETH to WETH:");
            console.log("- From:", signer.address);
            console.log("- Amount:", amount, "ETH");

            const weth = await hre.ethers.getContractAt(WETH_ABI, WETH_ADDRESS, signer);

            // Check initial WETH balance
            const initialWETH = await weth.balanceOf(signer.address);
            console.log("\nInitial WETH Balance:", hre.ethers.utils.formatEther(initialWETH), "WETH");

            // Wrap ETH to WETH
            console.log("\nWrapping ETH...");
            const tx = await weth.deposit({
                value: hre.ethers.utils.parseEther(amount),
                gasLimit: 100000
            });

            console.log("Transaction sent:", tx.hash);
            await tx.wait();

            // Check new WETH balance
            const newWETH = await weth.balanceOf(signer.address);
            console.log("\nNew WETH Balance:", hre.ethers.utils.formatEther(newWETH), "WETH");

            // Approve Sepolia contract to spend WETH
            console.log("\nApproving Sepolia contract to spend WETH...");
            const approveTx = await weth.approve(
                sepoliaContract.address,
                hre.ethers.utils.parseEther("1000.0") // Large approval for multiple transactions
            );
            console.log("Approval transaction sent:", approveTx.hash);
            await approveTx.wait();

            console.log("\nSuccessfully wrapped ETH and approved Sepolia contract!");
            console.log("You can now use WETH for oracle requests");

        } catch (error: any) {
            console.error("\nError:", error.message);
            if (error.error) {
                console.error("Internal error:", error.error.message);
            }
            process.exit(1);
        }
    });

export default {}; 