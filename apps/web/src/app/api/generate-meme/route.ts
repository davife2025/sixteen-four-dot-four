// ============================================================
// SIXTEEN — /api/generate-meme
//
// Uses HuggingFace Inference API for real AI image generation.
// Same HF_TOKEN already used for Kimi K2.
//
// Model: black-forest-labs/FLUX.1-schnell
//   - Completely free on HF inference
//   - Best image quality for text-to-image
//   - Returns binary image data (JPEG)
//
// Kimi K2 enhances the user's prompt first for better results.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

export const runtime    = 'edge'
export const maxDuration = 55

const HF_BASE = 'https://api-inference.huggingface.co/models'

// Primary model — FLUX.1-schnell: best free text-to-image on HF
const IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell'

// Fallback model if FLUX is overloaded
const FALLBACK_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { prompt: string; type?: 'image' | 'video' }
    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const hfToken = process.env['HF_TOKEN']
    if (!hfToken) {
      return NextResponse.json({
        error: 'HF_TOKEN not configured — add it to your environment variables',
      }, { status: 500 })
    }

    if (body.type === 'video') {
      return handleVideo(body.prompt, hfToken)
    }

    return handleImage(body.prompt, hfToken)
  } catch (err) {
    console.error('[generate-meme]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

// ── Step 1: Kimi K2 enhances the meme prompt ──────────────

async function enhancePrompt(raw: string, hfToken: string): Promise<string> {
  try {
    const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'moonshotai/Kimi-K2-Instruct-0905',
        max_tokens:  100,
        temperature: 0.7,
        messages: [{
          role:    'user',
          content: `You are a meme image prompt expert for viral crypto memes on BNB Chain. Rewrite the following into a detailed, vivid image generation prompt (max 70 words). Make it funny, specific, and visually striking. Output ONLY the enhanced prompt, nothing else.\n\nInput: ${raw}`,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return raw
    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    const enhanced = data.choices?.[0]?.message?.content?.trim()
    return enhanced || raw
  } catch {
    return raw // if Kimi fails, use original prompt
  }
}

// ── Step 2: Generate image via HF Inference ───────────────

async function generateWithHF(prompt: string, model: string, hfToken: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`${HF_BASE}/${model}`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type':  'application/json',
        'Accept':         'image/jpeg,image/png,image/*',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          num_inference_steps: 4,    // FLUX.1-schnell is optimised for 4 steps
          guidance_scale:      0,    // distilled model — no CFG needed
          width:               512,
          height:              512,
        },
        options: {
          wait_for_model: true,
          use_cache:      false,
        },
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!res.ok) {
      console.warn(`[generate-meme] HF model ${model} returned ${res.status}`)
      return null
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('image')) {
      console.warn(`[generate-meme] Unexpected content-type: ${contentType}`)
      return null
    }

    return await res.arrayBuffer()
  } catch (err) {
    console.warn(`[generate-meme] HF inference error:`, err)
    return null
  }
}

// ── Image handler ─────────────────────────────────────────

async function handleImage(prompt: string, hfToken: string) {
  // Kimi K2 enhances the prompt first
  const enhanced = await enhancePrompt(prompt, hfToken)
  const finalPrompt = `${enhanced}, meme format, internet culture, high quality, funny, viral`

  // Try primary model (FLUX.1-schnell)
  let imageBuffer = await generateWithHF(finalPrompt, IMAGE_MODEL, hfToken)

  // Fallback to SDXL if FLUX is unavailable
  if (!imageBuffer) {
    console.log('[generate-meme] Trying fallback model SDXL...')
    imageBuffer = await generateWithHF(finalPrompt, FALLBACK_MODEL, hfToken)
  }

  if (!imageBuffer) {
    return NextResponse.json({
      error: 'Image generation temporarily unavailable — HuggingFace models may be loading. Try again in 30 seconds.',
    }, { status: 503 })
  }

  // Convert to base64 data URL so the browser can display it directly
  const base64 = Buffer.from(imageBuffer).toString('base64')
  const imageUrl = `data:image/jpeg;base64,${base64}`

  return NextResponse.json({
    imageUrl,
    source:   'huggingface-flux',
    model:    IMAGE_MODEL,
    prompt:   prompt,
    enhanced,
  })
}

// ── Video handler ─────────────────────────────────────────

async function handleVideo(prompt: string, hfToken: string) {
  const apiKey = process.env['MODELSLAB_API_KEY']

  if (!apiKey) {
    // No video key — generate a great image as fallback
    return handleImage(prompt, hfToken)
  }

  try {
    const enhanced = await enhancePrompt(prompt, hfToken)
    const res = await fetch('https://modelslab.com/api/v6/video/kling', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key:             apiKey,
        prompt:          `${enhanced}, meme video, viral, funny, internet culture`,
        negative_prompt: 'blurry, watermark, low quality, text errors',
        duration: 5, aspect_ratio: '1:1', mode: 'std',
      }),
      signal: AbortSignal.timeout(25000),
    })

    const data = await res.json() as { status: string; output?: string[]; id?: number; eta?: number }

    if (data.status === 'success' && data.output?.[0]) {
      return NextResponse.json({ videoUrl: data.output[0], imageUrl: data.output[0], source: 'kling', status: 'complete', prompt })
    }

    // Video processing — return image in the meantime
    const imgResult = await handleImage(prompt, hfToken)
    const imgData   = await imgResult.json() as { imageUrl?: string }
    return NextResponse.json({
      ...imgData,
      videoUrl:  null,
      status:    'processing',
      jobId:     data.id,
      eta:       data.eta ?? 45,
      message:   'Video is generating. Image shown in the meantime.',
    })
  } catch {
    return handleImage(prompt, hfToken)
  }
}
