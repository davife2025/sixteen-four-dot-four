'use client'
// ============================================================
// SIXTEEN — /onboarding
// Agent deployment guide + Kimi K2 chat assistant.
// Clearly explains what an agent does, what you need,
// and exactly how to get it running.
// ============================================================

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useKimi } from '@/hooks/useKimi'

interface Msg { role: 'user' | 'assistant'; content: string }

const STARTER = `Hi! I'm Kimi K2, your Sixteen assistant.

I'll help you deploy an AI agent that creates and trades meme tokens on **four.meme** automatically — while you earn.

Here's what the agent does every 2 minutes:
1. Reads what's trending on X and Google
2. Invents a meme concept and scores its virality
3. Generates the meme image via AI
4. Launches the token on four.meme
5. Trades other tokens for profit
6. Sends profits to your wallet

What would you like to know first?`

const QUICK = [
  'What do I need to get started?',
  'How much BNB do I need?',
  'What is the Insider Phase?',
  'How do agents earn money?',
  'Creator vs Trader vs Hybrid?',
  'What is EIP-8004?',
]

const STEPS = [
  {
    n: '01',
    title: 'Set up your agent wallet',
    body: 'Create a dedicated MetaMask wallet for the agent. This is separate from your personal wallet. Fund it with at least 0.5 tBNB from the faucet.',
    action: { label: 'Get tBNB from faucet', href: 'https://testnet.binance.org/faucet-smart', external: true },
  },
  {
    n: '02',
    title: 'Get your HuggingFace token',
    body: 'The agent uses Kimi K2 (via HuggingFace) to make every decision. Get a free access token from your HF account — same token used for image generation.',
    action: { label: 'Get HF token', href: 'https://huggingface.co/settings/tokens', external: true },
  },
  {
    n: '03',
    title: 'Deploy to Render',
    body: 'The agent runs as a background worker on Render. It needs to run 24/7 — use the Starter plan ($7/month), not the Free tier which sleeps.',
    action: { label: 'Open Render', href: 'https://dashboard.render.com', external: true },
  },
  {
    n: '04',
    title: 'Set environment variables',
    body: 'In Render, set: HF_TOKEN, AGENT_PRIVATE_KEY (your agent wallet private key), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BSC_TESTNET_RPC_URL.',
    action: null,
  },
  {
    n: '05',
    title: 'Create agent in Dashboard',
    body: 'Go to Dashboard → fill in agent name, type (Hybrid recommended), owner wallet (your personal wallet that receives profits), and agent wallet address.',
    action: { label: 'Go to Dashboard', href: '/dashboard', external: false },
  },
  {
    n: '06',
    title: 'Start the agent',
    body: 'Go to Admin → find your agent → click Start. The agent will begin its first cycle within 2 minutes. Watch it in Agent Logs.',
    action: { label: 'Open Admin', href: '/admin', external: false },
  },
]

function renderMd(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/)
    return (
      <div key={i} style={{ marginBottom: line === '' ? 6 : 2 }}>
        {parts.map((p, j) =>
          j % 2 === 1
            ? <strong key={j} style={{ color: 'var(--green)', fontWeight: 700 }}>{p}</strong>
            : <span key={j}>{p}</span>
        )}
      </div>
    )
  })
}

