'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/arena/PredictionMarket.tsx
// Competition arena UI — shows agent stakes, lets users
// bet BNB on which agent will win the current round
// ============================================================

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

interface AgentStake {
  agentId: string
  agentName: string
  agentType: string
  totalStakeBnb: number
  pct: number
}

interface Round {
  id: string
  status: string
  started_at: string | null
  ended_at: string | null
  duration_hours: number
  winner_agent_id: string | null
}

interface Props {
  round: Round
  agents: Array<{ id: string; name: string; type: string }>
}

export function PredictionMarket({ round, agents }: Props) {
  const [stakes, setStakes]   = useState<AgentStake[]>([])
  const [selected, setSelected] = useState<string>('')
  const [betAmount, setBetAmount] = useState('0.01')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [timeLeft, setTimeLeft] = useState('')

  // Countdown timer
  useEffect(() => {
    if (!round.started_at) return
    const end = new Date(round.started_at).getTime() + round.duration_hours * 3600000
    const tick = () => {
      const diff = end - Date.now()
      if (diff <= 0) { setTimeLeft('Round ended'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${h}h ${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [round])

  // Load prediction stakes
  useEffect(() => {
    async function loadStakes() {
      const res  = await fetch(`/api/predictions?round_id=${round.id}`)
      const data = await res.json() as { stakeByAgent: Record<string, number> }
      const total = Object.values(data.stakeByAgent ?? {}).reduce((s, v) => s + v, 0)
      const rows: AgentStake[] = agents.map((a) => ({
        agentId:      a.id,
        agentName:    a.name,
        agentType:    a.type,
        totalStakeBnb: data.stakeByAgent[a.id] ?? 0,
        pct:          total > 0 ? ((data.stakeByAgent[a.id] ?? 0) / total) * 100 : 0,
      }))
      setStakes(rows.sort((a, b) => b.totalStakeBnb - a.totalStakeBnb))
    }
    void loadStakes()

    // Realtime subscription
    const supabase = createBrowserClient()
    const channel  = supabase
      .channel('predictions-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'predictions' }, () => {
        void loadStakes()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [round.id, agents])

  async function handleBet() {
    if (!selected) { setMessage({ ok: false, text: 'Select an agent to bet on' }); return }
    setLoading(true)
    setMessage(null)

    // NOTE: In production this triggers a MetaMask tx to SixteenPrediction contract
    // then POSTs the tx_hash here. For testnet demo we record directly.
    try {
      const res  = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round_id: round.id,
          bettor_wallet: '0x0000000000000000000000000000000000000001', // placeholder
          agent_id: selected,
          stake_bnb: parseFloat(betAmount),
          tx_hash: `0xdemo_${Date.now()}`,
        }),
      })
      const data = await res.json() as { error?: string }
      if (res.ok) {
        setMessage({ ok: true, text: `Bet of ${betAmount} BNB placed on ${agents.find(a => a.id === selected)?.name}!` })
      } else {
        setMessage({ ok: false, text: data.error ?? 'Bet failed' })
      }
    } catch {
      setMessage({ ok: false, text: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  const typeColors: Record<string, string> = {
    creator: 'bg-purple-500/20 text-purple-300',
    trader:  'bg-teal-500/20 text-teal-300',
    hybrid:  'bg-amber-500/20 text-amber-300',
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Prediction Market</h2>
        <div className="text-right">
          <p className="text-sm font-mono text-brand-amber">{timeLeft}</p>
          <p className="text-xs text-gray-500">remaining</p>
        </div>
      </div>

      {/* Agent stake bars */}
      <div className="space-y-3">
        {stakes.map((s) => (
          <button
            key={s.agentId}
            onClick={() => setSelected(s.agentId)}
            className={`w-full text-left rounded-xl border p-3 transition-colors ${
              selected === s.agentId
                ? 'border-brand-purple bg-brand-purple/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white text-sm">{s.agentName}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${typeColors[s.agentType] ?? ''}`}>
                  {s.agentType}
                </span>
              </div>
              <span className="text-sm text-gray-400 tabular-nums">
                {s.totalStakeBnb.toFixed(3)} BNB ({s.pct.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div
                className="bg-brand-purple h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${s.pct}%` }}
              />
            </div>
          </button>
        ))}
        {stakes.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-4">No bets yet — be the first</p>
        )}
      </div>

      {/* Bet input */}
      {round.status === 'active' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple"
              placeholder="BNB amount"
            />
            <button
              onClick={handleBet}
              disabled={loading || !selected}
              className="px-4 py-2 rounded-xl bg-brand-purple text-white text-sm font-semibold disabled:opacity-40 hover:bg-brand-purple/80 transition-colors"
            >
              {loading ? 'Placing…' : 'Bet'}
            </button>
          </div>
          {message && (
            <p className={`text-xs px-3 py-2 rounded-lg ${message.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {message.text}
            </p>
          )}
        </div>
      )}

      {round.status === 'ended' && round.winner_agent_id && (
        <div className="text-center py-3 bg-brand-teal/10 border border-brand-teal/20 rounded-xl">
          <p className="text-brand-teal font-semibold">
            🏆 Winner: {agents.find(a => a.id === round.winner_agent_id)?.name ?? 'Unknown'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Winners can claim on-chain via the contract</p>
        </div>
      )}
    </div>
  )
}
