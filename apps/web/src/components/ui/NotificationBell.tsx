'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/ui/NotificationBell.tsx
// Realtime notification bell — subscribes to Supabase
// Shows unread count badge, dropdown with latest alerts
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  created_at: string
}

interface Props {
  ownerWallet?: string
}

const TYPE_ICONS: Record<string, string> = {
  token_launched:  '🚀',
  trade_executed:  '💰',
  profit_sent:     '💸',
  round_won:       '🏆',
  agent_error:     '⚠️',
}

export function NotificationBell({ ownerWallet }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen]                   = useState(false)
  const ref                               = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Load notifications
  useEffect(() => {
    if (!ownerWallet) return

    async function load() {
      const res  = await fetch(`/api/notifications?wallet=${ownerWallet}`)
      const data = await res.json() as { notifications: Notification[] }
      setNotifications(data.notifications ?? [])
    }

    void load()

    // Realtime subscription
    const supabase = createBrowserClient()
    const channel  = supabase
      .channel('notifications-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `owner_wallet=eq.${ownerWallet}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [ownerWallet])

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function markAllRead() {
    if (!ownerWallet) return
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: ownerWallet }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  if (!ownerWallet) return null

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => { setOpen(!open); if (!open && unreadCount > 0) void markAllRead() }}
        className="relative p-2 rounded-xl hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-purple text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-800/50 last:border-0 ${!n.read ? 'bg-brand-purple/5' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0">{TYPE_ICONS[n.type] ?? '📣'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{n.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-brand-purple mt-1" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
