'use client'
// ============================================================
// SIXTEEN — /how-it-works
// Shows ALL 12 four.meme skills and exactly how each one
// is used by Kimi K2 agents in the platform.
// Includes a live feed of skill calls from the agent engine.
// ============================================================

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import Link from 'next/link'

// ── All 12 four.meme skills ───────────────────────────────

const SKILLS = [
  {
    id:       'create-instant',
    num:      '01',
    name:     'create-instant',
    group:    'Create',
    who:      'Creator Agent',
    color:    'var(--green)',
    what:     'Launches a new meme token on the four.meme bonding curve.',
    how:      'After Kimi K2 scores a concept ≥60 virality, the creator agent calls this skill with the token name, symbol, image URL, fee config, and creator wallet. four.meme mints the token on-chain via TokenManager2.',
    result:   'Token address + tx hash. Token is immediately live and tradeable in Insider Phase.',
    code:     `await createMemeToken({
  name: "Pepe on BNB",
  symbol: "PEPEBNB",
  imageUrl: "https://...",
  recipientAddress: ownerWallet,
  recipientRate: 40  // 40% of fees to creator
})`,
  },
  {
    id:       'token-info',
    num:      '02',
    name:     'token-info',
    group:    'Read',
    who:      'Trader Agent',
    color:    'var(--green)',
    what:     'Reads the full state of any token on four.meme.',
    how:      'Trader agent calls this before every potential buy. Gets bonding curve % filled, current price, phase (insider/public/graduated), total funds raised, and max funds target.',
    result:   'TokenInfo object — agent uses bondingCurvePct and phase to decide whether to enter.',
    code:     `const info = await getTokenInfo(tokenAddress)
// info.bondingCurvePct < 40  → still early
// info.phase === 'insider'   → Insider Phase open`,
  },
  {
    id:       'quote-buy',
    num:      '03',
    name:     'quote-buy',
    group:    'Read',
    who:      'Trader Agent',
    color:    'var(--green)',
    what:     'Simulates a buy — calculates exactly how many tokens you get for your BNB.',
    how:      'Always called before buyToken. Kimi K2 receives the quote and confirms the amount is acceptable before committing real BNB. Prevents slippage surprises.',
    result:   'tokenAmount in wei + priceImpact %. Agent only proceeds if impact < threshold.',
    code:     `const quote = await quoteBuy(tokenAddress, "0.05")
// quote.tokenAmount — tokens you receive
// quote.priceImpact — slippage %`,
  },
  {
    id:       'buy',
    num:      '04',
    name:     'buy',
    group:    'Trade',
    who:      'Trader Agent',
    color:    'var(--green)',
    what:     'Buys tokens on the four.meme bonding curve in Insider Phase.',
    how:      'Only called after quote-buy confirms acceptable terms. Requires the agent wallet to have an EIP-8004 identity (Skill 10) to access Insider Phase. Sends BNB to TokenManager2.',
    result:   'tx hash + actual tokenAmount received. Position recorded in Supabase.',
    code:     `const result = await buyToken(tokenAddress, "0.05", minTokensWei)
// result.txHash    — on-chain confirmation
// result.tokenAmount — actual tokens bought`,
  },
  {
    id:       'quote-sell',
    num:      '05',
    name:     'quote-sell',
    group:    'Read',
    who:      'Trader Agent',
    color:    'var(--yellow)',
    what:     'Simulates a sell — calculates BNB return for your token position.',
    how:      'Called every cycle for each open position. Agent compares return vs entry cost to calculate P&L %. Triggers exit if +30% profit or -15% stop-loss.',
    result:   'fundsReturn in wei. Agent calculates pnlPct = (return - entry) / entry × 100.',
    code:     `const quote = await quoteSell(tokenAddress, position.tokenAmountWei)
const returnBnb = formatEther(quote.fundsReturn)
const pnlPct = (returnBnb - entryBnb) / entryBnb * 100`,
  },
  {
    id:       'sell',
    num:      '06',
    name:     'sell',
    group:    'Trade',
    who:      'Trader Agent',
    color:    'var(--yellow)',
    what:     'Sells token position back to the bonding curve for BNB.',
    how:      'Called when P&L hits +30% or -15%. Redeems all held tokens for BNB. After selling, if profit > 0, calls send-bnb (Skill 09) to route the profit to the owner wallet.',
    result:   'tx hash + fundsReturn. Net P&L recorded. Profit routed to owner.',
    code:     `const result = await sellToken(tokenAddress, tokenAmountWei, minFundsWei)
// result.txHash — on-chain tx
if (pnlBnb > 0) await sendBnb(ownerWallet, profitWei)`,
  },
  {
    id:       'events',
    num:      '07',
    name:     'events',
    group:    'Read',
    who:      'Trader Agent',
    color:    'var(--green)',
    what:     'Reads live events from the four.meme exchange contract.',
    how:      'Every agent cycle, trader reads the last 50 BSC blocks for TokenCreate, TokenPurchase, TokenSale, and LiquidityAdded events. New TokenCreate events trigger token evaluation.',
    result:   'Array of TokenEvent objects. Trader only evaluates tokens it discovers via this stream — not via polling.',
    code:     `const events = await getRecentEvents(fromBlock, toBlock)
const newTokens = events.filter(e => e.type === 'TokenCreate')
// Each new token goes through evaluation pipeline`,
  },
  {
    id:       'tax-info',
    num:      '08',
    name:     'tax-info',
    group:    'Read',
    who:      'Trader Agent',
    color:    'var(--yellow)',
    what:     'Reads the creator royalty configuration of a token.',
    how:      'Before buying, trader checks the TaxToken config. If rateFounder > 60%, the token is skipped — too much fee goes to the creator, leaving less for traders. Also checks for anti-sniper mode.',
    result:   'TaxInfo with rateFounder, rateBurn, rateLiquidity, feePlan. Filters out high-tax tokens.',
    code:     `const tax = await getTaxInfo(tokenAddress)
if (tax.rateFounder > 60) {
  // skip — creator takes too much
  return
}`,
  },
  {
    id:       'send-bnb',
    num:      '09',
    name:     'send-bnb',
    group:    'Transfer',
    who:      'Trader Agent',
    color:    'var(--yellow)',
    what:     'Routes BNB profit from the agent wallet to the owner wallet.',
    how:      'After every successful sell that produces positive P&L, the net profit is transferred from the agent wallet to the owner wallet. This is how you actually receive money.',
    result:   'tx hash. Owner wallet balance increases by the profit amount.',
    code:     `if (pnlBnb > 0) {
  const profitWei = parseEther(pnlBnb.toFixed(8))
  const txHash = await sendBnb(ownerWallet, profitWei)
  // Money is now in your wallet
}`,
  },
  {
    id:       '8004-register',
    num:      '10',
    name:     '8004-register',
    group:    'Identity',
    who:      'All Agents',
    color:    'var(--green)',
    what:     'Registers the agent on-chain via EIP-8004 identity NFT.',
    how:      'On first startup, every agent checks if it has an EIP-8004 identity. If not, it calls this skill to mint an identity NFT from the four.meme AgentIdentifier contract. Without this, agents cannot access Insider Phase.',
    result:   'tokenId + tx hash. Agent is now recognized as a legitimate AI participant by the four.meme protocol.',
    code:     `const balance = await getAgentIdentityBalance(walletAddress)
if (balance === 0) {
  const { tokenId } = await registerAgentIdentity(
    agentName, "", "Sixteen agent"
  )
}`,
  },
  {
    id:       '8004-balance',
    num:      '11',
    name:     '8004-balance',
    group:    'Identity',
    who:      'All Agents',
    color:    'var(--green)',
    what:     'Checks if an agent wallet has a valid EIP-8004 identity.',
    how:      'Called on every agent startup before any trading begins. If balance is 0, triggers registration (Skill 10). Ensures every active agent always has Insider Phase access.',
    result:   'Number — count of identity NFTs held. Should be ≥1 for active agents.',
    code:     `const balance = await getAgentIdentityBalance(walletAddress)
// balance >= 1 → Insider Phase unlocked
// balance === 0 → trigger registration`,
  },
  {
    id:       'config',
    num:      '12',
    name:     'config',
    group:    'Config',
    who:      'All Agents',
    color:    'var(--t2)',
    what:     'Fetches live platform configuration from four.meme.',
    how:      'Called at the start of each agent cycle to get current contract addresses, fee rates, and token creation parameters. Keeps the agent aligned with any four.meme protocol upgrades.',
    result:   'FourMemeConfig with tokenManagerAddress, feeRate, minPreSale, maxPreSale.',
    code:     `const config = await getPlatformConfig()
// config.tokenManagerAddress — current contract
// config.feeRate — current platform fee`,
  },
]

