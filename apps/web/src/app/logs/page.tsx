'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

interface LogRow {
  id: string; action: string; token_address: string | null
  reasoning: string | null; virality_score: number | null
  amount_bnb: number | null; outcome: string; created_at: string
  agents: { name: string; type: string } | null
}

const ACTION_COLOR: Record<string,string> = {
  create: 'var(--green)', buy: 'var(--green)', sell: 'var(--yellow)',
  skip: 'var(--t3)', error: '#ff6060', register: 'var(--green)', claim: 'var(--yellow)',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([])

  useEffect(() => {
    const supabase = createBrowserClient()
    async function load() {
      const { data } = await supabase
        .from('agent_logs')
        .select('id, action, token_address, reasoning, virality_score, amount_bnb, outcome, created_at, agents(name,type)')
        .order('created_at', { ascending: false })
        .limit(100)
      setLogs((data ?? []) as LogRow[])
    }
    void load()
    const ch = supabase.channel('logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs' }, p => {
        setLogs(prev => [p.new as LogRow, ...prev].slice(0, 100))
      }).subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [])

  return (
    <div className="page-wrap">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--t0)', marginBottom: 4 }}>Agent Logs</h1>
          <p style={{ fontSize: 13, color: 'var(--t2)' }}>Every Kimi K2 decision — live and transparent</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="live-dot" />
          <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>Live</span>
        </div>
      </div>

      <div className="card">
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 70px 1fr 90px 60px',
          padding: '10px 16px', borderBottom: '1px solid var(--s3)' }}>
          {['Time','Agent','Action','Reasoning','Amount','Result'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'var(--t3)' }}>{h}</span>
          ))}
        </div>

        {logs.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            No agent activity yet. Start an agent to see decisions appear here in real time.
          </div>
        )}

        {logs.map(log => (
          <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '80px 100px 70px 1fr 90px 60px',
            padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)',
            alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'Space Mono, monospace' }}>
              {new Date(log.created_at).toLocaleTimeString()}
            </span>
            <span style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {log.agents?.name ?? '—'}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: ACTION_COLOR[log.action] ?? 'var(--t2)',
              fontFamily: 'Space Mono, monospace' }}>
              {log.action}
            </span>
            <span style={{ fontSize: 11, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
              {log.reasoning ?? (log.token_address ? log.token_address.slice(0,14)+'…' : '—')}
            </span>
            <span style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: 'var(--t2)' }}>
              {log.amount_bnb != null ? `${log.amount_bnb.toFixed(3)} BNB` : '—'}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Space Mono, monospace',
              color: log.outcome === 'success' ? 'var(--green)' : log.outcome === 'failed' ? '#ff6060' : 'var(--t3)' }}>
              {log.outcome === 'success' ? 'ok' : log.outcome === 'failed' ? 'fail' : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
