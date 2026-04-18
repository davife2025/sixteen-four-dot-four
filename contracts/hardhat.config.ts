import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const AGENT_PRIVATE_KEY = process.env['AGENT_PRIVATE_KEY'] ?? '0x0000000000000000000000000000000000000000000000000000000000000001'

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    bscTestnet: {
      url:      'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId:  97,
      accounts: [AGENT_PRIVATE_KEY],
      gasPrice: 10_000_000_000, // 10 gwei
    },
    bscMainnet: {
      url:      'https://bsc-dataseed.binance.org/',
      chainId:  56,
      accounts: [AGENT_PRIVATE_KEY],
      gasPrice: 5_000_000_000,  // 5 gwei
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: process.env['BSCSCAN_API_KEY'] ?? '',
      bsc:        process.env['BSCSCAN_API_KEY'] ?? '',
    },
    customChains: [
      {
        network:    'bscTestnet',
        chainId:    97,
        urls: {
          apiURL:     'https://api-testnet.bscscan.com/api',
          browserURL: 'https://testnet.bscscan.com',
        },
      },
    ],
  },
  paths: {
    sources:   './contracts',
    tests:     './test',
    cache:     './cache',
    artifacts: './artifacts',
  },
}

export default config
