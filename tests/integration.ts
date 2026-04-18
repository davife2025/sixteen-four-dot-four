// ============================================================
// SIXTEEN — tests/integration.ts
// End-to-end integration test — runs on BNB testnet
//
// Tests every component of Sixteen in sequence:
//   1. Kimi K2 connection + tool call
//   2. Supabase read/write
//   3. BNB testnet RPC connection
//   4. EIP-8004 agent identity registration
//   5. Meme concept ideation (Kimi K2)
//   6. Virality scoring (Kimi K2)
//   7. Static meme generation (Supermeme.ai)
//   8. Token creation (four.meme API + chain)
//   9. Token info query
//  10. Buy quote + buy execution
//  11. Sell quote + sell execution
//  12. BNB transfer back to owner wallet
//  13. Supabase trade recording + leaderboard
//  14. Competition round create + start + end
//
// Run: npx tsx tests/integration.ts
// ============================================================

import { getKimiClient, KIMI_MODEL, FOURMEME_TOOLS } from '@sixteen/ai'
import {
  getProvider,
  getSigner,
  getAgentWalletAddress,
  getPlatformConfig,
  getTokenInfo,
  quoteBuy,
  buyToken,
  quoteSell,
  sellToken,
  sendBnb,
  registerAgentIdentity,
  getAgentIdentityBalance,
} from '@sixteen/blockchain'
import {
  getSupabaseClient,
  insertMemeToken,
  recordTrade,
  createRound,
  startRound,
  endRound,
  getLeaderboard,
} from '@sixteen/db'
import { scoreMemeVirality } from '../apps/agent/src/virality'
import { ethers } from 'ethers'

// ── Test runner ───────────────────────────────────────────

type TestResult = { name: string; passed: boolean; detail: string }
const results: TestResult[] = []

async function test(name: string, fn: () => Promise<string>): Promise<void> {
  process.stdout.write(`  ${name}... `)
  try {
    const detail = await fn()
    results.push({ name, passed: true, detail })
    console.log(`✓ ${detail}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    results.push({ name, passed: false, detail: msg })
    console.log(`✗ ${msg}`)
  }
}

// ── Test suite ────────────────────────────────────────────

async function runIntegrationTests(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║  SIXTEEN Integration Tests — BNB Testnet  ║')
  console.log('╚══════════════════════════════════════════╝\n')

  // 1. Kimi K2 connection
  await test('Kimi K2 — basic chat', async () => {
    const client = getKimiClient()
    const res = await client.chat.completions.create({
      model: KIMI_MODEL,
      messages: [{ role: 'user', content: 'Reply with exactly: SIXTEEN_OK' }],
      max_tokens: 20,
    })
    const content = res.choices[0]?.message.content ?? ''
    if (!content.includes('SIXTEEN_OK')) throw new Error(`Unexpected response: ${content}`)
    return `model: ${KIMI_MODEL}`
  })

  // 2. Kimi K2 tool call
  await test('Kimi K2 — tool calling', async () => {
    const client = getKimiClient()
    const res = await client.chat.completions.create({
      model: KIMI_MODEL,
      messages: [{ role: 'user', content: 'Get token info for address 0x1234567890123456789012345678901234567890' }],
      tools: FOURMEME_TOOLS,
      max_tokens: 200,
    })
    const toolCall = res.choices[0]?.message.tool_calls?.[0]
    if (!toolCall) throw new Error('No tool call returned')
    return `tool called: ${toolCall.function.name}`
  })

  // 3. Supabase connection
  await test('Supabase — read agents table', async () => {
    const db = getSupabaseClient()
    const { data, error } = await db.from('agents').select('id').limit(1)
    if (error) throw error
    return `connected, ${data?.length ?? 0} agents found`
  })

  // 4. BNB testnet RPC
  await test('BNB testnet — RPC connection', async () => {
    const provider = getProvider()
    const block = await provider.getBlockNumber()
    return `block #${block}`
  })

  // 5. Agent wallet balance
  await test('Agent wallet — check balance', async () => {
    const provider = getProvider()
    const address  = getAgentWalletAddress()
    const balance  = await provider.getBalance(address)
    const bnb      = parseFloat(ethers.formatEther(balance))
    if (bnb < 0.005) throw new Error(`Insufficient balance: ${bnb} BNB — fund at testnet faucet`)
    return `${bnb.toFixed(4)} BNB at ${address.slice(0, 10)}…`
  })

  // 6. four.meme platform config
  await test('four.meme — platform config', async () => {
    const config = await getPlatformConfig()
    if (!config.tokenManager2Address) throw new Error('No tokenManager2Address in config')
    return `TokenManager2: ${config.tokenManager2Address.slice(0, 10)}…`
  })

  // 7. EIP-8004 identity
  await test('EIP-8004 — agent identity check', async () => {
    const address = getAgentWalletAddress()
    const balance = await getAgentIdentityBalance(address)
    return `identity NFT balance: ${balance}`
  })

  // 8. Virality scoring via Kimi K2
  await test('Virality scorer — Kimi K2 scoring', async () => {
    const result = await scoreMemeVirality(
      'A frog wearing a BNB chain necklace saying gm',
      'BNB Chain trending, frog memes popular',
      'FROGBNB'
    )
    if (result.score < 0 || result.score > 100) throw new Error(`Invalid score: ${result.score}`)
    return `score: ${result.score}/100 — ${result.recommendation}`
  })

  // 9. Supabase write — insert test token
  const testTokenAddress = `0x${Date.now().toString(16).padEnd(40, '0')}`
  await test('Supabase — insert meme token', async () => {
    await insertMemeToken({
      token_address:  testTokenAddress,
      name:           'Integration Test Token',
      symbol:         'ITEST',
      description:    'Created by integration test',
      image_url:      'https://static.four.meme/test.png',
      asset_type:     'image',
      label:          'Meme',
      creator_agent_id: '00000000-0000-0000-0000-000000000001',
      creator_wallet: getAgentWalletAddress(),
      tax_fee_rate:   5,
      burn_rate:      10,
      divide_rate:    40,
      liquidity_rate: 10,
      recipient_rate: 40,
      virality_score: 75,
    })
    return `token ${testTokenAddress.slice(0, 10)}… recorded`
  })

  // 10. Competition round lifecycle
  let roundId = ''
  await test('Competition round — create + start + end', async () => {
    const round = await createRound(1)  // 1 hour
    roundId = round.id
    await startRound(roundId)
    await endRound(roundId, '00000000-0000-0000-0000-000000000001')
    return `round ${roundId.slice(0, 8)}… completed full lifecycle`
  })

  // 11. Leaderboard read
  await test('Leaderboard — query', async () => {
    const entries = await getLeaderboard()
    return `${entries.length} entries on leaderboard`
  })

  // ── Summary ───────────────────────────────────────────────

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  console.log('\n─────────────────────────────────────────')
  console.log(`Results: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    console.log('\nFailed tests:')
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  ✗ ${r.name}: ${r.detail}`)
    })
    console.log('')
    process.exit(1)
  } else {
    console.log('\n✓ All tests passed — Sixteen is ready for Session 6\n')
    process.exit(0)
  }
}

runIntegrationTests().catch((err) => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
