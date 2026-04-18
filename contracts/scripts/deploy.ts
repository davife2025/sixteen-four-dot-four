// ============================================================
// SIXTEEN — contracts/scripts/deploy.ts
// Deploys SixteenPrediction to BNB testnet
// Run: npx hardhat run scripts/deploy.ts --network bscTestnet
// ============================================================

import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log('Deploying SixteenPrediction...')
  console.log('Deployer:', deployer.address)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('Balance:', ethers.formatEther(balance), 'BNB')

  // Deploy
  const Factory = await ethers.getContractFactory('SixteenPrediction')
  const contract = await Factory.deploy()
  await contract.waitForDeployment()

  const address = await contract.getAddress()
  console.log('\n✓ SixteenPrediction deployed to:', address)
  console.log('  Network: BNB Testnet (chainId 97)')
  console.log('  Tx hash:', contract.deploymentTransaction()?.hash)

  // Save address to a JSON file so apps can read it
  const deployment = {
    network:   'bscTestnet',
    chainId:   97,
    address,
    deployedAt: new Date().toISOString(),
    deployer:  deployer.address,
  }

  const outputPath = path.resolve(__dirname, '../deployments.json')
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2))
  console.log('\nDeployment info saved to contracts/deployments.json')

  console.log('\nNext steps:')
  console.log(`  1. Add to .env: PREDICTION_CONTRACT_ADDRESS=${address}`)
  console.log(`  2. Add to .env: NEXT_PUBLIC_PREDICTION_CONTRACT=${address}`)
  console.log('  3. Run: pnpm db:push  (to sync contract address to Supabase config)')
  console.log('  4. Verify on BscScan:')
  console.log(`     npx hardhat verify --network bscTestnet ${address}`)
}

main().catch((err) => {
  console.error('Deployment failed:', err)
  process.exit(1)
})
