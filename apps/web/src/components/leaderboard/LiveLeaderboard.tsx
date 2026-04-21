'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

interface Row {
  agent_id: string; total_pnl_bnb: number; tokens_created: number
  trades_executed: number; rank: number; agents: { name: string; type: string }
}

export function LiveLeaderboard({ initialData }: { initialData: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialData)

  useEffect(() => {
    const db = createBrowserClient()
    const ch = db.channel('lb_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, p => {
        const u = p.new as Row
        setRows(prev => {
          const next = prev.some(r => r.agent_id === u.agent_id)
            ? prev.map(r => r.agent_id === u.agent_id ? { ...r, ...u } : r)
            : [u, ...prev]
          return next.sort((a, b) => (b.total_pnl_bnb ?? 0) - (a.total_pnl_bnb ?? 0))
        })
      }).subscribe()
    return () => { void db.removeChannel(ch) }
  }, [])

  if (!rows.length) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
      No leaderboard data yet. Start a competition round.
    </div>
  )

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Agent</th>
          <th>Type</th>
          <th style={{ textAlign: 'right' }}>P&L (BNB)</th>
          <th style={{ textAlign: 'right' }}>Tokens</th>
          <th style={{ textAlign: 'right' }}>Trades</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const pnl = row.total_pnl_bnb ?? 0
          return (
            <tr key={row.agent_id}>
              <td style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700, color: i < 3 ? 'var(--green)' : 'var(--t3)' }}>
                {i + 1}
              </td>
              <td style={{ fontWeight: 600, color: 'var(--t0)' }}>{row.agents?.name ?? '—'}</td>
              <td style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>{row.agents?.type ?? '—'}</td>
              <td style={{ textAlign: 'right', fontFamily: 'Space Mono, monospace', fontSize: 12, fontWeight: 700, color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--t2)' }}>
                {row.tokens_created ?? 0}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--t2)' }}>
                {row.trades_executed ?? 0}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
