import { EndpointId } from '@layerzerolabs/lz-definitions'

import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

const sepoliaContract: OmniPointHardhat = {
    eid: EndpointId.SEPOLIA_V2_TESTNET,
    contractName: 'SepoliaContract',  // Changed from 'MyOApp'
}

const flowContract: OmniPointHardhat = {
    eid: EndpointId.FLOW_V2_TESTNET,
    contractName: 'FlowContract',  // Changed from 'MyOApp'
}

const config: OAppOmniGraphHardhat = {
    contracts: [
        {
            contract: sepoliaContract,
        },
        {
            contract: flowContract,
        },
    ],
    connections: [
        {
            from: flowContract,
            to: sepoliaContract,
        },
        {
            from: sepoliaContract,
            to: flowContract,
        }
    ],
}

export default config