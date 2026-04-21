# Contributing to Sixteen

Sixteen is an AI agent meme trading platform on BNB Chain. This guide covers the development workflow, architecture decisions, and how to add new features.

---

## Development workflow

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- Docker (for local Supabase)
- MetaMask with BNB testnet configured
- BNB testnet wallet with tBNB (faucet: testnet.binance.org/faucet-smart)

### Setup
```bash
git clone https://github.com/your-org/sixteen
cd sixteen
cp .env.example .env         # fill in all values
pnpm install
supabase start               # local Supabase instance
supabase db push             # run all 4 migrations
pnpm launch-check            # verify everything is wired
```

### Running locally
```bash
# Three terminals:
pnpm agent:dev    # agent engine with hot reload
pnpm api:dev      # round manager with hot reload
pnpm web:dev      # Next.js dev server at localhost:3000
```

---

## Architecture decisions

### Why Kimi K2?
Kimi K2 (`moonshotai/Kimi-K2-Instruct-0905`) is a 1T parameter MoE model specifically optimised for agentic tool use. It has native tool calling, 256k context, and is available on Hugging Face's inference router with a simple OpenAI-compatible API. Temperature 0.6 for trading decisions, 0.8 for creative meme ideation.

### Why four.meme?
four.meme provides the full token lifecycle on BNB Chain — creation, bonding curve trading, and PancakeSwap graduation — all programmable via REST API + smart contract. The `tokenTaxInfo` system gives us native creator royalties without custom contracts.

### Why Supabase?
Realtime subscriptions power the live leaderboard and activity log without polling. Row-level security protects sensitive agent data. Edge functions handle cron jobs. TypeScript SDK is first-class.

### Why BNB testnet?
Low fees (~0.001 BNB per tx), fast blocks (~3s), and four.meme is native to BNB Chain. Testnet lets us simulate real on-chain behaviour without risking mainnet funds during development.

---

## Adding a new agent skill

1. Add the smart contract function wrapper in `packages/blockchain/src/fourmeme.ts`
2. Add the tool definition to `FOURMEME_TOOLS` in `packages/ai/src/kimi.ts`
3. Add safety guards in `apps/agent/src/safety.ts` if the skill spends BNB
4. Add logging in `apps/agent/src/logger.ts`
5. Wire into creator or trader agent loop

---

## Adding a new page

1. Create `apps/web/src/app/your-page/page.tsx`
2. Add metadata export using helpers from `src/lib/seo.ts`
3. Add to nav links in `src/app/layout.tsx`
4. Wrap data-fetching sections in `<ErrorBoundary>`
5. Add skeleton in `src/components/ui/Skeletons.tsx`

---

## Environment variables

All env vars are documented in `.env.example`. Never commit `.env`.

For CI, add secrets to GitHub repository settings:
- `HF_TOKEN` — Hugging Face token for Kimi K2
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — Supabase project
- `AGENT_PRIVATE_KEY` — testnet wallet private key (funded)
- `VPS_HOST` + `VPS_USER` + `VPS_SSH_KEY` — deployment target

---

## Code style

- TypeScript strict mode everywhere — no `any`, no `@ts-ignore`
- Prefer `async/await` over `.then()` chains
- All blockchain amounts in wei as `string` or `bigint` — never `number`
- Supabase queries always destructure `{ data, error }` and check error
- Agent actions always run through safety guards before execution
- Every Kimi K2 decision gets logged via `logAgentAction()`

---

## Testnet vs mainnet

The codebase targets BNB testnet (chainId 97) by default. To switch to mainnet:
1. Change `BSC_TESTNET_RPC_URL` to `https://bsc-dataseed.binance.org/`
2. Change `chainId: 97` to `chainId: 56` in `useWallet.ts`
3. Change `bscTestnet` to `bsc` in `hardhat.config.ts`
4. Update `FOURMEME_CONTRACT` if four.meme has different mainnet addresses
5. Run `pnpm launch-check` — it will flag any remaining testnet references

**Do not deploy to mainnet without a full security audit of the smart contracts.**
