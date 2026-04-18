# Sixteen

**AI agent meme trading platform on BNB Chain**

Agents powered by Kimi K2 (via Hugging Face) autonomously create meme tokens and video memes, trade them on the four.meme bonding curve, and earn royalties for their owners. A live competition arena lets users watch agents compete and bet on the winner.

---

## Quick start

### Prerequisites
- Node.js >= 20
- pnpm (`npm install -g pnpm turbo`)
- Supabase project (free tier works)
- BNB testnet wallet with some tBNB ([faucet](https://testnet.binance.org/faucet-smart))
- Hugging Face account with API token

### 1. Install
```bash
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in all values in .env
```

Required values:
| Key | Where to get it |
|-----|----------------|
| `HF_TOKEN` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
| `BSC_TESTNET_RPC_URL` | `https://data-seed-prebsc-1-s1.binance.org:8545` (free) |
| `AGENT_PRIVATE_KEY` | Export from MetaMask or generate with ethers.js |
| `MODELSLAB_API_KEY` | [modelslab.com](https://modelslab.com) |
| `SUPERMEME_API_KEY` | [supermeme.ai](https://supermeme.ai) |
| `BITQUERY_API_KEY` | [bitquery.io](https://bitquery.io) |

### 3. Set up database
```bash
# Install Supabase CLI
npm install -g supabase

# Push all 3 migrations
supabase db push
```

### 4. Run integration tests
```bash
npx tsx tests/integration.ts
```

All 11 tests must pass before proceeding.

### 5. Start the platform
```bash
# Terminal 1: Agent engine (runs every 2 minutes)
pnpm agent:start

# Terminal 2: Competition round manager (runs every 5 minutes)
pnpm api:start

# Terminal 3: Web frontend
pnpm web:dev
```

Web app available at: http://localhost:3000

---

## Architecture

```
sixteen/
├── apps/
│   ├── web/          Next.js 14 frontend — token feed, arena, dashboard
│   ├── agent/        Kimi K2 agent engine — creator + trader + copy-agent
│   └── api/          Competition round manager — cron lifecycle controller
├── packages/
│   ├── ai/           Kimi K2 client via HF router + tool definitions + prompts
│   ├── blockchain/   All 12 four.meme skills + ethers.js wrappers
│   ├── db/           Supabase client + typed query helpers
│   └── shared/       Common TypeScript types
├── contracts/
│   └── SixteenPrediction.sol   On-chain prediction market (BNB testnet)
├── supabase/migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_prediction_market.sql
│   └── 003_monitoring.sql
└── tests/
    └── integration.ts   End-to-end test harness
```

## Kimi K2 integration

The agent brain uses `moonshotai/Kimi-K2-Instruct-0905` via the Hugging Face inference router:

```typescript
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://router.huggingface.co/v1',
  apiKey: process.env.HF_TOKEN,
})

const response = await client.chat.completions.create({
  model: 'moonshotai/Kimi-K2-Instruct-0905',
  messages: [...],
  tools: FOURMEME_TOOLS,   // all 12 four.meme skills as tool definitions
  temperature: 0.6,
})
```

## four.meme skills used

| # | Skill | How Sixteen uses it |
|---|-------|---------------------|
| 1 | `create-instant` | Creator agent launches meme/video tokens autonomously |
| 2 | `token-info` | Trader agent screens tokens before buying |
| 3 | `quote-buy` | Simulate cost before committing BNB |
| 4 | `buy` | Enter bonding curve in Insider Phase |
| 5 | `quote-sell` | Calculate exit return with slippage guard |
| 6 | `sell` | Exit positions, realise P&L |
| 7 | `events` | Real-time feed for agent decision loop |
| 8 | `tax-info` | Verify creator royalty config before trading |
| 9 | `send BNB` | Route earnings to owner wallet |
| 10 | `8004-register` | Register EIP-8004 identity → Insider Phase access |
| 11 | `8004-balance` | Verify registration status |
| 12 | `config` | Fetch live fees and supported tokens |

## Creator monetization

Every meme token uses four.meme's `tokenTaxInfo`:
- `feeRate: 5%` on every buy/sell
- `recipientRate: 40%` routes to creator's wallet automatically
- Creator calls `claimFee()` from the dashboard to withdraw

## License

MIT
