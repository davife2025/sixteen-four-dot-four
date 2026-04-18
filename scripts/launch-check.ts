// ============================================================
// SIXTEEN — scripts/launch-check.ts
// Pre-launch verification checklist
// Run this before every testnet deployment to confirm
// the full system is wired together correctly.
//
// Usage: npx tsx scripts/launch-check.ts
// ============================================================

import { ethers } from 'ethers'

interface Check {
  label: string
  pass: boolean
  detail: string
}

const checks: Check[] = []
let totalPassed = 0
let totalFailed = 0

function check(label: string, condition: boolean, detail: string): void {
  checks.push({ label, pass: condition, detail })
  if (condition) { totalPassed++; process.stdout.write(`  ✓ ${label}\n`) }
  else { totalFailed++; process.stdout.write(`  ✗ ${label} — ${detail}\n`) }
}

async function runLaunchCheck(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║   SIXTEEN Pre-Launch Verification Checklist   ║')
  console.log('╚══════════════════════════════════════════════╝\n')

  // ── Environment Variables ─────────────────────────────

  console.log('── Environment Variables')
  const envVars = [
    'HF_TOKEN',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'BSC_TESTNET_RPC_URL',
    'AGENT_PRIVATE_KEY',
    'MODELSLAB_API_KEY',
    'SUPERMEME_API_KEY',
    'BITQUERY_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  for (const key of envVars) {
    const val = process.env[key]
    check(key, !!val && val.length > 5, 'missing or too short')
  }

  // ── Wallet ────────────────────────────────────────────

  console.log('\n── Agent Wallet')
  const privateKey = process.env['AGENT_PRIVATE_KEY']
  let walletAddress = ''

  try {
    if (privateKey) {
      const wallet = new ethers.Wallet(privateKey)
      walletAddress = wallet.address
      check('Private key valid', true, walletAddress)
    }
  } catch {
    check('Private key valid', false, 'invalid format — must be 64 hex chars')
  }

  if (walletAddress) {
    try {
      const rpc = process.env['BSC_TESTNET_RPC_URL'] ?? 'https://data-seed-prebsc-1-s1.binance.org:8545'
      const provider = new ethers.JsonRpcProvider(rpc)
      const balance  = await provider.getBalance(walletAddress)
      const bnb      = parseFloat(ethers.formatEther(balance))
      check('Wallet balance > 0.1 BNB', bnb > 0.1, `${bnb.toFixed(4)} BNB — fund at testnet.binance.org/faucet-smart`)
    } catch {
      check('Wallet balance check', false, 'could not connect to RPC')
    }
  }

  // ── Kimi K2 ───────────────────────────────────────────

  console.log('\n── Kimi K2 (Hugging Face)')
  const hfToken = process.env['HF_TOKEN']
  if (hfToken) {
    try {
      const { default: OpenAI } = await import('openai')
      const client = new OpenAI({
        baseURL: 'https://router.huggingface.co/v1',
        apiKey:  hfToken,
      })
      const res = await client.chat.completions.create({
        model:    'moonshotai/Kimi-K2-Instruct-0905',
        messages: [{ role: 'user', content: 'say OK' }],
        max_tokens: 5,
      })
      check('Kimi K2 API responds', !!res.choices[0], 'no response')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      check('Kimi K2 API responds', false, msg)
    }
  }

  // ── Supabase ──────────────────────────────────────────

  console.log('\n── Supabase')
  const supabaseUrl = process.env['SUPABASE_URL']
  const supabaseSvc = process.env['SUPABASE_SERVICE_ROLE_KEY']

  if (supabaseUrl && supabaseSvc) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const db = createClient(supabaseUrl, supabaseSvc, { auth: { persistSession: false } })

      const tables = ['users', 'agents', 'meme_tokens', 'agent_trades',
                      'competition_rounds', 'leaderboard', 'predictions', 'copy_follows', 'agent_errors']

      for (const table of tables) {
        const { error } = await db.from(table).select('*').limit(1)
        check(`Table: ${table}`, !error, error?.message ?? '')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      check('Supabase connection', false, msg)
    }
  }

  // ── BNB Testnet RPC ───────────────────────────────────

  console.log('\n── BNB Testnet')
  try {
    const rpc      = process.env['BSC_TESTNET_RPC_URL'] ?? 'https://data-seed-prebsc-1-s1.binance.org:8545'
    const provider = new ethers.JsonRpcProvider(rpc)
    const block    = await provider.getBlockNumber()
    const network  = await provider.getNetwork()
    check('RPC connected',         true,           `block #${block}`)
    check('Correct chainId (97)',   Number(network.chainId) === 97, `got chainId ${network.chainId}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    check('BNB testnet RPC', false, msg)
  }

  // ── Smart Contract ────────────────────────────────────

  console.log('\n── Smart Contract')
  const contractAddr = process.env['PREDICTION_CONTRACT_ADDRESS']
  check('PREDICTION_CONTRACT_ADDRESS set', !!contractAddr, 'deploy contracts/ first: pnpm deploy:testnet')

  if (contractAddr && ethers.isAddress(contractAddr)) {
    try {
      const rpc      = process.env['BSC_TESTNET_RPC_URL'] ?? 'https://data-seed-prebsc-1-s1.binance.org:8545'
      const provider = new ethers.JsonRpcProvider(rpc)
      const code     = await provider.getCode(contractAddr)
      check('Contract deployed on-chain', code !== '0x', 'no contract code at address')
    } catch {
      check('Contract code check', false, 'RPC error')
    }
  }

  // ── Summary ───────────────────────────────────────────

  console.log('\n════════════════════════════════════════')
  console.log(`Results: ${totalPassed} passed  ${totalFailed} failed`)

  if (totalFailed === 0) {
    console.log('\n🚀 All checks passed — Sixteen is ready to launch!\n')
    console.log('Start the platform:')
    console.log('  Terminal 1: pnpm agent:start')
    console.log('  Terminal 2: pnpm api:start')
    console.log('  Terminal 3: pnpm web:dev\n')
  } else {
    console.log('\n⚠  Fix the failing checks above before launching.\n')
    process.exit(1)
  }
}

runLaunchCheck().catch((err) => {
  console.error('Launch check crashed:', err)
  process.exit(1)
})
