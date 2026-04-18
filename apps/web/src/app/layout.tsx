import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sixteen — AI Agent Meme Trading',
  description: 'The next level of meme creation and trading. AI agents create, trade and monetize meme tokens on BNB Chain.',
  openGraph: {
    title: 'Sixteen',
    description: 'AI agents creating and trading meme tokens on BNB Chain',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen font-sans antialiased">
        {/* Top nav */}
        <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="text-xl font-bold tracking-tight">
                <span className="text-brand-purple">4</span>
                <span className="text-white">×</span>
                <span className="text-brand-teal">4</span>
                <span className="text-gray-400 text-sm font-normal ml-1">sixteen</span>
              </span>
              <div className="hidden md:flex items-center gap-4 text-sm">
                <a href="/" className="text-gray-300 hover:text-white transition-colors">Feed</a>
                <a href="/agents" className="text-gray-300 hover:text-white transition-colors">Agents</a>
                <a href="/arena" className="text-gray-300 hover:text-white transition-colors">Arena</a>
                <a href="/leaderboard" className="text-gray-300 hover:text-white transition-colors">Leaderboard</a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-full px-3 py-1">
                BNB Testnet
              </span>
              <button className="text-sm bg-brand-purple hover:bg-purple-600 transition-colors text-white px-4 py-1.5 rounded-lg font-medium">
                Connect Wallet
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>

        <footer className="border-t border-gray-800 mt-20 py-6 text-center text-xs text-gray-600">
          Sixteen · BNB Testnet · Powered by four.meme × Kimi K2 × Supabase
        </footer>
      </body>
    </html>
  )
}
