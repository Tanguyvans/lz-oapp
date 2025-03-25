import { ethers } from "hardhat";
import FlowContractArtifact from "../artifacts/contracts/FlowContract.sol/FlowContract.json";

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Using address:", signer.address);

    const FLOW_CONTRACT_ADDRESS = "0x1431c544f55a6bb98e599865811556c3f2cc4f9d";

    const flowContract = new ethers.Contract(
        FLOW_CONTRACT_ADDRESS,
        FlowContractArtifact.abi,
        signer
    );

    try {
        // 1. Check all roles
        const owner = await flowContract.owner();
        const isAdmin = await flowContract.admins(signer.address);
        const isBetCreator = await flowContract.betCreators(signer.address);

        console.log("\nRole Check:");
        console.log("Contract Address:", FLOW_CONTRACT_ADDRESS);
        console.log("Owner:", owner);
        console.log("Your Address:", signer.address);
        console.log("Is Owner:", owner.toLowerCase() === signer.address.toLowerCase());
        console.log("Is Admin:", isAdmin);
        console.log("Is Bet Creator:", isBetCreator);

        // 2. Try to create a simple market with detailed error handling
        const marketData = {
            title: "Test Market",
            description: "Test Description",
            options: ["Option1", "Option2"],
            expirationDate: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            verificationTime: 3600, // 1 hour
            imageUrl: "https://example.com/image.jpg",
            category: 0 // CULTURE
        };

        console.log("\nAttempting to create market with data:", marketData);

        // 3. Create market with gas estimation
        const gasEstimate = await flowContract.estimateGas.createMarketAdmin(
            marketData.title,
            marketData.description,
            marketData.options,
            marketData.expirationDate,
            marketData.verificationTime,
            marketData.imageUrl,
            marketData.category
        );

        console.log("Estimated gas:", gasEstimate.toString());

        const tx = await flowContract.createMarketAdmin(
            marketData.title,
            marketData.description,
            marketData.options,
            marketData.expirationDate,
            marketData.verificationTime,
            marketData.imageUrl,
            marketData.category,
            {
                gasLimit: Math.floor(gasEstimate.toNumber() * 1.2) // Add 20% buffer
            }
        );

        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("Transaction confirmed in block:", receipt.blockNumber);

    } catch (error) {
        console.error("\nDetailed Error Information:");
        console.error("Error message:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
        if (error.transaction) {
            console.error("Failed transaction:", {
                from: error.transaction.from,
                to: error.transaction.to,
                data: error.transaction.data,
                value: error.transaction.value,
                gasLimit: error.transaction.gasLimit?.toString()
            });
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 