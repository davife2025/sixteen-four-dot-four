// ============================================================
// SIXTEEN — apps/agent/src/memegen.ts
// AI meme generation for the agent pipeline
//
// Pipeline:
//   1. Kimi K2 rewrites concept into optimised image prompt
//   2. HuggingFace FLUX.1-schnell generates the image (binary)
//      Fallback → Pollinations.ai (URL-based, no key needed)
//   3. uploadMemeToFourMeme uploads buffer to four.meme CDN
//   4. For video: ModelsLab Kling 2.6
// ============================================================

import axios from 'axios'
import { kimiChat } from '@sixteen/ai'
import { uploadMemeImage } from '@sixteen/blockchain'
import type { ChatCompletionMessageParam } from 'openai/resources/chat'

const HF_BASE  = 'https://api-inference.huggingface.co/models'
const HF_MODEL = 'black-forest-labs/FLUX.1-schnell'
const HF_FALLBACK = 'stabilityai/stable-diffusion-xl-base-1.0'

// ── Kimi K2: enhance the image generation prompt ──────────

export async function enhancePromptWithKimi(concept: string): Promise<string> {
  try {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are an expert AI image generation prompt engineer specialising in internet meme culture and BNB Chain crypto.
Given a meme concept, rewrite it as a detailed, vivid prompt for Flux AI image generation.
Output ONLY the enhanced prompt — no labels, no explanation, no quotes.
Max 80 words. Include art style, key visual elements, mood, lighting.
Make it funny, viral, crypto-culture relevant. Do NOT include any text overlays or words in the image.`,
      },
      { role: 'user', content: concept },
    ]
    const response = await kimiChat({ messages, temperature: 0.85, maxTokens: 120 })
    const enhanced = response.content.trim()
    return enhanced.length > 8 ? enhanced : concept
  } catch {
    return concept
  }
}

// ── HuggingFace FLUX: real AI image generation ────────────

async function generateWithHF(prompt: string, model: string): Promise<Buffer | null> {
  const hfToken = process.env['HF_TOKEN']
  if (!hfToken) return null

  try {
    const res = await axios.post(
      `${HF_BASE}/${model}`,
      {
        inputs: `${prompt}, meme style, internet culture, funny, viral, high quality`,
        parameters: {
          num_inference_steps: 4,
          guidance_scale:      0,
          width:               512,
          height:              512,
        },
        options: { wait_for_model: true, use_cache: false },
      },
      {
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
          Accept: 'image/jpeg,image/png,image/*',
        },
        responseType: 'arraybuffer',
        timeout:      45000,
      }
    )

    const contentType = res.headers['content-type'] as string ?? ''
    if (!contentType.includes('image')) {
      console.warn(`[memegen] HF returned non-image content-type: ${contentType}`)
      return null
    }

    return Buffer.from(res.data as ArrayBuffer)
  } catch (err: any) {
    console.warn(`[memegen] HF ${model} failed:`, err?.response?.status ?? err?.message)
    return null
  }
}

// ── Pollinations: URL-based fallback (no key needed) ──────

function buildPollinationsUrl(prompt: string): string {
  const enriched = `${prompt}, meme style, funny, viral, crypto culture, high quality digital art`
  const seed     = Math.floor(Math.random() * 999999)
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(enriched)}?width=512&height=512&model=flux&nologo=true&seed=${seed}`
}

// ── Download any image URL to a Buffer ────────────────────

export async function downloadImageAsBuffer(url: string): Promise<Buffer> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout:      30000,
    headers:      { 'User-Agent': 'Sixteen-Agent/1.0' },
  })
  return Buffer.from(res.data)
}

// ── Main: generate the best static meme ───────────────────

export interface GeneratedMeme {
  imageUrl:        string   // URL or data (for uploading)
  imageBuffer?:    Buffer   // binary if available
  enhancedPrompt:  string
  originalConcept: string
  source:          'hf-flux' | 'hf-sdxl' | 'pollinations'
}

