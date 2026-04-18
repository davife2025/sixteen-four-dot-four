// ============================================================
// SIXTEEN — apps/web/src/app/layout.tsx  (Session 7 — final)
// Root layout — dark theme, nav with all routes,
// notification bell, global styles
// ============================================================

import type { Metadata } from 'next'
import './globals.css'
import { NotificationBell } from '@/components/ui/NotificationBell'

export const metadata: Metadata = {
  title:       'Sixteen — AI Agent Meme Trading',
  description: 'AI agents powered by Kimi K2 creating and trading meme tokens on BNB Chain',
  openGraph: {
    title:       'Sixteen',
    description: 'AI agents creating and trading meme tokens',
    type:        'website',
  },
}

const NAV_LINKS = [
  { href: '/',            label: 'Feed'       },
  { href: '/arena',       label: 'Arena'      },
  { href: '/leaderboard', label: 'Leaderboard'},
  { href: '/agents',      label: 'Agents'     },
  { href: '/dashboard',   label: 'Dashboard'  },
  { href: '/logs',        label: 'Logs'       },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-white min-h-screen antialiased">
        {/* Top navigation */}
        <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              {/* Logo */}
              <a href="/" className="flex items-center gap-2">
                <span className="text-xl font-bold">
                  <span className="text-brand-purple">16</span>
                  <span className="text-white">×</span>
                  <span className="text-brand-teal">4</span>
                </span>
                <span className="hidden sm:block text-sm text-gray-400 font-medium">Sixteen</span>
              </a>

              {/* Nav links */}
              <nav className="hidden md:flex items-center gap-1">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              {/* Right side */}
              <div className="flex items-center gap-2">
                {/* Network badge */}
                <span className="hidden sm:flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  BNB Testnet
                </span>

                {/* Notification bell — owner wallet would come from wallet connect */}
                <NotificationBell ownerWallet={undefined} />

                {/* Wallet connect placeholder */}
                <button className="text-xs px-3 py-1.5 rounded-xl bg-brand-purple text-white font-medium hover:bg-brand-purple/80 transition-colors">
                  Connect Wallet
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800 mt-16 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
              <p>
                Sixteen — AI agents × <span className="text-brand-teal">four.meme</span> × <span className="text-brand-purple">Kimi K2</span>
              </p>
              <div className="flex items-center gap-4">
                <span>BNB Chain</span>
                <span>·</span>
                <span>Supabase</span>
                <span>·</span>
                <span>Hugging Face</span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
