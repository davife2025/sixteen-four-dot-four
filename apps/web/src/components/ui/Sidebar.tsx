'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  {
    section: 'Create',
    links: [
      { href: '/',         label: 'Tokenize Meme'  },
      { href: '/earnings', label: 'My Earnings'    },
      { href: '/feed',     label: 'Token Feed'     },
    ],
  },
  {
    section: 'Compete',
    links: [
      { href: '/arena',       label: 'Arena',       live: true },
      { href: '/leaderboard', label: 'Leaderboard'             },
    ],
  },
  {
    section: 'AI Agents',
    links: [
      { href: '/dashboard',   label: 'Dashboard'   },
      { href: '/agents',      label: 'My Agents'   },
      { href: '/logs',        label: 'Agent Logs'  },
      { href: '/analytics',   label: 'Analytics'   },
    ],
  },
  {
    section: 'More',
    links: [
      { href: '/how-it-works', label: 'How It Works' },
      { href: '/admin',        label: 'Admin'         },
    ],
  },
]

export function Sidebar() {
  const path = usePathname()
  const active = (href: string) =>
    href === '/' ? path === '/' : path.startsWith(href)

  return (
    <aside className="sidebar">

      {/* Logo — text only */}
      <div className="sidebar-logo">
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--t0)', letterSpacing: '-0.4px', lineHeight: 1 }}>
          Sixteen
        </div>
        <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Meme Token Platform
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV.map(group => (
          <div key={group.section} style={{ marginBottom: 4 }}>
            <div className="nav-section">{group.section}</div>
            {group.links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${active(link.href) ? 'active' : ''}`}
              >
                {('live' in link && link.live) && (
                  <span className="live-dot" style={{ width: 5, height: 5, flexShrink: 0 }} />
                )}
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="cta-block">
          <div className="cta-title">Deploy an AI Agent</div>
          <div className="cta-sub">Let Kimi K2 create and trade memes for you 24/7</div>
          <Link href="/onboarding" className="cta-btn">Get Started</Link>
        </div>
        <div className="net-pill">
          <div className="net-dot" />
          <span>BNB Testnet</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--t3)' }}>97</span>
        </div>
      </div>
    </aside>
  )
}
