// ============================================================
// SIXTEEN — apps/agent/src/memegen.ts
// AI meme generation pipeline
//   Static memes : Supermeme.ai API
//   Video memes  : Kling 2.6 via ModelsLab unified API
// ============================================================

import axios from 'axios'
import { uploadMemeImage } from '@sixteen/blockchain'

// ── Static meme generation — Supermeme.ai ─────────────────

export interface GeneratedMeme {
  imageUrl: string        // URL returned by Supermeme.ai
  caption: string
  templateName: string
}

export async function generateStaticMeme(
  concept: string,
  count = 3
): Promise<GeneratedMeme[]> {
  const apiKey = process.env['SUPERMEME_API_KEY']
  if (!apiKey) throw new Error('Missing SUPERMEME_API_KEY')

  const res = await axios.post(
    'https://supermeme.ai/api/meme',
    {
      text: concept,
      count,
      aspect_ratio: '1:1',
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  )

  const memes = (res.data as {
    memes: Array<{ url: string; caption: string; template_name: string }>
  }).memes ?? []

  return memes.map((m) => ({
    imageUrl: m.url,
    caption: m.caption,
    templateName: m.template_name,
  }))
}

// ── Pick best meme from generated options ─────────────────
// Returns the first result — in Session 3 Kimi K2 will score each option

export async function getBestStaticMeme(concept: string): Promise<GeneratedMeme> {
  const memes = await generateStaticMeme(concept, 3)
  if (!memes[0]) throw new Error('Supermeme.ai returned no memes')
  return memes[0]
}

// ── Download image from URL into Buffer ───────────────────

export async function downloadImageAsBuffer(url: string): Promise<Buffer> {
  const res = await axios.get(url, { responseType: 'arraybuffer' })
  return Buffer.from(res.data as ArrayBuffer)
}

// ── Upload meme image to four.meme ────────────────────────
// Returns the four.meme hosted image URL needed for token creation

export async function uploadMemeToFourMeme(imageUrl: string): Promise<string> {
  const buffer = await downloadImageAsBuffer(imageUrl)
  const fourMemeUrl = await uploadMemeImage(buffer, 'image/jpeg')
  return fourMemeUrl
}

// ── Video meme generation — Kling 2.6 via ModelsLab ───────

export interface GeneratedVideo {
  videoUrl: string
  thumbnailUrl: string
  prompt: string
  durationSecs: number
}

export async function generateVideoMeme(
  prompt: string,
  durationSecs = 5
): Promise<GeneratedVideo> {
  const apiKey = process.env['MODELSLAB_API_KEY']
  if (!apiKey) throw new Error('Missing MODELSLAB_API_KEY')

  // Step 1: Submit video generation job to Kling 2.6
  const submitRes = await axios.post(
    'https://modelslab.com/api/v6/video/text2video',
    {
      key: apiKey,
      model_id: 'kling-v2-6',          // Kling 2.6 model
      prompt,
      negative_prompt: 'low quality, blurry, watermark, text overlay',
      num_frames: durationSecs * 24,    // 24fps
      width: 720,
      height: 720,
      num_inference_steps: 30,
      guidance_scale: 7.5,
      webhook: null,
      track_id: null,
    },
    { headers: { 'Content-Type': 'application/json' } }
  )

  const jobData = submitRes.data as {
    status: string
    id: string
    output?: string[]
    eta?: number
  }

  if (jobData.status === 'error') {
    throw new Error(`ModelsLab video generation failed: ${JSON.stringify(jobData)}`)
  }

  // Step 2: Poll for completion (Kling takes 5-10 minutes)
  const jobId = jobData.id
  let videoUrl = jobData.output?.[0] ?? null
  let attempts = 0
  const maxAttempts = 60  // poll for up to 5 minutes (every 5s)

  while (!videoUrl && attempts < maxAttempts) {
    await sleep(5000)
    const statusRes = await axios.post(
      'https://modelslab.com/api/v6/video/fetch',
      { key: apiKey, request_id: jobId },
      { headers: { 'Content-Type': 'application/json' } }
    )
    const statusData = statusRes.data as { status: string; output?: string[] }
    if (statusData.status === 'success' && statusData.output?.[0]) {
      videoUrl = statusData.output[0]
    }
    attempts++
  }

  if (!videoUrl) throw new Error('Video generation timed out after 5 minutes')

  // Step 3: Extract thumbnail (first frame) from video URL
  // In production, use ffmpeg or a frame extraction service
  // For now, use ModelsLab's thumbnail endpoint
  const thumbnailUrl = videoUrl.replace('.mp4', '_thumb.jpg')

  return {
    videoUrl,
    thumbnailUrl,
    prompt,
    durationSecs,
  }
}

// ── Helper ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
