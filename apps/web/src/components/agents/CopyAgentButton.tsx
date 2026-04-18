'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/agents/CopyAgentButton.tsx
// Follow / unfollow button for copy-agent feature
// Shows stake input and current copy status
// ============================================================

import { useState } from 'react'

interface Props {
  agentId: string
  agentName: string
  followerWallet?: string   // connected wallet — undefined if not connected
}

export function CopyAgentButton({ agentId, agentName, followerWallet }: Props) {
  const [following, setFollowing]   = useState(false)
  const [stake, setStake]           = useState('0.01')
  const [loading, setLoading]       = useState(false)
  const [showInput, setShowInput]   = useState(false)
  const [message, setMessage]       = useState<{ ok: boolean; text: string } | null>(null)

  async function handleFollow() {
    if (!followerWallet) {
      setMessage({ ok: false, text: 'Connect your wallet first' })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follower_wallet: followerWallet,
          agent_id:        agentId,
          stake_bnb:       parseFloat(stake),
        }),
      })
      const data = await res.json() as { error?: string }
      if (res.ok) {
        setFollowing(true)
        setShowInput(false)
        setMessage({ ok: true, text: `Now copying ${agentName} with ${stake} BNB stake. Every trade they make, you mirror proportionally.` })
      } else {
        setMessage({ ok: false, text: data.error ?? 'Failed to follow' })
      }
    } catch {
      setMessage({ ok: false, text: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleUnfollow() {
    if (!followerWallet) return
    setLoading(true)
    try {
      const res = await fetch('/api/copy', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_wallet: followerWallet, agent_id: agentId }),
      })
      if (res.ok) {
        setFollowing(false)
        setMessage({ ok: true, text: `Unfollowed ${agentName}` })
      }
    } catch {
      setMessage({ ok: false, text: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  if (following) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-xl px-3 py-2">
          <span>✓</span>
          <span>Copying this agent</span>
          <button
            onClick={handleUnfollow}
            disabled={loading}
            className="ml-auto text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            Unfollow
          </button>
        </div>
        {message && (
          <p className={`text-xs px-2 ${message.ok ? 'text-gray-400' : 'text-red-400'}`}>
            {message.text}
          </p>
        )}
      </div>
    )
  }

  if (showInput) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min="0.001"
              max="1"
              step="0.001"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-teal pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">BNB</span>
          </div>
          <button
            onClick={handleFollow}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-brand-teal text-white text-sm font-semibold disabled:opacity-40 hover:bg-brand-teal/80 transition-colors"
          >
            {loading ? '…' : 'Confirm'}
          </button>
          <button
            onClick={() => setShowInput(false)}
            className="px-3 py-2 rounded-xl border border-gray-700 text-gray-400 text-sm hover:border-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Your trades will mirror this agent proportionally based on your stake. 1.5% copy fee goes to the agent owner.
        </p>
        {message && (
          <p className={`text-xs ${message.ok ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      className="w-full py-2.5 rounded-xl border border-brand-teal/30 text-brand-teal text-sm font-semibold hover:bg-brand-teal/10 transition-colors"
    >
      Copy Agent
    </button>
  )
}
