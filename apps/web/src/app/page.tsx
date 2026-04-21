'use client'
// ============================================================
// SIXTEEN — Homepage / Create page
// ONE purpose: tokenize your meme on four.meme, earn royalties.
// Agent deployment is a separate journey — Dashboard / Onboarding.
// ============================================================

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useKimi } from '@/hooks/useKimi'

type Method = 'none' | 'upload' | 'ai-image' | 'ai-video'
type Stage  = 'start' | 'preview' | 'details' | 'review' | 'done'

interface Asset {
  url:    string
  type:   'image' | 'video'
  source: 'upload' | 'ai'
  file?:  File
}

interface TokenDraft {
  name:        string
  symbol:      string
  description: string
  category:    string
  royalty:     number
  presale:     string
  wallet:      string
}

const CATEGORIES = ['Meme', 'AI', 'Games', 'Social', 'Others']

// ── Step indicator ─────────────────────────────────────────
function StepBar({ stage }: { stage: Stage }) {
  const steps: Stage[] = ['start', 'preview', 'details', 'review', 'done']
  const labels         = ['Create', 'Preview', 'Details', 'Review', 'Done']
  const cur            = steps.indexOf(stage)

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              fontFamily: 'Space Mono, monospace',
              background: i < cur ? 'var(--green)' : i === cur ? 'var(--green)' : 'var(--s2)',
              color:      i <= cur ? '#000' : 'var(--t3)',
              border:     i > cur ? '1px solid var(--s3)' : 'none',
              transition: 'all 0.2s',
            }}>
              {i < cur ? '✓' : i + 1}
            </div>
            <span style={{
              fontSize: 10, whiteSpace: 'nowrap',
              color:    i === cur ? 'var(--green)' : 'var(--t3)',
              fontWeight: i === cur ? 600 : 400,
            }}>
              {labels[i]}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: 1, marginBottom: 18,
              background: i < cur ? 'var(--green)' : 'var(--s3)',
              transition: 'background 0.2s',
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Upload drop zone ───────────────────────────────────────
function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false)
  const ref             = useRef<HTMLInputElement>(null)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }, [onFile])

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      style={{
        border:       `2px dashed ${drag ? 'var(--green)' : 'var(--s3)'}`,
        borderRadius: 12,
        padding:      '44px 24px',
        textAlign:    'center',
        cursor:       'pointer',
        background:   drag ? 'rgba(185,241,74,0.04)' : 'transparent',
        transition:   'all 0.15s',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.5 }}>📂</div>
      <div style={{ fontWeight: 600, color: 'var(--t0)', fontSize: 15, marginBottom: 6 }}>
        Drop your meme here
      </div>
      <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 16, lineHeight: 1.5 }}>
        JPG, PNG, GIF, WEBP — or MP4 video.<br />Your meme, your token.
      </div>
      <span className="btn-secondary" style={{ display: 'inline-flex', padding: '8px 20px', fontSize: 13 }}>
        Browse files
      </span>
      <input
        ref={ref} type="file" accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export default function HomePage() {
  const [method, setMethod]     = useState<Method>('none')
  const [stage,  setStage]      = useState<Stage>('start')
  const [asset,  setAsset]      = useState<Asset | null>(null)
  const [prompt, setPrompt]     = useState('')
  const [draft,  setDraft]      = useState<TokenDraft>({ name: '', symbol: '', description: '', category: 'Meme', royalty: 40, presale: '0.01', wallet: '' })
  const [genLoading, setGenLoading] = useState(false)
  const [genError,   setGenError]   = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError,   setSubmitError]   = useState('')
  const kimi     = useKimi()
  const kimiDesc = useKimi()

  // Auto-describe with Kimi K2 after asset is ready
  async function runKimiDescribe(hint: string) {
    const content = await kimiDesc.call({
      mode: 'describe',
      data: { meme_prompt: hint, platform: 'four.meme BNB Chain', asset_type: 'image' },
    })
    const parsed = kimiDesc.parseJSON<{ name: string; symbol: string; description: string; category: string }>(content)
    if (parsed) {
      setDraft(prev => ({
        ...prev,
        name:        parsed.name        || prev.name,
        symbol:      parsed.symbol      || prev.symbol,
        description: parsed.description || prev.description,
        category:    CATEGORIES.includes(parsed.category) ? parsed.category : prev.category,
      }))
    }
  }

  // Handle file upload
  function handleFile(file: File) {
    const url  = URL.createObjectURL(file)
    const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image'
    setAsset({ url, type, source: 'upload', file })
    setStage('preview')
    runKimiDescribe(file.name.replace(/\.[^.]+$/, ''))
  }

  // Handle AI generation
  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenLoading(true); setGenError('')
    try {
      const isVideo = method === 'ai-video'
      const res     = await fetch('/api/generate-meme', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt, type: isVideo ? 'video' : 'image' }),
      })
      const data = await res.json() as { imageUrl?: string; videoUrl?: string; error?: string; message?: string }

      if (!res.ok || data.error) {
        setGenError(data.error ?? 'Generation failed — try again')
        return
      }

      const type: 'image' | 'video' = isVideo && data.videoUrl ? 'video' : 'image'
      setAsset({ url: data.videoUrl ?? data.imageUrl ?? '', type, source: 'ai' })
      setStage('preview')
      runKimiDescribe(prompt)
    } catch {
      setGenError('Network error — check your connection')
    } finally {
      setGenLoading(false)
    }
  }

  // Proceed from preview to details
  function goToDetails() {
    setStage('details')
  }

  // Submit token
  async function handleLaunch() {
    if (!draft.name || !draft.symbol || !draft.description || !draft.wallet) {
      setSubmitError('Please fill in all required fields')
      return
    }
    if (!asset) return

    setSubmitLoading(true); setSubmitError('')
    try {
      const res  = await fetch('/api/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          draft.name,
          symbol:        draft.symbol,
          description:   draft.description,
          imageUrl:      asset.type === 'image' ? asset.url : '',
          videoUrl:      asset.type === 'video' ? asset.url : undefined,
          label:         draft.category,
          creatorWallet: draft.wallet,
          preSaleBnb:    parseFloat(draft.presale) || 0.01,
          recipientRate: draft.royalty,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok || data.error) {
        setSubmitError(data.error ?? 'Launch failed — please try again')
        return
      }
      setStage('done')
    } catch {
      setSubmitError('Network error — please try again')
    } finally {
      setSubmitLoading(false)
    }
  }

  function reset() {
    setMethod('none'); setStage('start'); setAsset(null)
    setPrompt(''); setGenError(''); setSubmitError('')
    setDraft({ name: '', symbol: '', description: '', category: 'Meme', royalty: 40, presale: '0.01', wallet: '' })
  }

  const wrap: React.CSSProperties = { maxWidth: 600, margin: '0 auto', width: '100%' }

  // ════ STAGE: start ══════════════════════════════════════
  if (stage === 'start') return (
    <div className="page">
      <div style={wrap}>
        {/* Headline */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 28, color: 'var(--t0)', lineHeight: 1.2, marginBottom: 10, letterSpacing: '-0.5px' }}>
            Tokenize your meme.<br />
            <span style={{ color: 'var(--green)' }}>Earn on every trade.</span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7, maxWidth: 480 }}>
            Upload a meme image or video — or generate one with AI. Kimi K2 names your token. It launches on four.meme in 2 minutes. You earn royalties on every single trade, forever.
          </p>
        </div>

        {/* Method selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>

          {/* Upload */}
          <button
            onClick={() => setMethod(method === 'upload' ? 'none' : 'upload')}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '18px 20px', borderRadius: 12, cursor: 'pointer',
              width: '100%', textAlign: 'left',
              background: method === 'upload' ? 'rgba(185,241,74,0.06)' : 'var(--s1)',
              border: `1.5px solid ${method === 'upload' ? 'var(--green)' : 'var(--s3)'}`,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ width: 46, height: 46, borderRadius: 10, background: 'rgba(185,241,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              📤
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--t0)', fontSize: 14, marginBottom: 3 }}>
                Upload my meme
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>
                Drag & drop or browse — JPG, PNG, GIF or MP4 video
              </div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--t3)' }}>→</span>
          </button>

          {/* AI image */}
          <button
            onClick={() => setMethod(method === 'ai-image' ? 'none' : 'ai-image')}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '18px 20px', borderRadius: 12, cursor: 'pointer',
              width: '100%', textAlign: 'left',
              background: method === 'ai-image' ? 'rgba(185,241,74,0.06)' : 'var(--s1)',
              border: `1.5px solid ${method === 'ai-image' ? 'var(--green)' : 'var(--s3)'}`,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ width: 46, height: 46, borderRadius: 10, background: 'rgba(185,241,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              🎨
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--t0)', fontSize: 14, marginBottom: 3 }}>
                Generate image meme with AI
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>
                Describe your concept — FLUX AI generates a real meme image via HuggingFace
              </div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--t3)' }}>→</span>
          </button>

          {/* AI video */}
          <button
            onClick={() => setMethod(method === 'ai-video' ? 'none' : 'ai-video')}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '18px 20px', borderRadius: 12, cursor: 'pointer',
              width: '100%', textAlign: 'left',
              background: method === 'ai-video' ? 'rgba(245,200,66,0.06)' : 'var(--s1)',
              border: `1.5px solid ${method === 'ai-video' ? 'var(--yellow)' : 'var(--s3)'}`,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ width: 46, height: 46, borderRadius: 10, background: 'rgba(245,200,66,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              🎬
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontWeight: 700, color: 'var(--t0)', fontSize: 14 }}>Generate video meme with AI</span>
                <span className="badge badge-yellow" style={{ fontSize: 9 }}>NEW</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>
                Kling 2.6 AI generates a video meme from your description
              </div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--t3)' }}>→</span>
          </button>
        </div>

        {/* Upload zone — appears when upload is selected */}
        {method === 'upload' && (
          <DropZone onFile={handleFile} />
        )}

        {/* AI prompt — appears when AI method is selected */}
        {(method === 'ai-image' || method === 'ai-video') && (
          <div style={{ padding: '20px', background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: 12 }}>
            <div style={{ fontWeight: 600, color: 'var(--t0)', fontSize: 14, marginBottom: 12 }}>
              Describe your meme
              <span style={{ fontWeight: 400, color: 'var(--t2)', fontSize: 12, marginLeft: 8 }}>
                — Kimi K2 will enhance your prompt before generating
              </span>
            </div>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={
                method === 'ai-video'
                  ? 'e.g. A frog dancing with BNB coins flying around, excited crypto mood'
                  : 'e.g. Pepe holding a BNB coin looking smug and satisfied'
              }
              rows={3}
              className="input"
              style={{ resize: 'vertical', marginBottom: 12, lineHeight: 1.6 }}
            />

            {/* Quick prompts */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                'Pepe holding BNB coin looking rich',
                'Doge surfing a green candle to the moon',
                'CZ in anime style with rockets launching',
                'BNB frog flexing on broke coins',
              ].map(p => (
                <button
                  key={p}
                  onClick={() => setPrompt(p)}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
                    background: prompt === p ? 'rgba(185,241,74,0.1)' : 'var(--s2)',
                    border:     `1px solid ${prompt === p ? 'rgba(185,241,74,0.3)' : 'var(--s3)'}`,
                    color:      prompt === p ? 'var(--green)' : 'var(--t2)',
                    transition: 'all 0.12s',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            {genError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, color: 'var(--red)', background: 'rgba(255,85,85,0.07)', border: '1px solid rgba(255,85,85,0.2)', marginBottom: 12 }}>
                {genError}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || genLoading}
              className="btn-primary"
              style={{ width: '100%', fontSize: 14, padding: '12px' }}
            >
              {genLoading
                ? method === 'ai-video' ? '🎬 Generating video (30–60s)…' : '🎨 Generating meme…'
                : method === 'ai-video' ? 'Generate Video Meme' : 'Generate Image Meme'}
            </button>

            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>
              Powered by FLUX.1-schnell via HuggingFace · Kimi K2 enhances your prompt
            </div>
          </div>
        )}

        {/* How it works */}
        <div style={{ marginTop: 32, paddingTop: 28, borderTop: '1px solid var(--s3)' }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 16 }}>
            How it works
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { n: '01', title: 'Create',  body: 'Upload your meme or generate one with AI — image or video.' },
              { n: '02', title: 'Launch',  body: 'Kimi K2 names it. Token launches on four.meme in 2 minutes.' },
              { n: '03', title: 'Earn',    body: 'You earn royalties on every trade of your token — forever.' },
            ].map(s => (
              <div key={s.n} style={{ padding: '14px', background: 'var(--s1)', borderRadius: 10, border: '1px solid var(--s3)' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--green)', marginBottom: 7, fontWeight: 700 }}>{s.n}</div>
                <div style={{ fontWeight: 700, color: 'var(--t0)', fontSize: 13, marginBottom: 5 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent CTA — separated clearly */}
        <div style={{ marginTop: 20, padding: '16px 18px', borderRadius: 12, background: 'rgba(245,200,66,0.05)', border: '1px solid rgba(245,200,66,0.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--yellow)', fontSize: 13, marginBottom: 3 }}>
                Want AI to create & trade memes for you automatically?
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                Deploy an AI agent — it creates tokens, trades on four.meme, and sends profits to your wallet 24/7.
              </div>
            </div>
            <Link href="/onboarding" className="btn-yellow" style={{ flexShrink: 0, fontSize: 12 }}>
              Deploy Agent
            </Link>
          </div>
        </div>
      </div>
    </div>
  )

  // ════ STAGE: preview ════════════════════════════════════
  if (stage === 'preview' && asset) return (
    <div className="page">
      <div style={wrap}>
        <button onClick={reset} style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
          ← Start over
        </button>
        <StepBar stage="preview" />

        <h2 style={{ fontWeight: 700, fontSize: 20, color: 'var(--t0)', marginBottom: 18 }}>Preview your meme</h2>

        {/* Asset display */}
        <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--s2)', border: '1px solid var(--s3)', marginBottom: 16 }}>
          {asset.type === 'video' ? (
            <video src={asset.url} controls style={{ width: '100%', display: 'block', maxHeight: 400 }} />
          ) : (
            <img src={asset.url} alt="your meme" style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain' }} />
          )}
        </div>

        {/* Source badges */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <span className={`badge ${asset.source === 'ai' ? 'badge-green' : 'badge-grey'}`}>
            {asset.source === 'ai' ? 'AI Generated' : 'Uploaded'}
          </span>
          <span className="badge badge-grey">
            {asset.type === 'video' ? 'Video Meme' : 'Image Meme'}
          </span>
        </div>

        {/* Kimi K2 loading indicator */}
        {kimiDesc.loading && (
          <div style={{ padding: '12px 16px', borderRadius: 9, fontSize: 13, color: 'var(--green)', background: 'rgba(185,241,74,0.05)', border: '1px solid rgba(185,241,74,0.15)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 14, height: 14, border: '2px solid var(--green)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            Kimi K2 is writing your token name and description…
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {!kimiDesc.loading && draft.name && (
          <div style={{ padding: '12px 16px', borderRadius: 9, fontSize: 13, color: 'var(--t1)', background: 'rgba(185,241,74,0.04)', border: '1px solid rgba(185,241,74,0.14)', marginBottom: 16 }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>Kimi K2</span> suggested:{' '}
            <strong style={{ color: 'var(--t0)' }}>{draft.name}</strong>
            <span style={{ color: 'var(--t2)', fontFamily: 'Space Mono, monospace', fontSize: 11, marginLeft: 8 }}>({draft.symbol})</span>
            <span style={{ color: 'var(--t2)', marginLeft: 8 }}>— you can edit everything next</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={reset}>← Redo</button>
          <button
            className="btn-primary"
            style={{ flex: 1, fontSize: 14 }}
            onClick={goToDetails}
            disabled={kimiDesc.loading}
          >
            {kimiDesc.loading ? 'Wait for Kimi K2…' : 'Set token details →'}
          </button>
        </div>
      </div>
    </div>
  )

  // ════ STAGE: details ════════════════════════════════════
  if (stage === 'details') return (
    <div className="page">
      <div style={wrap}>
        <button onClick={() => setStage('preview')} style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
          ← Back
        </button>
        <StepBar stage="details" />

        <h2 style={{ fontWeight: 700, fontSize: 20, color: 'var(--t0)', marginBottom: 6 }}>Token details</h2>
        <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 24 }}>
          Kimi K2 pre-filled these from your meme — edit anything.
        </p>

        {/* Name + Symbol */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--t2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>
              Token Name *
            </label>
            <input
              className="input"
              placeholder="e.g. Pepe on BNB"
              maxLength={20}
              value={draft.name}
              onChange={e => {
                const name = e.target.value
                setDraft(d => ({
                  ...d, name,
                  symbol: d.symbol || name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8),
                }))
              }}
            />
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>{draft.name.length}/20 chars</div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--t2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>
              Symbol *
            </label>
            <input
              className="input"
              placeholder="PEPEBNB"
              maxLength={8}
              style={{ fontFamily: 'Space Mono, monospace' }}
              value={draft.symbol}
              onChange={e => setDraft(d => ({ ...d, symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
            />
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>{draft.symbol.length}/8 chars</div>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, color: 'var(--t2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>
            Description *
          </label>
          <textarea
            className="input"
            placeholder="One sentence about your meme"
            rows={2}
            maxLength={200}
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
            style={{ resize: 'vertical', lineHeight: 1.6 }}
          />
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>{draft.description.length}/200</div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10, color: 'var(--t2)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>
            Category
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setDraft(d => ({ ...d, category: c }))}
                style={{
                  padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: draft.category === c ? 'var(--green)' : 'var(--s2)',
                  color:      draft.category === c ? '#000'       : 'var(--t2)',
                  border:     `1px solid ${draft.category === c ? 'var(--green)' : 'var(--s3)'}`,
                  transition: 'all 0.12s',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Royalty slider */}
        <div style={{ padding: '18px 20px', background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--t0)', fontSize: 14 }}>Your royalty rate</div>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>
                % of every 5% trading fee — paid to your wallet on every trade, forever
              </div>
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 28, color: 'var(--green)', flexShrink: 0 }}>
              {draft.royalty}%
            </div>
          </div>
          <input
            type="range" min={10} max={60} step={5}
            value={draft.royalty}
            onChange={e => setDraft(d => ({ ...d, royalty: parseInt(e.target.value) }))}
            style={{ width: '100%', accentColor: 'var(--green)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
            <span>10% — more liquid</span>
            <span style={{ color: 'var(--green)', fontFamily: 'Space Mono, monospace' }}>
              100 BNB vol → {(100 * 0.05 * draft.royalty / 100).toFixed(2)} BNB to you
            </span>
            <span>60% — max earnings</span>
          </div>
        </div>

        {/* Pre-sale + wallet */}
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--t2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>
              Pre-sale (BNB)
            </label>
            <input
              className="input"
              type="number"
              min="0.001" max="1" step="0.001"
              value={draft.presale}
              onChange={e => setDraft(d => ({ ...d, presale: e.target.value }))}
              style={{ fontFamily: 'Space Mono, monospace' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--t2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>
              Royalty Wallet — royalties go here *
            </label>
            <input
              className="input"
              placeholder="0x…"
              value={draft.wallet}
              onChange={e => setDraft(d => ({ ...d, wallet: e.target.value }))}
              style={{ fontFamily: 'Space Mono, monospace', fontSize: 12 }}
            />
          </div>
        </div>

        <button
          className="btn-primary"
          style={{ width: '100%', fontSize: 14, padding: '13px' }}
          onClick={() => {
            if (!draft.name || !draft.symbol || !draft.description || !draft.wallet) {
              setSubmitError('Please fill in all required fields')
            } else {
              setSubmitError('')
              setStage('review')
            }
          }}
        >
          Review & Launch →
        </button>

        {submitError && (
          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, color: 'var(--red)', background: 'rgba(255,85,85,0.07)', border: '1px solid rgba(255,85,85,0.2)' }}>
            {submitError}
          </div>
        )}
      </div>
    </div>
  )

  // ════ STAGE: review ══════════════════════════════════════
  if (stage === 'review' && asset) return (
    <div className="page">
      <div style={wrap}>
        <button onClick={() => setStage('details')} style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
          ← Edit
        </button>
        <StepBar stage="review" />

        <h2 style={{ fontWeight: 700, fontSize: 20, color: 'var(--t0)', marginBottom: 20 }}>Review your token</h2>

        {/* Summary card */}
        <div style={{ display: 'flex', gap: 16, padding: '16px 20px', background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: 12, marginBottom: 14 }}>
          <div style={{ width: 76, height: 76, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--s2)' }}>
            {asset.type === 'video'
              ? <video src={asset.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src={asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--t0)', marginBottom: 3 }}>{draft.name}</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--green)', marginBottom: 8 }}>
              ${draft.symbol}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{draft.description}</div>
          </div>
        </div>

        {/* Details table */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          {[
            { label: 'Category',     value: draft.category },
            { label: 'Asset type',   value: asset.type === 'video' ? 'Video meme' : 'Image meme' },
            { label: 'Your royalty', value: `${draft.royalty}% of every trade fee — forever`, color: 'var(--green)' },
            { label: 'Pre-sale',     value: `${draft.presale} BNB`,   mono: true },
            { label: 'Wallet',       value: draft.wallet,              mono: true, small: true },
          ].map((row, i, arr) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ fontSize: 12, color: 'var(--t2)', flexShrink: 0 }}>{row.label}</span>
              <span style={{
                fontSize:    row.small ? 11 : 13,
                fontWeight:  row.color ? 700 : 500,
                color:       row.color ?? 'var(--t0)',
                fontFamily:  row.mono ? 'Space Mono, monospace' : 'inherit',
                textAlign:   'right', maxWidth: 300,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Confirmation note */}
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(185,241,74,0.05)', border: '1px solid rgba(185,241,74,0.15)', marginBottom: 20, fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>
          Your token launches on <strong style={{ color: 'var(--t0)' }}>four.meme</strong> within 2 minutes.
          Every trade sends <strong style={{ color: 'var(--green)' }}>{draft.royalty}% of fees</strong> to your wallet automatically, with no action needed from you.
        </div>

        {submitError && (
          <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, color: 'var(--red)', background: 'rgba(255,85,85,0.07)', border: '1px solid rgba(255,85,85,0.2)', marginBottom: 14 }}>
            {submitError}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%', fontSize: 15, padding: '14px', opacity: submitLoading ? 0.6 : 1 }}
          disabled={submitLoading}
          onClick={handleLaunch}
        >
          {submitLoading ? 'Launching on four.meme…' : 'Launch Token — Start Earning'}
        </button>
      </div>
    </div>
  )

  // ════ STAGE: done ════════════════════════════════════════
  if (stage === 'done') return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <div style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
        <StepBar stage="done" />
        <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 26, color: 'var(--t0)', marginBottom: 10 }}>
          {draft.name} is launching!
        </h2>
        <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.75, marginBottom: 24 }}>
          Your token will be live on four.meme within 2 minutes.
          Every trade sends <strong style={{ color: 'var(--green)' }}>{draft.royalty}% of the fee</strong> directly to your wallet — automatically, forever.
        </p>

        <div style={{ padding: '14px 20px', borderRadius: 10, background: 'rgba(185,241,74,0.07)', border: '1px solid rgba(185,241,74,0.2)', marginBottom: 28, fontSize: 12, color: 'var(--t2)' }}>
          <span style={{ fontFamily: 'Space Mono, monospace' }}>{draft.wallet.slice(0, 14)}…{draft.wallet.slice(-6)}</span>
          <span style={{ marginLeft: 8 }}>receives royalties on every trade</span>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href="/feed" className="btn-primary" style={{ fontSize: 13 }}>View Token Feed</Link>
          <button className="btn-secondary" style={{ fontSize: 13 }} onClick={reset}>Create another</button>
        </div>

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--s3)' }}>
          <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 10 }}>
            Want AI to create and trade memes for you automatically?
          </p>
          <Link href="/onboarding" style={{ fontSize: 13, color: 'var(--yellow)', fontWeight: 600 }}>
            Deploy an AI Agent →
          </Link>
        </div>
      </div>
    </div>
  )

  return null
}
