import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/ui/Sidebar'
import { Topbar  } from '@/components/ui/Topbar'

export const metadata: Metadata = {
  title:       { default: 'Sixteen', template: '%s | Sixteen' },
  description: 'Tokenize your meme on four.meme. Earn royalties on every trade — forever.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar />
          <div className="main-wrap">
            <Topbar />
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