const GROUP_ORDER = ['Create', 'Read', 'Trade', 'Transfer', 'Identity', 'Config']

// ── Live skill call log ───────────────────────────────────

interface SkillCall {
  id: string
  action: string
  reasoning: string | null
  outcome: string
  created_at: string
  agents: { name: string; type: string } | null
}

const ACTION_TO_SKILL: Record<string, string> = {
  create:   'create-instant',
  buy:      'buy',
  sell:     'sell',
  skip:     'token-info',
  register: '8004-register',
  claim:    'send-bnb',
  error:    'error',
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// ── Component ─────────────────────────────────────────────

export default function HowItWorksPage() {
  const [calls,    setCalls]    = useState<SkillCall[]>([])
  const [selected, setSelected] = useState<typeof SKILLS[0] | null>(null)

  useEffect(() => {
    const db = createBrowserClient()
    async function load() {
      const { data } = await db
        .from('agent_logs')
        .select('id, action, reasoning, outcome, created_at, agents(name,type)')
        .order('created_at', { ascending: false })
        .limit(30)
      setCalls((data ?? []) as SkillCall[])
    }
    void load()

    const ch = db.channel('skills-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs' }, p => {
        setCalls(prev => [p.new as SkillCall, ...prev].slice(0, 30))
      }).subscribe()

    return () => { void db.removeChannel(ch) }
  }, [])

  return (
    <div className="page">

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--t0)', marginBottom: 6 }}>
          How Sixteen Uses four.meme
        </h1>
        <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7, maxWidth: 600 }}>
          Every action an AI agent takes on Sixteen is a <strong style={{ color: 'var(--t0)' }}>four.meme skill call</strong>.
          Below are all 12 skills — what they do, which agent uses them, and when they fire.
          The live feed shows every skill being called right now.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

        {/* Left: skill cards */}
        <div>
          {GROUP_ORDER.map(group => {
            const groupSkills = SKILLS.filter(s => s.group === group)
            return (
              <div key={group} style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--s3)' }}>
                  {group}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groupSkills.map(skill => (
                    <button
                      key={skill.id}
                      onClick={() => setSelected(selected?.id === skill.id ? null : skill)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '14px 16px',
                        borderRadius: 10, cursor: 'pointer',
                        background: selected?.id === skill.id ? 'var(--s2)' : 'var(--s1)',
                        border: `1px solid ${selected?.id === skill.id ? skill.color : 'var(--s3)'}`,
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: selected?.id === skill.id ? 12 : 0 }}>
                        <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 10, fontWeight: 700, color: 'var(--t3)', flexShrink: 0 }}>
                          {skill.num}
                        </span>
                        <span style={{ fontFamily: 'Space Mono,monospace', fontWeight: 700, fontSize: 13, color: skill.color, flex: 1 }}>
                          {skill.name}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', background: 'var(--s2)', padding: '2px 8px', borderRadius: 100, border: '1px solid var(--s3)', flexShrink: 0 }}>
                          {skill.who}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                          {selected?.id === skill.id ? '▲' : '▼'}
                        </span>
                      </div>

                      {selected?.id !== skill.id && (
                        <div style={{ fontSize: 12, color: 'var(--t2)', marginLeft: 32 }}>
                          {skill.what}
                        </div>
                      )}

                      {selected?.id === skill.id && (
                        <div style={{ marginLeft: 32 }}>
                          <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.65, marginBottom: 12 }}>
                            {skill.what}
                          </div>

                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                              How the agent uses it
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>
                              {skill.how}
                            </div>
                          </div>

                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                              What comes back
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>
                              {skill.result}
                            </div>
                          </div>

                          <pre style={{ fontSize: 11, fontFamily: 'Space Mono,monospace', color: 'var(--t2)', background: 'var(--s0)', border: '1px solid var(--s3)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', lineHeight: 1.6 }}>
                            {skill.code}
                          </pre>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Flow diagram */}
          <div style={{ marginTop: 16, padding: '20px', background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              Full Agent Cycle — Skills in Order
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { skill: 'config',        agent: 'All',     note: 'Fetch live contract addresses + fee rates' },
                { skill: '8004-balance',  agent: 'All',     note: 'Check Insider Phase access' },
                { skill: '8004-register', agent: 'All',     note: 'Register if not already (first run only)' },
                { skill: 'events',        agent: 'Trader',  note: 'Read last 50 blocks for new tokens' },
                { skill: 'token-info',    agent: 'Trader',  note: 'Screen each new token' },
                { skill: 'tax-info',      agent: 'Trader',  note: 'Check creator royalty rate' },
                { skill: 'quote-buy',     agent: 'Trader',  note: 'Simulate buy cost' },
                { skill: 'buy',           agent: 'Trader',  note: 'Enter position in Insider Phase' },
                { skill: 'quote-sell',    agent: 'Trader',  note: 'Check P&L on open positions' },
                { skill: 'sell',          agent: 'Trader',  note: 'Exit at +30% profit or -15% stop loss' },
                { skill: 'send-bnb',      agent: 'Trader',  note: 'Route profit to owner wallet' },
                { skill: 'create-instant',agent: 'Creator', note: 'Launch new token after virality score ≥60' },
              ].map((row, i) => (
                <div key={row.skill} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: i < 11 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--s2)', border: '1px solid var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--t3)', fontFamily: 'Space Mono,monospace' }}>
                      {i + 1}
                    </div>
                    {i < 11 && <div style={{ width: 1, height: 16, background: 'var(--s3)', margin: '2px 0' }} />}
                  </div>
                  <div style={{ flex: 1, paddingTop: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 11, fontWeight: 700, color: SKILLS.find(s => s.id === row.skill)?.color ?? 'var(--t2)' }}>
                        {row.skill}
                      </span>
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 100, background: 'var(--s2)', border: '1px solid var(--s3)', color: 'var(--t3)' }}>
                        {row.agent}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{row.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: live skill feed */}
        <div style={{ position: 'sticky', top: 68 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            Live Skill Calls
            <div className="live-dot" />
          </div>

          <div className="box" style={{ overflow: 'hidden' }}>
            {calls.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 12, lineHeight: 1.6 }}>
                  No skill calls yet.
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16, lineHeight: 1.6 }}>
                  Start an agent to see four.meme skills being called in real time.
                </div>
                <Link href="/dashboard" style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                  Deploy an agent →
                </Link>
              </div>
            ) : (
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {calls.map((call, i) => {
                  const skillName = ACTION_TO_SKILL[call.action] ?? call.action
                  const skill     = SKILLS.find(s => s.id === skillName)
                  const color     = skill?.color ?? 'var(--t2)'
                  return (
                    <div key={call.id} style={{ padding: '11px 16px', borderBottom: i < calls.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 11, fontWeight: 700, color, background: `${color}12`, padding: '1px 7px', borderRadius: 4 }}>
                          {skillName}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'Space Mono,monospace' }}>
                          {timeAgo(call.created_at)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--t1)', fontWeight: 500 }}>
                          {call.agents?.name ?? '—'}
                        </span>
                        <span style={{ fontSize: 10, color: call.outcome === 'success' ? 'var(--green)' : call.outcome === 'failed' ? 'var(--red)' : 'var(--t3)', fontFamily: 'Space Mono,monospace', fontWeight: 700 }}>
                          {call.outcome === 'success' ? 'ok' : call.outcome === 'failed' ? 'fail' : '—'}
                        </span>
                      </div>
                      {call.reasoning && (
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {call.reasoning}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Summary counts */}
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              { label: 'Create', count: calls.filter(c => c.action === 'create').length,   color: 'var(--green)'  },
              { label: 'Buy',    count: calls.filter(c => c.action === 'buy').length,      color: 'var(--green)'  },
              { label: 'Sell',   count: calls.filter(c => c.action === 'sell').length,     color: 'var(--yellow)' },
            ].map(s => (
              <div key={s.label} style={{ padding: '10px', background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Space Mono,monospace', fontWeight: 700, fontSize: 18, color: s.color, marginBottom: 3 }}>{s.count}</div>
                <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
