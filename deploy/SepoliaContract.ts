import assert from 'assert'
import { type DeployFunction } from 'hardhat-deploy/types'

const contractName = 'SepoliaContract'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')
    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)
    
    // Skip deployment if not on Sepolia network
    if (hre.network.name !== 'sepolia-testnet') {
        console.log(`Skipping ${contractName} deployment on ${hre.network.name}`)
        return
    }

    const endpointV2Deployment = await hre.deployments.get('EndpointV2')

    const { address } = await deploy(contractName, {
        from: deployer,
        args: [
            endpointV2Deployment.address, // LayerZero's EndpointV2 address
            deployer, // owner
        ],
        log: true,
        skipIfAlreadyDeployed: false,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)
}

deploy.tags = [contractName, 'sepolia']

export default deploy