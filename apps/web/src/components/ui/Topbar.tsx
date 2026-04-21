'use client'
import { usePathname } from 'next/navigation'
import { WalletButton } from './WalletButton'

const LABELS: Record<string, string> = {
  '/':             'Tokenize Meme',
  '/feed':         'Token Feed',
  '/arena':        'Arena',
  '/leaderboard':  'Leaderboard',
  '/dashboard':    'Dashboard',
  '/agents':       'My Agents',
  '/analytics':    'Analytics',
  '/logs':         'Agent Logs',
  '/admin':        'Admin',
  '/earnings':     'My Earnings',
  '/how-it-works': 'How It Works',
  '/onboarding':   'Deploy an Agent',
}

export function Topbar() {
  const path  = usePathname()
  const label = path.startsWith('/token/')
    ? 'Token Detail'
    : (LABELS[path] ?? 'Sixteen')

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'Space Mono, monospace' }}>
          sixteen /
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t0)' }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, fontFamily: 'Space Mono, monospace', color: 'var(--t3)', padding: '4px 9px', borderRadius: 5, background: 'var(--s2)', border: '1px solid var(--s3)' }}>
          TESTNET
        </span>
        <WalletButton />
      </div>
    </header>
  )
}