export default function OnboardingPage() {
  const [msgs,    setMsgs]    = useState<Msg[]>([{ role: 'assistant', content: STARTER }])
  const [input,   setInput]   = useState('')
  const [partial, setPartial] = useState('')
  const [typing,  setTyping]  = useState(false)
  const [tab,     setTab]     = useState<'chat' | 'steps'>('steps')
  const bottomRef = useRef<HTMLDivElement>(null)
  const kimi = useKimi()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, partial])

  async function send(text: string) {
    if (!text.trim() || typing) return
    const userMsg: Msg = { role: 'user', content: text }
    setMsgs(p => [...p, userMsg])
    setInput('')
    setTyping(true)
    setPartial('')

    const history = [...msgs, userMsg].slice(-8).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    let full = ''
    await kimi.call({
      mode: 'chat',
      messages: history,
      stream: true,
      onChunk: chunk => { full += chunk; setPartial(full) },
    })

    setMsgs(p => [...p, { role: 'assistant', content: full.replace(/\s*RECOMMEND:(creator|trader|hybrid)/g, '').trim() }])
    setPartial('')
    setTyping(false)
  }

  return (
    <div className="page" style={{ maxWidth: 720, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 24, color: 'var(--t0)', marginBottom: 8, letterSpacing: '-0.3px' }}>
          Deploy an AI Agent
        </h1>
        <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
          Your agent runs on four.meme's Agentic Mode — it creates meme tokens, trades them on the bonding curve, and sends profits to your wallet every 2 minutes.
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--s2)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {(['steps', 'chat'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t ? 'var(--s1)' : 'transparent', color: tab === t ? 'var(--t0)' : 'var(--t2)', border: tab === t ? '1px solid var(--s3)' : '1px solid transparent', transition: 'all 0.12s' }}>
            {t === 'steps' ? 'Setup Guide' : 'Ask Kimi K2'}
          </button>
        ))}
      </div>

      {/* Steps tab */}
      {tab === 'steps' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(185,241,74,0.1)', border: '1px solid rgba(185,241,74,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>
                    {s.n}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--t0)', fontSize: 14, marginBottom: 6 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.65, marginBottom: s.action ? 12 : 0 }}>{s.body}</div>
                    {s.action && (
                      s.action.external
                        ? <a href={s.action.href} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 12, display: 'inline-flex', padding: '6px 14px' }}>{s.action.label} ↗</a>
                        : <Link href={s.action.href} className="btn-secondary" style={{ fontSize: 12, display: 'inline-flex', padding: '6px 14px' }}>{s.action.label}</Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Agent types */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, color: 'var(--t0)', fontSize: 16, marginBottom: 14 }}>Choose your agent type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { type: 'Creator', color: 'var(--green)', desc: 'Spots trends, generates meme images via AI, launches tokens on four.meme. Earns royalties on every trade.' },
                { type: 'Trader',  color: 'var(--yellow)', desc: 'Reads the four.meme event stream, buys tokens early in Insider Phase, exits at +30% profit.' },
                { type: 'Hybrid',  color: 'var(--t0)', desc: 'Does both. Creates every 4th cycle, trades the rest. Best for most people starting out.' },
              ].map(a => (
                <div key={a.type} className="card2" style={{ padding: 16 }}>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 13, color: a.color, marginBottom: 8 }}>{a.type}</div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Render env vars reference */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, color: 'var(--t0)', fontSize: 14, marginBottom: 14 }}>Render Environment Variables</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                ['HF_TOKEN',                  'huggingface.co/settings/tokens',                       'Kimi K2 + image generation'],
                ['AGENT_PRIVATE_KEY',          '64 hex chars, no 0x prefix',                           'Agent wallet private key'],
                ['SUPABASE_URL',               'app.supabase.com → Settings → API',                    'Your Supabase project URL'],
                ['SUPABASE_SERVICE_ROLE_KEY',  'app.supabase.com → Settings → API',                    'Service role key'],
                ['BSC_TESTNET_RPC_URL',        'https://data-seed-prebsc-1-s1.binance.org:8545',        'BNB Testnet RPC'],
                ['NODE_ENV',                   'production',                                            ''],
              ].map(([k, v, hint]) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>{k}</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--t2)' }}>{v}</span>
                  <span style={{ fontSize: 11, color: 'var(--t3)' }}>{hint}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat tab */}
      {tab === 'chat' && (
        <div>
          <div className="card" style={{ overflow: 'hidden', marginBottom: 12 }}>
            {/* Messages */}
            <div style={{ maxHeight: 440, overflowY: 'auto', padding: 16 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
                  {m.role === 'assistant' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#000', fontFamily: 'Space Mono, monospace' }}>K2</div>
                      <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600 }}>Kimi K2</span>
                    </div>
                  )}
                  <div style={{ maxWidth: '88%', padding: '10px 14px', borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px', background: m.role === 'user' ? 'var(--green)' : 'var(--s2)', border: m.role === 'user' ? 'none' : '1px solid var(--s3)', fontSize: 13, color: m.role === 'user' ? '#000' : 'var(--t1)', lineHeight: 1.65 }}>
                    {m.role === 'assistant' ? renderMd(m.content) : m.content}
                  </div>
                </div>
              ))}
              {partial && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#000', fontFamily: 'Space Mono, monospace' }}>K2</div>
                  </div>
                  <div style={{ maxWidth: '88%', padding: '10px 14px', borderRadius: '4px 12px 12px 12px', background: 'var(--s2)', border: '1px solid var(--s3)', fontSize: 13, color: 'var(--t1)', lineHeight: 1.65 }}>
                    {renderMd(partial)}
                    <span style={{ display: 'inline-block', width: 6, height: 13, background: 'var(--green)', borderRadius: 2, marginLeft: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom' }} />
                  </div>
                </div>
              )}
              {typing && !partial && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#000' }}>K2</div>
                  <div style={{ display: 'flex', gap: 4, padding: '10px 14px', background: 'var(--s2)', borderRadius: '4px 12px 12px 12px', border: '1px solid var(--s3)' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--t3)', animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            {/* Input */}
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--s3)', background: 'var(--s1)' }}>
              <input className="input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)} placeholder="Ask anything about agents…" disabled={typing} style={{ flex: 1 }} />
              <button onClick={() => send(input)} disabled={!input.trim() || typing} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px', flexShrink: 0 }}>Send</button>
            </div>
          </div>

          {/* Quick questions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK.map(q => (
              <button key={q} onClick={() => send(q)} disabled={typing} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 100, cursor: 'pointer', background: 'var(--s2)', border: '1px solid var(--s3)', color: 'var(--t2)', opacity: typing ? 0.5 : 1, transition: 'border-color 0.12s' }} onMouseEnter={e => !typing && (e.currentTarget.style.borderColor = 'var(--green)')} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--s3)'}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink  { 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes bounce { 0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)} }
      `}</style>
    </div>
  )
}
