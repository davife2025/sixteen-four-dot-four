'use client'
import { useWallet } from '@/hooks/useWallet'

export function WalletButton() {
  const { address, balance, connected, wrongNetwork, loading, connect, disconnect, switchNetwork } = useWallet()

  if (loading) return (
    <div style={{ fontSize: 12, padding: '6px 12px', borderRadius: 7, background: 'var(--s2)', border: '1px solid var(--s3)', color: 'var(--t3)' }}>
      Connecting…
    </div>
  )

  if (connected && wrongNetwork) return (
    <button onClick={switchNetwork} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 7, background: 'rgba(255,85,85,0.08)', border: '1px solid rgba(255,85,85,0.25)', color: 'var(--red)', fontWeight: 600, cursor: 'pointer' }}>
      Switch to BNB Testnet
    </button>
  )

  if (connected && address) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {balance && (
        <span style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: 'var(--t2)', padding: '4px 10px', borderRadius: 6, background: 'var(--s2)', border: '1px solid var(--s3)' }}>
          {balance} tBNB
        </span>
      )}
      <button onClick={disconnect} style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', padding: '6px 12px', borderRadius: 7, cursor: 'pointer', background: 'rgba(185,241,74,0.08)', border: '1px solid rgba(185,241,74,0.2)', color: 'var(--green)', fontWeight: 600 }}>
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    </div>
  )

  return (
    <button onClick={connect} className="btn-primary" style={{ fontSize: 12, padding: '7px 16px' }}>
      Connect Wallet
    </button>
  )
}
