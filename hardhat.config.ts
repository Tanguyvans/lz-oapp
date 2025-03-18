// Get the environment configuration from .env file
//
// To make use of automatic environment setup:
// - Duplicate .env.example file and name it .env
// - Fill in the environment variables
import 'dotenv/config'

import 'hardhat-deploy'
import 'hardhat-contract-sizer'
import '@nomiclabs/hardhat-ethers'
import '@layerzerolabs/toolbox-hardhat'

import { HardhatUserConfig, HttpNetworkAccountsUserConfig } from 'hardhat/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'
import './tasks/sendMessage';

// Set your preferred authentication method
//
// If you prefer using a mnemonic, set a MNEMONIC environment variable
// to a valid mnemonic
const MNEMONIC = process.env.MNEMONIC

// If you prefer to be authenticated using a private key, set a PRIVATE_KEY environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY

const accounts: HttpNetworkAccountsUserConfig | undefined = MNEMONIC
    ? { mnemonic: MNEMONIC }
    : PRIVATE_KEY
      ? [PRIVATE_KEY]
      : undefined

if (accounts == null) {
    console.warn(
        'Could not find MNEMONIC or PRIVATE_KEY environment variables. It will not be possible to execute transactions in your example.'
    )
}

const config: HardhatUserConfig = {
    paths: {
        cache: 'cache/hardhat',
    },
    solidity: {
        compilers: [
            {
                version: '0.8.22',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
       
    
    networks: {
        'sepolia-testnet': {
            eid: EndpointId.SEPOLIA_V2_TESTNET,
            url: process.env.RPC_URL_SEPOLIA || 'https://eth-sepolia.g.alchemy.com/v2/NC8ECPLoaJ3SxtjqH9AVBli3wAxzWpxr',
            accounts,
        },
        'avalanche-testnet': {
            eid: EndpointId.AVALANCHE_V2_TESTNET,
            url: process.env.RPC_URL_FUJI || 'https://rpc.ankr.com/avalanche_fuji',
            accounts,
        },
        'amoy-testnet': {
            eid: EndpointId.AMOY_V2_TESTNET,
            url: process.env.RPC_URL_AMOY || 'https://polygon-amoy-bor-rpc.publicnode.com',
            accounts,
        },
        'flow-testnet': {
            eid: EndpointId.FLOW_V2_TESTNET,
            url: process.env.RPC_URL_FLOW_TESTNET || 'https://testnet.evm.nodes.onflow.org',
            accounts,
        },
        'abstract-testnet': {
            eid: EndpointId.ABSTRACT_V2_TESTNET,
            url: process.env.RPC_URL_ABSTRACT_TESTNET || 'https://api.testnet.abs.xyz',
            accounts,
        },
        hardhat: {
            // Need this for testing because TestHelperOz5.sol is exceeding the compiled contract size limit
            allowUnlimitedContractSize: true,
        },
    },
    namedAccounts: {
        deployer: {
            default: 0, // wallet address of index[0], of the mnemonic in .env
        },
    },

    etherscan: {
        apiKey: {
            sepolia: process.env.ETHERSCAN_API_KEY || '',
            avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || '',
            amoyTestnet: process.env.POLYGONSCAN_API_KEY || '',
            flowTestnet: 'empty',
            abstractTestnet: process.env.ABSCAN_TESTNET_API_KEY || '',
            abstractMainnet: process.env.ABSCAN_MAINNET_API_KEY || '',
        },
        customChains: [
            {
                network: "amoyTestnet",
                chainId: 80002,
                    urls: {
                    apiURL: "https://api-amoy.polygonscan.com/api",
                    browserURL: "https://amoy.polygonscan.com/"
                }
            },
            {
                network: "flowTestnet",
                chainId: 545,
                urls: {
                  apiURL: "https://evm-testnet.flowscan.io/api",
                  browserURL: "https://evm-testnet.flowscan.io"
                }
            },
            {
                network: "abstractTestnet",
                chainId: 11124,
                urls: {
                    apiURL: "https://api-sepolia.abscan.org/api",
                    browserURL: "https://sepolia.abscan.org/",
                }
            },
            {
                network: "abstractMainnet",
                chainId: 2741,
                urls: {
                    apiURL: "https://api.abscan.org/api",
                    browserURL: "https://abscan.org/",
                }
            }
            
        ]
    },
}

export default config
