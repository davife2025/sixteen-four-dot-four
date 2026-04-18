'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/agents/CreateAgentForm.tsx
// Form to register a new Kimi K2 agent
// POST /api/agents
// ============================================================

import { useState } from 'react'

type AgentType = 'creator' | 'trader' | 'hybrid'

const TYPE_DESCRIPTIONS: Record<AgentType, string> = {
  creator: 'Generates meme concepts via Kimi K2, scores virality, launches image and video tokens. Earns creator royalties on every trade.',
  trader:  'Monitors the event stream, evaluates tokens via Kimi K2, buys in Insider Phase and sells at profit target. Earnings sent to your wallet.',
  hybrid:  'Does both — creates memes and trades them. Alternates each cycle based on market conditions.',
}

export function CreateAgentForm() {
  const [name, setName] = useState('')
  const [type, setType] = useState<AgentType>('hybrid')
  const [ownerWallet, setOwnerWallet] = useState('')
  const [agentWallet, setAgentWallet] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          owner_wallet: ownerWallet,
          wallet_address: agentWallet,
        }),
      })
      const data = await res.json() as { agent?: unknown; error?: string }

      if (res.ok) {
        setResult({ ok: true, message: `Agent "${name}" created. Set it to "running" in the dashboard to start.` })
        setName('')
        setOwnerWallet('')
        setAgentWallet('')
      } else {
        setResult({ ok: false, message: data.error ?? 'Failed to create agent' })
      }
    } catch {
      setResult({ ok: false, message: 'Network error — please try again' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Agent name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Degen Creator Bot"
          required
          maxLength={40}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-purple transition-colors text-sm"
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Agent type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['creator', 'trader', 'hybrid'] as AgentType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`py-2 rounded-xl text-sm font-medium border transition-colors capitalize ${
                type === t
                  ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">{TYPE_DESCRIPTIONS[type]}</p>
      </div>

      {/* Owner wallet */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Your wallet address <span className="text-gray-500">(receives royalties + profits)</span>
        </label>
        <input
          type="text"
          value={ownerWallet}
          onChange={(e) => setOwnerWallet(e.target.value)}
          placeholder="0x..."
          required
          pattern="^0x[a-fA-F0-9]{40}$"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-purple transition-colors text-sm font-mono"
        />
      </div>

      {/* Agent wallet */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Agent wallet address <span className="text-gray-500">(funded with testnet BNB — this agent signs txs)</span>
        </label>
        <input
          type="text"
          value={agentWallet}
          onChange={(e) => setAgentWallet(e.target.value)}
          placeholder="0x..."
          required
          pattern="^0x[a-fA-F0-9]{40}$"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-purple transition-colors text-sm font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">
          This must match the <code className="text-gray-400">AGENT_PRIVATE_KEY</code> in your .env file. Fund it at testnet.binance.org/faucet-smart
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-brand-purple text-white font-semibold text-sm hover:bg-brand-purple/80 transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Create Agent'}
      </button>

      {/* Result */}
      {result && (
        <div className={`text-sm px-4 py-3 rounded-xl ${result.ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {result.message}
        </div>
      )}
    </form>
  )
}
