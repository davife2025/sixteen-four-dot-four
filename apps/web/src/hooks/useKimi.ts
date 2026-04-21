'use client'
// ============================================================
// SIXTEEN — apps/web/src/hooks/useKimi.ts
// Shared hook for all Kimi K2 API calls.
// Handles streaming, JSON parsing, loading state, errors.
// ============================================================

import { useState, useCallback } from 'react'

interface KimiOptions {
  mode:      string
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  data?:     Record<string, unknown>
  stream?:   boolean
  onChunk?:  (chunk: string) => void
}

interface KimiState {
  loading:  boolean
  error:    string | null
  content:  string
}

export function useKimi() {
  const [state, setState] = useState<KimiState>({ loading: false, error: null, content: '' })

  const call = useCallback(async (opts: KimiOptions): Promise<string> => {
    setState({ loading: true, error: null, content: '' })

    try {
      const res = await fetch('/api/kimi', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          mode:     opts.mode,
          messages: opts.messages ?? [],
          data:     opts.data ?? {},
          stream:   opts.stream ?? false,  // default non-streaming for JSON modes
        }),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Kimi K2 request failed')
      }

      // Non-streaming: return JSON directly
      if (!opts.stream) {
        const json = await res.json() as { content: string }
        setState({ loading: false, error: null, content: json.content })
        return json.content
      }

      // Streaming: read chunks and accumulate
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as {
              choices: Array<{ delta: { content?: string } }>
            }
            const text = parsed.choices[0]?.delta?.content ?? ''
            if (text) {
              full += text
              opts.onChunk?.(text)
              setState(s => ({ ...s, content: full }))
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      setState({ loading: false, error: null, content: full })
      return full

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setState({ loading: false, error: msg, content: '' })
      return ''
    }
  }, [])

  // Convenience: parse JSON from content
  const parseJSON = useCallback(<T>(content: string): T | null => {
    try {
      // Strip markdown code fences if present
      const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      return JSON.parse(clean) as T
    } catch {
      return null
    }
  }, [])

  return { ...state, call, parseJSON }
}
