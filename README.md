<p align="center">
  <a href="https://layerzero.network">
    <img alt="LayerZero" style="width: 400px" src="https://docs.layerzero.network/img/LayerZero_Logo_White.svg"/>
  </a>
</p>

<p align="center">
  <a href="https://layerzero.network" style="color: #a77dff">Homepage</a> | <a href="https://docs.layerzero.network/" style="color: #a77dff">Docs</a> | <a href="https://layerzero.network/developers" style="color: #a77dff">Developers</a>
</p>

<h1 align="center">OApp Example</h1>

<p align="center">
  <a href="https://docs.layerzero.network/contracts/oapp" style="color: #a77dff">Quickstart</a> | <a href="https://docs.layerzero.network/contracts/oapp-configuration" style="color: #a77dff">Configuration</a> | <a href="https://docs.layerzero.network/contracts/options" style="color: #a77dff">Message Execution Options</a> | <a href="https://docs.layerzero.network/contracts/endpoint-addresses" style="color: #a77dff">Endpoint Addresses</a>
</p>

<p align="center">Template project for getting started with LayerZero's  <code>OApp</code> contract development.</p>

## 1) Developing Contracts

#### Installing dependencies

We recommend using `pnpm` as a package manager (but you can of course use a package manager of your choice):

```bash
pnpm install
```

#### Compiling your contracts

This project supports both `hardhat` and `forge` compilation. By default, the `compile` command will execute both:

```bash
pnpm compile
```

If you prefer one over the other, you can use the tooling-specific commands:

```bash
pnpm compile:forge
pnpm compile:hardhat
```

Or adjust the `package.json` to for example remove `forge` build:

```diff
- "compile": "$npm_execpath run compile:forge && $npm_execpath run compile:hardhat",
- "compile:forge": "forge build",
- "compile:hardhat": "hardhat compile",
+ "compile": "hardhat compile"
```

#### Running tests

Similarly to the contract compilation, we support both `hardhat` and `forge` tests. By default, the `test` command will execute both:

```bash
pnpm test
```

If you prefer one over the other, you can use the tooling-specific commands:

```bash
pnpm test:forge
pnpm test:hardhat
```

Or adjust the `package.json` to for example remove `hardhat` tests:

```diff
- "test": "$npm_execpath test:forge && $npm_execpath test:hardhat",
- "test:forge": "forge test",
- "test:hardhat": "$npm_execpath hardhat test"
+ "test": "forge test"
```

## 2) Deploying Contracts

Set up deployer wallet/account:

- Rename `.env.example` -> `.env`
- Choose your preferred means of setting up your deployer wallet/account:

```
MNEMONIC="test test test test test test test test test test test junk"
or...
PRIVATE_KEY="0xabc...def"
```

To deploy your contracts to your desired blockchains, run the following command in your project's folder:

```bash
npx hardhat lz:deploy
```

More information about available CLI arguments can be found using the `--help` flag:

```bash
npx hardhat lz:deploy --help
```

By following these steps, you can focus more on creating innovative omnichain solutions and less on the complexities of cross-chain communication.

<br></br>

<p align="center">
  Join our <a href="https://layerzero.network/community" style="color: #a77dff">community</a>! | Follow us on <a href="https://x.com/LayerZero_Labs" style="color: #a77dff">X (formerly Twitter)</a>
</p>

npx hardhat lz:oapp:wire --oapp-config layerzero.config.ts

npx hardhat lz:oapp:peers:get --oapp-config layerzero.config.ts

npx hardhat sendMessage --network sepolia-testnet --dst-network flow-testnet --message "Hello Omnichain World (sent from Avalanche)"

npx hardhat sendMessage --network flow-testnet --dst-network sepolia-testnet --message "Hello Omnichain World (sent from Flow)"

npx hardhat verify --network sepolia-testnet 0xe41d09eEb20cd7A4d53a61E81a76f33B051012CD 0x6EDCE65403992e310A62460808c4b910D972f10f 0x504b635B7E22F8DF7d037cf31639811AE583E9f0

contract, endpoint, deployer
npx hardhat verify --network flow-testnet 0x2b5a4aE5490834a5F232fD00AE54BbF90425EF94 0xcb566e3B6934Fa77258d68ea18E931fa75e1aaAa 0x504b635B7E22F8DF7d037cf31639811AE583E9f0

npx hardhat verify --network sepolia-testnet --contract "contracts/SepoliaContract.sol:SepoliaContract" 0xe41d09eEb20cd7A4d53a61E81a76f33B051012CD 0x6EDCE65403992e310A62460808c4b910D972f10f 0x504b635B7E22F8DF7d037cf31639811AE583E9f0

npx hardhat verify --network flow-testnet --contract "contracts/FlowContract.sol:FlowContract" 0x2b5a4aE5490834a5F232fD00AE54BbF90425EF94 0xcb566e3B6934Fa77258d68ea18E931fa75e1aaAa 0x504b635B7E22F8DF7d037cf31639811AE583E9f0
