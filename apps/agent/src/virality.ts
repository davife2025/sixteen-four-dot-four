// ============================================================
// SIXTEEN — apps/agent/src/virality.ts
// Pre-launch virality scorer — Kimi K2 scores every meme
// concept before it is allowed to launch on four.meme
// Threshold: score >= 60 to proceed
// ============================================================

import { kimiChat } from '@sixteen/ai'
import type { ChatCompletionMessageParam } from 'openai/resources'

export interface ViralityResult {
  score: number           // 0-100
  recommendation: 'GO' | 'WAIT' | 'ABORT'
  reasoning: string
  suggestedTiming?: string
}

const VIRALITY_SYSTEM_PROMPT = `
You are a meme virality expert. Given a meme concept and current trend context,
score its viral potential from 0 to 100 and give a recommendation.

Scoring criteria:
- Cultural relevance to current trends (0-30 pts)
- Humor and shareability (0-25 pts)
- Crypto/BNB community fit (0-20 pts)
- Originality and timing (0-15 pts)
- Token name memorability (0-10 pts)

Recommendations:
- GO (score >= 60): Launch now
- WAIT (score 40-59): Good concept, wait for better timing or improve it
- ABORT (score < 40): Weak concept, do not launch

Respond ONLY with valid JSON in this exact format:
{
  "score": <number 0-100>,
  "recommendation": "GO" | "WAIT" | "ABORT",
  "reasoning": "<one sentence explanation>",
  "suggestedTiming": "<optional: e.g. 'Launch during US market hours 2pm EST'>"
}
`.trim()

export async function scoreMemeVirality(
  concept: string,
  trendContext: string,
  tokenName: string
): Promise<ViralityResult> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: VIRALITY_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `
Meme concept: ${concept}
Token name: ${tokenName}
Current trending topics: ${trendContext}

Score this meme's virality potential.
      `.trim(),
    },
  ]

  const response = await kimiChat({ messages, temperature: 0.6, maxTokens: 512 })

  try {
    const parsed = JSON.parse(response.content) as ViralityResult
    return parsed
  } catch {
    // fallback if Kimi K2 doesn't return clean JSON
    return {
      score: 0,
      recommendation: 'ABORT',
      reasoning: 'Failed to parse virality score — defaulting to ABORT for safety',
    }
  }
}
