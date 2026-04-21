'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { useKimi } from '@/hooks/useKimi'

type AssetType = 'image' | 'video'
type Mode = 'upload' | 'ai-image' | 'ai-video'
type Step = 1 | 2 | 3 | 4 | 5

interface MemeAsset { url: string; type: AssetType; source: 'upload'|'ai'; prompt?: string }
interface TrendItem  { concept: string; prompt: string; why: string }

const LABELS = ['Meme', 'AI', 'Games', 'Social', 'Others'] as const

function StepBar({ current }: { current: Step }) {
  const steps = [
    { n: 1 as Step, label: 'Create'   },
    { n: 2 as Step, label: 'Preview'  },
    { n: 3 as Step, label: 'Details'  },
    { n: 4 as Step, label: 'Tokenize' },
    { n: 5 as Step, label: 'Done'     },
  ]
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:28 }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display:'flex', alignItems:'center', flex: i < steps.length-1 ? 1 : 0 }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <div style={{
              width:26, height:26, borderRadius:'50%',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:10, fontWeight:700, fontFamily:'Space Mono, monospace',
              background: s.n < current ? 'var(--green)' : s.n === current ? 'var(--green)' : 'var(--s2)',
              color: s.n <= current ? '#000' : 'var(--t3)',
              border: s.n === current ? 'none' : '1px solid var(--s3)',
              transition:'all 0.2s',
            }}>
              {s.n < current ? '✓' : s.n}
            </div>
            <span style={{ fontSize:10, color: s.n === current ? 'var(--green)' : 'var(--t3)', whiteSpace:'nowrap' }}>
              {s.label}
            </span>
          </div>
          {i < steps.length-1 && (
            <div style={{
              flex:1, height:1, margin:'0 4px', marginBottom:14,
              background: s.n < current ? 'var(--green)' : 'var(--s3)',
              transition:'background 0.2s',
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function CreatePage() {
  const [step,          setStep]          = useState<Step>(1)
  const [mode,          setMode]          = useState<Mode | null>(null)
  const [asset,         setAsset]         = useState<MemeAsset | null>(null)
  const [aiPrompt,      setAiPrompt]      = useState('')
  const [generating,    setGenerating]    = useState(false)
  const [genError,      setGenError]      = useState('')
  const [trends,        setTrends]        = useState<TrendItem[]>([])
  const [trendsLoaded,  setTrendsLoaded]  = useState(false)

  // Token details
  const [tokenName,     setTokenName]     = useState('')
  const [tokenSymbol,   setTokenSymbol]   = useState('')
  const [description,   setDescription]   = useState('')
  const [label,         setLabel]         = useState<typeof LABELS[number]>('Meme')
  const [royaltyPct,    setRoyaltyPct]    = useState(40)
  const [preSale,       setPreSale]       = useState('0.01')
  const [wallet,        setWallet]        = useState('')

  const [submitting,    setSubmitting]    = useState(false)
  const [submitError,   setSubmitError]   = useState('')
  const [result,        setResult]        = useState<{ tokenId: string; message: string } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const kimi    = useKimi()
  const kimiDesc = useKimi()

  // ── Load trends when user opens AI mode ──────────────────
  async function loadTrends() {
    if (trendsLoaded) return
    try {
      const content = await kimi.call({ mode: 'trends' })
      const parsed  = kimi.parseJSON<TrendItem[]>(content)
      if (parsed) { setTrends(parsed); setTrendsLoaded(true) }
    } catch { /* silently fail */ }
  }

  // ── Auto-describe meme with Kimi K2 ──────────────────────
  async function describeWithKimi(prompt: string, type: AssetType) {
    if (!prompt) return
    try {
      const content = await kimiDesc.call({
        mode: 'describe',
        data: { meme_prompt: prompt, asset_type: type, platform: 'four.meme on BNB Chain' },
      })
      const parsed = kimiDesc.parseJSON<{
        name: string; symbol: string; description: string; category: string
      }>(content)
      if (parsed) {
        if (!tokenName)    setTokenName(parsed.name)
        if (!tokenSymbol)  setTokenSymbol(parsed.symbol)
        if (!description)  setDescription(parsed.description)
        const cat = LABELS.find(l => l.toLowerCase() === parsed.category?.toLowerCase())
        if (cat) setLabel(cat)
      }
    } catch { /* silently fail — user fills in manually */ }
  }

  // ── File upload ───────────────────────────────────────────
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url  = URL.createObjectURL(file)
    const type: AssetType = file.type.startsWith('video') ? 'video' : 'image'
    setAsset({ url, type, source: 'upload' })
    setStep(2)
    // Auto-describe based on filename
    describeWithKimi(file.name.replace(/\.[^.]+$/, ''), type)
  }

  // ── AI generation ─────────────────────────────────────────
  async function handleGenerate() {
    if (!aiPrompt.trim()) return
    setGenerating(true); setGenError('')
    try {
      const res  = await fetch('/api/generate-meme', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, type: mode === 'ai-video' ? 'video' : 'image' }),
      })
      const data = await res.json() as { imageUrl?: string; videoUrl?: string; status?: string; error?: string }
      if (!res.ok || data.error) { setGenError(data.error ?? 'Generation failed'); return }
      if (data.status === 'processing') { setGenError('Video generating — check back in 30–60s.'); return }
      const type: AssetType = mode === 'ai-video' ? 'video' : 'image'
      setAsset({ url: data.videoUrl ?? data.imageUrl ?? '', type, source: 'ai', prompt: aiPrompt })
      setStep(2)
      // Auto-describe from the prompt
      describeWithKimi(aiPrompt, type)
    } catch { setGenError('Network error') } finally { setGenerating(false) }
  }

  function handleSymbolFromName(name: string) {
    setTokenName(name)
    if (!tokenSymbol) setTokenSymbol(name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
  }

  async function handleTokenize() {
    if (!asset || !tokenName || !tokenSymbol || !description || !wallet) {
      setSubmitError('Please fill in all required fields'); return
    }
    setSubmitting(true); setSubmitError('')
    try {
      const res  = await fetch('/api/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tokenName, symbol: tokenSymbol, description,
          imageUrl:  asset.type === 'image' ? asset.url : '',
          videoUrl:  asset.type === 'video' ? asset.url : undefined,
          label, creatorWallet: wallet,
          preSaleBnb: parseFloat(preSale), recipientRate: royaltyPct,
        }),
      })
      const data = await res.json() as { tokenId?: string; message?: string; error?: string }
      if (!res.ok || data.error) { setSubmitError(data.error ?? 'Tokenization failed'); return }
      setResult({ tokenId: data.tokenId ?? '', message: data.message ?? '' })
      setStep(5)
    } catch { setSubmitError('Network error') } finally { setSubmitting(false) }
  }

  const iStyle = (active: boolean, accent = 'var(--green)') => ({
    display:'flex', alignItems:'center', gap:16, padding:'16px 18px',
    borderRadius:12, cursor:'pointer', textAlign:'left' as const, width:'100%',
    background: active ? `${accent}08` : 'var(--s1)',
    border: `1px solid ${active ? accent : 'var(--s3)'}`,
    transition:'border-color 0.15s',
  })

  return (
    <div style={{ maxWidth:620, margin:'0 auto' }} className="page-wrap">

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:22, color:'var(--t0)', marginBottom:4 }}>
          Tokenize Your Meme
        </h1>
        <p style={{ fontSize:13, color:'var(--t2)' }}>
          Upload or generate a meme — Kimi K2 writes the token details — launch on four.meme and earn royalties on every trade.
        </p>
      </div>

      <StepBar current={step} />

      {/* ═══ STEP 1: Choose mode ═══ */}
      {step === 1 && (
        <div>
          <div style={{ fontWeight:700, color:'var(--t0)', fontSize:14, marginBottom:14 }}>
            How do you want to create your meme?
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
            <button onClick={() => { setMode('upload'); fileRef.current?.click() }} style={iStyle(mode==='upload')}>
              <div style={{ width:40, height:40, borderRadius:8, background:'rgba(185,241,74,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>📁</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:'var(--t0)', fontSize:14, marginBottom:2 }}>Upload my own meme</div>
                <div style={{ fontSize:12, color:'var(--t2)' }}>JPG, PNG, GIF or MP4. Kimi K2 auto-writes the token details.</div>
              </div>
              <span style={{ color:'var(--t3)' }}>→</span>
            </button>

            <button onClick={() => { setMode('ai-image'); loadTrends() }} style={iStyle(mode==='ai-image')}>
              <div style={{ width:40, height:40, borderRadius:8, background:'rgba(185,241,74,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🎨</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:'var(--t0)', fontSize:14, marginBottom:2 }}>Generate image meme with AI</div>
                <div style={{ fontSize:12, color:'var(--t2)' }}>Describe it — Supermeme AI generates instantly. Kimi K2 names your token.</div>
              </div>
              <span style={{ color:'var(--t3)' }}>→</span>
            </button>

            <button onClick={() => { setMode('ai-video'); loadTrends() }} style={iStyle(mode==='ai-video', 'var(--yellow)')}>
              <div style={{ width:40, height:40, borderRadius:8, background:'rgba(245,200,66,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🎬</div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                  <span style={{ fontWeight:700, color:'var(--t0)', fontSize:14 }}>Generate video meme with AI</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:4, background:'rgba(245,200,66,0.15)', color:'var(--yellow)', border:'1px solid rgba(245,200,66,0.3)' }}>NEW</span>
                </div>
                <div style={{ fontSize:12, color:'var(--t2)' }}>Kling 2.6 AI video. First video meme tokenizer on BNB Chain.</div>
              </div>
              <span style={{ color:'var(--t3)' }}>→</span>
            </button>
          </div>

          <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display:'none' }} onChange={handleFileUpload} />

          {/* AI prompt panel */}
          {(mode === 'ai-image' || mode === 'ai-video') && (
            <div className="card2" style={{ padding:18 }}>
              <div style={{ fontWeight:700, color:'var(--t0)', fontSize:13, marginBottom:12 }}>
                Describe your meme
              </div>

              {/* Kimi K2 trend suggestions */}
              {trends.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>
                    Trending now — powered by Kimi K2
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {trends.slice(0,3).map((t, i) => (
                      <button key={i} onClick={() => setAiPrompt(t.prompt)} style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'9px 12px', borderRadius:8, cursor:'pointer', textAlign:'left',
                        background: aiPrompt === t.prompt ? 'rgba(185,241,74,0.08)' : 'var(--s1)',
                        border: `1px solid ${aiPrompt === t.prompt ? 'rgba(185,241,74,0.3)' : 'var(--s3)'}`,
                      }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:12, color:'var(--t0)' }}>{t.concept}</div>
                          <div style={{ fontSize:11, color:'var(--t2)', marginTop:1 }}>{t.why}</div>
                        </div>
                        <span style={{ fontSize:11, color:'var(--green)', flexShrink:0, marginLeft:12 }}>Use →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual prompt input */}
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={mode === 'ai-video' ? 'e.g. A frog dancing on the moon counting BNB coins' : 'e.g. Pepe holding a BNB coin looking smug'}
                rows={2}
                style={{ width:'100%', padding:'10px 12px', borderRadius:8, background:'var(--s1)',
                  border:'1px solid var(--s3)', color:'var(--t0)', fontSize:13, fontFamily:'inherit',
                  resize:'vertical', outline:'none', marginBottom:10 }}
                onFocus={e => e.target.style.borderColor='var(--green)'}
                onBlur={e => e.target.style.borderColor='var(--s3)'}
              />

              {kimi.loading && (
                <div style={{ fontSize:11, color:'var(--t3)', marginBottom:8 }}>
                  Kimi K2 is fetching trends...
                </div>
              )}
              {genError && (
                <div style={{ padding:'8px 12px', borderRadius:8, fontSize:12, marginBottom:10,
                  background:'rgba(255,96,96,0.08)', border:'1px solid rgba(255,96,96,0.2)', color:'#ff6060' }}>
                  {genError}
                </div>
              )}

              <button onClick={handleGenerate} disabled={!aiPrompt.trim() || generating}
                className="btn-primary" style={{ width:'100%', justifyContent:'center', fontSize:13, opacity:generating?0.6:1 }}>
                {generating ? (mode === 'ai-video' ? 'Generating video (30–60s)…' : 'Generating meme…') : (mode === 'ai-video' ? 'Generate Video Meme' : 'Generate Image Meme')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 2: Preview ═══ */}
      {step === 2 && asset && (
        <div>
          <div style={{ fontWeight:700, color:'var(--t0)', fontSize:14, marginBottom:14 }}>Preview your meme</div>

          <div style={{ borderRadius:14, overflow:'hidden', background:'var(--s2)', border:'1px solid var(--s3)', marginBottom:14 }}>
            {asset.type === 'video' ? (
              <video src={asset.url} controls style={{ width:'100%', maxHeight:340, display:'block' }} />
            ) : (
              <img src={asset.url} alt="preview" style={{ width:'100%', maxHeight:340, objectFit:'contain', display:'block' }} />
            )}
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100,
              background: asset.source==='ai' ? 'rgba(185,241,74,0.1)' : 'rgba(255,255,255,0.05)',
              color: asset.source==='ai' ? 'var(--green)' : 'var(--t2)',
              border: `1px solid ${asset.source==='ai' ? 'rgba(185,241,74,0.25)' : 'var(--s3)'}` }}>
              {asset.source==='ai' ? 'AI Generated' : 'Uploaded'}
            </span>
            <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100,
              background:'rgba(255,255,255,0.05)', color:'var(--t2)', border:'1px solid var(--s3)' }}>
              {asset.type === 'video' ? 'Video' : 'Image'}
            </span>
          </div>

          {/* Kimi K2 auto-describing indicator */}
          {kimiDesc.loading && (
            <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(185,241,74,0.05)',
              border:'1px solid rgba(185,241,74,0.15)', fontSize:12, color:'var(--green)', marginBottom:14 }}>
              Kimi K2 is writing your token details…
            </div>
          )}

          {!kimiDesc.loading && (tokenName || tokenSymbol) && (
            <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(185,241,74,0.05)',
              border:'1px solid rgba(185,241,74,0.15)', fontSize:12, color:'var(--t1)', marginBottom:14 }}>
              Kimi K2 suggested: <strong style={{ color:'var(--green)' }}>{tokenName}</strong>
              {tokenSymbol && <span style={{ fontFamily:'Space Mono, monospace', marginLeft:8, color:'var(--t2)' }}>{tokenSymbol}</span>}
              — continue to edit or accept
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button className="btn-ghost" onClick={() => { setStep(1); setAsset(null); setMode(null) }}>← Redo</button>
            <button className="btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={() => setStep(3)}>
              {kimiDesc.loading ? 'Kimi K2 writing details…' : 'Set token details →'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Token details ═══ */}
      {step === 3 && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ fontWeight:700, color:'var(--t0)', fontSize:14 }}>Token details</div>

          {/* Kimi K2 badge if auto-filled */}
          {(tokenName || tokenSymbol) && (
            <div style={{ padding:'8px 12px', borderRadius:8, fontSize:11,
              background:'rgba(185,241,74,0.05)', border:'1px solid rgba(185,241,74,0.15)', color:'var(--t2)' }}>
              <span style={{ color:'var(--green)', fontWeight:600 }}>Kimi K2</span> pre-filled these from your meme — edit freely
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ fontSize:10, color:'var(--t2)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Token Name *</label>
              <input className="input" placeholder="e.g. Pepe on BNB" maxLength={20} value={tokenName} onChange={e => handleSymbolFromName(e.target.value)} />
              <div style={{ fontSize:10, color:'var(--t3)', marginTop:3 }}>{tokenName.length}/20</div>
            </div>
            <div>
              <label style={{ fontSize:10, color:'var(--t2)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Symbol *</label>
              <input className="input" placeholder="PEPEBNB" maxLength={8} value={tokenSymbol}
                onChange={e => setTokenSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                style={{ fontFamily:'Space Mono, monospace' }} />
              <div style={{ fontSize:10, color:'var(--t3)', marginTop:3 }}>{tokenSymbol.length}/8</div>
            </div>
          </div>

          <div>
            <label style={{ fontSize:10, color:'var(--t2)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Description *</label>
            <textarea className="input" rows={2} maxLength={200} placeholder="What is this meme about?"
              value={description} onChange={e => setDescription(e.target.value)} style={{ resize:'vertical' }} />
            <div style={{ fontSize:10, color:'var(--t3)', marginTop:3 }}>{description.length}/200</div>
          </div>

          <div>
            <label style={{ fontSize:10, color:'var(--t2)', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }}>Category</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {LABELS.map(l => (
                <button key={l} onClick={() => setLabel(l)} style={{
                  padding:'5px 14px', borderRadius:100, fontSize:12, fontWeight:600, cursor:'pointer',
                  background: label===l ? 'var(--green)' : 'var(--s2)',
                  color: label===l ? '#000' : 'var(--t2)',
                  border: label===l ? '1px solid var(--green)' : '1px solid var(--s3)',
                }}>{l}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <label style={{ fontSize:10, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Your Royalty Rate</label>
              <span style={{ fontSize:14, fontWeight:700, fontFamily:'Space Mono, monospace', color:'var(--green)' }}>{royaltyPct}%</span>
            </div>
            <input type="range" min={10} max={60} step={5} value={royaltyPct}
              onChange={e => setRoyaltyPct(parseInt(e.target.value))} style={{ width:'100%', accentColor:'var(--green)' }} />
            <div style={{ marginTop:8, padding:'8px 12px', borderRadius:8, background:'var(--s2)',
              border:'1px solid var(--s3)', fontSize:12, color:'var(--t1)' }}>
              You earn <strong style={{ color:'var(--green)' }}>{royaltyPct}%</strong> of every 5% trading fee.
              On 10 BNB traded: <strong style={{ color:'var(--green)' }}>{(10*0.05*royaltyPct/100).toFixed(3)} BNB</strong> to you.
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:10 }}>
            <div>
              <label style={{ fontSize:10, color:'var(--t2)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Pre-sale (BNB)</label>
              <input className="input" type="number" min="0.001" max="1" step="0.001"
                value={preSale} onChange={e => setPreSale(e.target.value)} style={{ fontFamily:'Space Mono, monospace' }} />
            </div>
            <div>
              <label style={{ fontSize:10, color:'var(--t2)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Royalty Wallet *</label>
              <input className="input" placeholder="0x..." value={wallet} onChange={e => setWallet(e.target.value)}
                style={{ fontFamily:'Space Mono, monospace', fontSize:12 }} />
            </div>
          </div>

          {submitError && (
            <div style={{ padding:'8px 12px', borderRadius:8, fontSize:12,
              background:'rgba(255,96,96,0.08)', border:'1px solid rgba(255,96,96,0.2)', color:'#ff6060' }}>
              {submitError}
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button className="btn-ghost" onClick={() => setStep(2)}>← Back</button>
            <button className="btn-primary" style={{ flex:1, justifyContent:'center' }}
              onClick={() => {
                if (!tokenName || !tokenSymbol || !description || !wallet) { setSubmitError('Fill in all required fields') }
                else { setSubmitError(''); setStep(4) }
              }}>
              Review & Tokenize →
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: Review ═══ */}
      {step === 4 && asset && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ fontWeight:700, color:'var(--t0)', fontSize:14 }}>Review your token</div>

          <div style={{ display:'flex', gap:14, padding:16, borderRadius:12, background:'var(--s1)', border:'1px solid var(--s3)' }}>
            <div style={{ width:72, height:72, borderRadius:10, overflow:'hidden', flexShrink:0, background:'var(--s2)' }}>
              {asset.type === 'video' ? (
                <video src={asset.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              ) : (
                <img src={asset.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              )}
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:17, color:'var(--t0)', marginBottom:2 }}>{tokenName}</div>
              <div style={{ fontFamily:'Space Mono, monospace', fontSize:11, color:'var(--green)', marginBottom:6 }}>{tokenSymbol}</div>
              <div style={{ fontSize:12, color:'var(--t2)' }}>{description}</div>
            </div>
          </div>

          <div style={{ borderRadius:10, border:'1px solid var(--s3)', overflow:'hidden' }}>
            {[
              ['Category',     label],
              ['Asset',        asset.type === 'video' ? 'Video meme' : 'Image meme'],
              ['Royalty',      `${royaltyPct}% of every trade`],
              ['Pre-sale',     `${preSale} BNB`],
              ['Wallet',       wallet],
            ].map(([k,v], i) => (
              <div key={k as string} style={{ display:'flex', justifyContent:'space-between', padding:'10px 16px',
                borderBottom: i < 4 ? '1px solid var(--s3)' : 'none',
                background: i%2===0 ? 'var(--s1)' : 'var(--s2)', fontSize:13 }}>
                <span style={{ color:'var(--t2)' }}>{k}</span>
                <span style={{ color:'var(--t0)', fontWeight:500, fontFamily: k==='Wallet'||k==='Pre-sale' ? 'Space Mono, monospace' : 'inherit', fontSize: k==='Wallet'?11:13 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(185,241,74,0.05)',
            border:'1px solid rgba(185,241,74,0.15)', fontSize:12, color:'var(--t2)', lineHeight:1.65 }}>
            Your token launches on <strong style={{ color:'var(--t0)' }}>four.meme</strong> within 2 minutes.
            Royalties flow to your wallet automatically on every trade — forever.
          </div>

          {submitError && (
            <div style={{ padding:'8px 12px', borderRadius:8, fontSize:12,
              background:'rgba(255,96,96,0.08)', border:'1px solid rgba(255,96,96,0.2)', color:'#ff6060' }}>
              {submitError}
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button className="btn-ghost" onClick={() => setStep(3)}>← Edit</button>
            <button onClick={handleTokenize} disabled={submitting} className="btn-primary"
              style={{ flex:1, justifyContent:'center', fontSize:14, opacity:submitting?0.6:1 }}>
              {submitting ? 'Tokenizing…' : 'Launch on four.meme'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 5: Success ═══ */}
      {step === 5 && result && (
        <div style={{ textAlign:'center', padding:'20px 0' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
          <h2 style={{ fontWeight:700, fontSize:22, color:'var(--t0)', marginBottom:8 }}>{tokenName} is live!</h2>
          <p style={{ fontSize:13, color:'var(--t2)', lineHeight:1.7, marginBottom:24, maxWidth:380, margin:'0 auto 24px' }}>
            {result.message}
          </p>
          <div style={{ padding:'12px 18px', borderRadius:10, background:'rgba(185,241,74,0.07)',
            border:'1px solid rgba(185,241,74,0.2)', marginBottom:24, fontSize:13, color:'var(--t1)' }}>
            Your wallet <span style={{ fontFamily:'Space Mono, monospace', fontSize:11 }}>{wallet.slice(0,10)}…</span> earns{' '}
            <strong style={{ color:'var(--green)' }}>{royaltyPct}%</strong> of fees on every trade — automatically.
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <Link href="/" className="btn-primary" style={{ fontSize:13 }}>View Token Feed</Link>
            <button className="btn-ghost" style={{ fontSize:13 }} onClick={() => {
              setStep(1); setMode(null); setAsset(null)
              setTokenName(''); setTokenSymbol(''); setDescription(''); setWallet(''); setResult(null)
            }}>Create another</button>
          </div>
        </div>
      )}
    </div>
  )
}
