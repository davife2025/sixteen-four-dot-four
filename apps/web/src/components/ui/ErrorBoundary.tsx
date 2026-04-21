'use client'
// ============================================================
// SIXTEEN — apps/web/src/components/ui/ErrorBoundary.tsx
// React error boundary — catches rendering errors gracefully
// Shows a friendly error card instead of a blank screen
// ============================================================

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children:  ReactNode
  fallback?: ReactNode
  label?:    string   // e.g. "Token Feed" — shown in error message
}

interface State {
  error:   Error | null
  errInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, errInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, errInfo: ErrorInfo) {
    this.setState({ error, errInfo })
    // Log to console — in production wire to Sentry / Supabase logs
    console.error(`[ErrorBoundary] ${this.props.label ?? 'Component'} crashed:`, error, errInfo)
  }

  reset = () => this.setState({ error: null, errInfo: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-3">
          <div className="flex items-center gap-2 text-red-400">
            <span className="text-lg">⚠</span>
            <p className="font-semibold">
              {this.props.label ? `${this.props.label} failed to load` : 'Something went wrong'}
            </p>
          </div>
          <p className="text-sm text-gray-400">
            {this.state.error.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.reset}
            className="text-xs px-3 py-1.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