export async function getBestStaticMeme(concept: string): Promise<GeneratedMeme> {
  console.log(`[memegen] Enhancing prompt with Kimi K2…`)
  const enhanced = await enhancePromptWithKimi(concept)
  console.log(`[memegen] Enhanced: "${enhanced.slice(0, 60)}…"`)

  // Try HF FLUX first (best quality, uses same HF_TOKEN)
  console.log('[memegen] Generating image with HF FLUX.1-schnell…')
  let buffer = await generateWithHF(enhanced, HF_MODEL)

  if (buffer) {
    console.log(`[memegen] HF FLUX success — ${buffer.length} bytes`)
    return {
      imageUrl:        `data:image/jpeg;base64,${buffer.toString('base64')}`,
      imageBuffer:     buffer,
      enhancedPrompt:  enhanced,
      originalConcept: concept,
      source:          'hf-flux',
    }
  }

  // Fallback to SDXL
  console.log('[memegen] FLUX unavailable — trying SDXL fallback…')
  buffer = await generateWithHF(enhanced, HF_FALLBACK)

  if (buffer) {
    console.log(`[memegen] SDXL success — ${buffer.length} bytes`)
    return {
      imageUrl:        `data:image/jpeg;base64,${buffer.toString('base64')}`,
      imageBuffer:     buffer,
      enhancedPrompt:  enhanced,
      originalConcept: concept,
      source:          'hf-sdxl',
    }
  }

  // Final fallback: Pollinations URL
  console.log('[memegen] HF unavailable — using Pollinations URL fallback')
  const pollinationsUrl = buildPollinationsUrl(enhanced)
  return {
    imageUrl:        pollinationsUrl,
    enhancedPrompt:  enhanced,
    originalConcept: concept,
    source:          'pollinations',
  }
}

// ── Upload meme to four.meme CDN ──────────────────────────

export async function uploadMemeToFourMeme(imageUrlOrData: string, imageBuffer?: Buffer): Promise<string> {
  try {
    let buffer: Buffer

    if (imageBuffer) {
      // Already have the buffer (from HF)
      buffer = imageBuffer
    } else if (imageUrlOrData.startsWith('data:')) {
      // Base64 data URL
      const base64 = imageUrlOrData.split(',')[1]
      buffer = Buffer.from(base64 ?? '', 'base64')
    } else {
      // Download from URL (Pollinations fallback)
      console.log('[memegen] Downloading image from URL…')
      buffer = await downloadImageAsBuffer(imageUrlOrData)
    }

    const cdnUrl = await uploadMemeImage(buffer, 'image/jpeg')
    console.log(`[memegen] Uploaded to four.meme CDN: ${cdnUrl}`)
    return cdnUrl
  } catch (err) {
    console.warn('[memegen] Upload failed, using source URL directly:', err)
    // If upload fails and we have a direct URL, return it
    if (!imageUrlOrData.startsWith('data:')) return imageUrlOrData
    throw new Error('Image upload failed and no fallback URL available')
  }
}

// ── Video generation via Kling 2.6 ───────────────────────

export interface GeneratedVideo {
  videoUrl:     string | null
  thumbnailUrl: string
  jobId?:       number
  status:       'done' | 'processing' | 'failed'
}

export async function generateVideoMeme(concept: string): Promise<GeneratedVideo> {
  const apiKey = process.env['MODELSLAB_API_KEY']

  const enhanced = await enhancePromptWithKimi(
    `${concept}, animated video meme, looping, funny, viral`
  )

  if (!apiKey) {
    console.warn('[memegen] No MODELSLAB_API_KEY — generating static image instead of video')
    const pollinationsUrl = buildPollinationsUrl(enhanced)
    return { videoUrl: null, thumbnailUrl: pollinationsUrl, status: 'failed' }
  }

  try {
    const res = await axios.post(
      'https://modelslab.com/api/v6/video/kling',
      {
        key:             apiKey,
        prompt:          enhanced,
        negative_prompt: 'blurry, low quality, watermark, nsfw',
        duration:        5,
        aspect_ratio:    '1:1',
        mode:            'std',
        webhook:         null,
        track_id:        null,
      },
      { timeout: 30000 }
    )

    const data = res.data as { status: string; id?: number; output?: string[]; eta?: number }

    if (data.status === 'success' && data.output?.[0]) {
      return { videoUrl: data.output[0], thumbnailUrl: data.output[0], status: 'done' }
    }

    if (data.status === 'processing' && data.id) {
      const thumbUrl = buildPollinationsUrl(enhanced)
      return { videoUrl: null, thumbnailUrl: thumbUrl, jobId: data.id, status: 'processing' }
    }

    throw new Error('Unexpected response from Kling')
  } catch (err) {
    console.warn('[memegen] Kling video failed:', err)
    const thumbUrl = buildPollinationsUrl(enhanced)
    return { videoUrl: null, thumbnailUrl: thumbUrl, status: 'failed' }
  }
}

export { buildPollinationsUrl }
