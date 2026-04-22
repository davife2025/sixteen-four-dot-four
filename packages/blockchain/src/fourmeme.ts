// ============================================================
// SIXTEEN — packages/blockchain/src/fourmeme.ts
// four.meme skill wrappers — all 12 skills
// ============================================================

import { ethers } from 'ethers'
import axios from 'axios'

const BSC_TESTNET_RPC = process.env['BSC_TESTNET_RPC_URL']
  ?? 'https://data-seed-prebsc-1-s1.binance.org:8545'

const FOURMEME_BASE_URL     = 'https://four.meme/meme-api'
const TOKEN_MANAGER_HELPER3 = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'
const EIP8004_REGISTRY      = '0x0000000000000000000000000000000000008004'

let _provider: ethers.JsonRpcProvider | null = null
let _signer:   ethers.Wallet | null = null

export function getProvider(): ethers.JsonRpcProvider {
  if (_provider) return _provider
  _provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC)
  return _provider
}

export function getSigner(): ethers.Wallet {
  if (_signer) return _signer
  const pk = process.env['AGENT_PRIVATE_KEY']
  if (!pk) throw new Error('Missing AGENT_PRIVATE_KEY env var')
  _signer = new ethers.Wallet(pk, getProvider())
  return _signer
}

export function getAgentWalletAddress(): string {
  return getSigner().address
}

async function getFourMemeAccessToken(): Promise<string> {
  const signer  = getSigner()
  const address = signer.address

  const nonceRes = await axios.post(`${FOURMEME_BASE_URL}/v1/private/user/nonce/generate`, {
    accountAddress: address,
    verifyType:     'LOGIN',
    networkCode:    'BSC',
  })
  const nonce: string = nonceRes.data.data as string

  const message   = `You are sign in Meme ${nonce}`
  const signature = await signer.signMessage(message)

  const loginRes = await axios.post(`${FOURMEME_BASE_URL}/v1/private/user/login/dex`, {
    region:     'WEB',
    langType:   'EN',
    loginIp:    '',
    inviteCode: '',
    verifyInfo: { address, networkCode: 'BSC', signature, verifyType: 'LOGIN' },
    walletName: 'MetaMask',
  })
  return loginRes.data.data as string
}

// ── SKILL 1: Create meme token ────────────────────────────

export interface CreateTokenParams {
  name:              string
  shortName:         string
  description:       string
  imageUrl:          string
  label:             string
  preSaleBnb?:       string
  feeRate?:          1 | 3 | 5 | 10
  burnRate?:         number
  divideRate?:       number
  liquidityRate?:    number
  recipientRate?:    number
  recipientAddress?: string
  feePlan?:          boolean
}

export interface CreateTokenResult {
  tokenAddress: string
  txHash:       string
}

export async function createMemeToken(params: CreateTokenParams): Promise<CreateTokenResult> {
  const accessToken = await getFourMemeAccessToken()
  const signer      = getSigner()

  const burn      = params.burnRate      ?? 10
  const divide    = params.divideRate    ?? 40
  const liquidity = params.liquidityRate ?? 10
  const recipient = params.recipientRate ?? 40
  if (burn + divide + liquidity + recipient !== 100) {
    throw new Error(`Tax rates must sum to 100. Got: ${burn + divide + liquidity + recipient}`)
  }

  const createRes = await axios.post(
    `${FOURMEME_BASE_URL}/v1/private/token/create`,
    {
      name:      params.name,
      shortName: params.shortName,
      desc:      params.description,
      imgUrl:    params.imageUrl,
      label:     params.label,
      lpTradingFee: 0.0025,
      preSale:   params.preSaleBnb ?? '0',
      feePlan:   params.feePlan ?? true,
      tokenTaxInfo: {
        feeRate:          params.feeRate ?? 5,
        burnRate:         burn,
        divideRate:       divide,
        liquidityRate:    liquidity,
        recipientRate:    recipient,
        recipientAddress: params.recipientAddress ?? signer.address,
        minSharing:       100000,
      },
    },
    { headers: { 'meme-web-access': accessToken, 'Content-Type': 'application/json' } }
  )

  const { createArg, signature } = createRes.data.data as { createArg: string; signature: string }

  const tokenManager2Abi = [
    'function createToken(bytes calldata createArg, bytes calldata sign) external payable returns (address)',
  ]

  const configRes          = await axios.get(`${FOURMEME_BASE_URL}/v1/public/config`)
  const tokenManagerAddress: string = (configRes.data.data as { tokenManager2Address: string }).tokenManager2Address

  const contract    = new ethers.Contract(tokenManagerAddress, tokenManager2Abi, signer)
  const preSaleWei  = params.preSaleBnb ? ethers.parseEther(params.preSaleBnb) : 0n

  const tx = await (contract['createToken'] as (
    arg: Uint8Array,
    sig: Uint8Array,
    options: { value: bigint }
  ) => Promise<ethers.ContractTransactionResponse>)(
    ethers.getBytes(createArg),
    ethers.getBytes(signature),
    { value: preSaleWei }
  )
  const receipt = await tx.wait()
  if (!receipt) throw new Error('Transaction receipt is null')

  return {
    tokenAddress: receipt.logs[0]?.address ?? '',
    txHash:       receipt.hash,
  }
}

// ── SKILL 2: Token info ───────────────────────────────────

export interface TokenInfo {
  version:        number
  tokenManager:   string
  quote:          string
  lastPrice:      bigint
  tradingFeeRate: bigint
  minTradingFee:  bigint
  launchTime:     bigint
  offers:         bigint
  maxOffers:      bigint
  funds:          bigint
  maxFunds:       bigint
  liquidityAdded: boolean
}

export async function getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
  const helperAbi = [
    'function getTokenInfo(address token) view returns (uint256 version, address tokenManager, address quote, uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee, uint256 launchTime, uint256 offers, uint256 maxOffers, uint256 funds, uint256 maxFunds, bool liquidityAdded)',
  ]
  const helper = new ethers.Contract(TOKEN_MANAGER_HELPER3, helperAbi, getProvider())
  return (helper['getTokenInfo'] as (addr: string) => Promise<TokenInfo>)(tokenAddress)
}

// ── SKILLS 3 & 4: Quote buy + buy ────────────────────────

export interface BuyQuote {
  tokenAmount:  bigint
  fee:          bigint
  priceImpact:  string
}

export async function quoteBuy(tokenAddress: string, fundsBnb: string): Promise<BuyQuote> {
  const helperAbi = [
    'function tryBuy(address token, uint256 funds) view returns (address tokenManager, address quote, uint256 amount, uint256 fee)',
  ]
  const helper   = new ethers.Contract(TOKEN_MANAGER_HELPER3, helperAbi, getProvider())
  const fundsWei = ethers.parseEther(fundsBnb)
  const result   = await (helper['tryBuy'] as (
    token: string,
    funds: bigint
  ) => Promise<{ tokenManager: string; quote: string; amount: bigint; fee: bigint }>)(
    tokenAddress, fundsWei
  )
  return { tokenAmount: result.amount, fee: result.fee, priceImpact: 'calculated' }
}

export async function buyToken(
  tokenAddress: string,
  fundsBnb:     string,
  minTokensWei?: string
): Promise<{ txHash: string; tokenAmount: bigint }> {
  const info = await getTokenInfo(tokenAddress)
  if (info.version !== 2) throw new Error('Only TokenManager V2 supported')

  const tokenManager2Abi = [
    'function buyTokenAMAP(address token, uint256 minAmount) external payable returns (uint256)',
  ]
  const contract  = new ethers.Contract(info.tokenManager, tokenManager2Abi, getSigner())
  const fundsWei  = ethers.parseEther(fundsBnb)
  const minAmount = minTokensWei ? BigInt(minTokensWei) : 0n

  const tx = await (contract['buyTokenAMAP'] as (
    token:     string,
    minAmount: bigint,
    options:   { value: bigint }
  ) => Promise<ethers.ContractTransactionResponse>)(tokenAddress, minAmount, { value: fundsWei })

  const receipt = await tx.wait()
  if (!receipt) throw new Error('Buy tx receipt is null')
  return { txHash: receipt.hash, tokenAmount: minAmount }
}

// ── SKILLS 5 & 6: Quote sell + sell ──────────────────────

export async function quoteSell(
  tokenAddress:   string,
  tokenAmountWei: string
): Promise<{ fundsReturn: bigint; fee: bigint }> {
  const helperAbi = [
    'function trySell(address token, uint256 amount) view returns (address tokenManager, address quote, uint256 funds, uint256 fee)',
  ]
  const helper = new ethers.Contract(TOKEN_MANAGER_HELPER3, helperAbi, getProvider())
  const result = await (helper['trySell'] as (
    token:  string,
    amount: bigint
  ) => Promise<{ tokenManager: string; quote: string; funds: bigint; fee: bigint }>)(
    tokenAddress, BigInt(tokenAmountWei)
  )
  return { fundsReturn: result.funds, fee: result.fee }
}

export async function sellToken(
  tokenAddress:   string,
  tokenAmountWei: string,
  minFundsWei?:   string
): Promise<{ txHash: string; fundsReceived: bigint }> {
  const info = await getTokenInfo(tokenAddress)
  if (info.version !== 2) throw new Error('Only TokenManager V2 supported')

  const tokenManager2Abi = [
    'function sellToken(address token, uint256 amount, uint256 minFunds) external returns (uint256)',
  ]
  const contract = new ethers.Contract(info.tokenManager, tokenManager2Abi, getSigner())
  const minFunds = minFundsWei ? BigInt(minFundsWei) : 0n

  const tx = await (contract['sellToken'] as (
    token:     string,
    amount:    bigint,
    minFunds:  bigint
  ) => Promise<ethers.ContractTransactionResponse>)(
    tokenAddress, BigInt(tokenAmountWei), minFunds
  )
  const receipt = await tx.wait()
  if (!receipt) throw new Error('Sell tx receipt is null')
  return { txHash: receipt.hash, fundsReceived: minFunds }
}

// ── SKILL 7: Event listening ──────────────────────────────

export interface TokenEvent {
  type:        'TokenCreate' | 'TokenPurchase' | 'TokenSale' | 'LiquidityAdded'
  tokenAddress: string
  account:     string
  amount:      bigint
  funds:       bigint
  blockNumber: number
  txHash:      string
}

export async function getRecentEvents(fromBlock: number, toBlock?: number): Promise<TokenEvent[]> {
  const apiKey = process.env['BITQUERY_API_KEY']
  if (!apiKey) throw new Error('Missing BITQUERY_API_KEY')

  const query = `
    query GetFourMemeEvents($from: Int!, $to: Int) {
      EVM(network: bsc_testnet) {
        Events(
          where: {
            Log: { SmartContract: { is: "0x5c952063c7fc8610FFDB798152D69F0B9550762b" } }
            Block: { Number: { gteq: $from } }
          }
          limit: { count: 100 }
        ) {
          Log { Signature { Name } }
          Transaction { Hash }
          Block { Number }
          Arguments { Name Value { ... on EVM_ABI_Address_Value_Arg { address } ... on EVM_ABI_Integer_Value_Arg { integer } } }
        }
      }
    }
  `

  const res = await axios.post(
    'https://streaming.bitquery.io/graphql',
    { query, variables: { from: fromBlock, to: toBlock } },
    { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } }
  )

  const raw = (res.data?.data?.EVM?.Events ?? []) as Array<{
    Log:         { Signature: { Name: string } }
    Transaction: { Hash: string }
    Block:       { Number: number }
    Arguments:   Array<{ Name: string; Value: { address?: string; integer?: string } }>
  }>

  return raw.map((e) => ({
    type:         e.Log.Signature.Name as TokenEvent['type'],
    tokenAddress: e.Arguments.find((a) => a.Name === 'token')?.Value.address   ?? '',
    account:      e.Arguments.find((a) => a.Name === 'account')?.Value.address ?? '',
    amount:       BigInt(e.Arguments.find((a) => a.Name === 'amount')?.Value.integer ?? '0'),
    funds:        BigInt(e.Arguments.find((a) => a.Name === 'funds')?.Value.integer  ?? '0'),
    blockNumber:  e.Block.Number,
    txHash:       e.Transaction.Hash,
  }))
}

// ── SKILL 8: Tax token info ───────────────────────────────

export interface TaxInfo {
  feeRate:       bigint
  rateFounder:   bigint
  rateHolder:    bigint
  rateBurn:      bigint
  rateLiquidity: bigint
  minShare:      bigint
  founder:       string
}

export async function getTaxInfo(tokenAddress: string): Promise<TaxInfo> {
  const taxTokenAbi = [
    'function feeRate() view returns (uint256)',
    'function rateFounder() view returns (uint256)',
    'function rateHolder() view returns (uint256)',
    'function rateBurn() view returns (uint256)',
    'function rateLiquidity() view returns (uint256)',
    'function minShare() view returns (uint256)',
    'function founder() view returns (address)',
  ]
  const contract = new ethers.Contract(tokenAddress, taxTokenAbi, getProvider())

  // Cast through unknown to satisfy exactOptionalPropertyTypes
  const [feeRate, rateFounder, rateHolder, rateBurn, rateLiquidity, minShare, founder] =
    await Promise.all([
      (contract['feeRate']        as () => Promise<unknown>)() as Promise<bigint>,
      (contract['rateFounder']    as () => Promise<unknown>)() as Promise<bigint>,
      (contract['rateHolder']     as () => Promise<unknown>)() as Promise<bigint>,
      (contract['rateBurn']       as () => Promise<unknown>)() as Promise<bigint>,
      (contract['rateLiquidity']  as () => Promise<unknown>)() as Promise<bigint>,
      (contract['minShare']       as () => Promise<unknown>)() as Promise<bigint>,
      (contract['founder']        as () => Promise<unknown>)() as Promise<string>,
    ])

  return { feeRate, rateFounder, rateHolder, rateBurn, rateLiquidity, minShare, founder }
}

// ── SKILL 9: Send BNB / ERC20 ─────────────────────────────

export async function sendBnb(toAddress: string, amountWei: string): Promise<string> {
  const signer  = getSigner()
  const tx      = await signer.sendTransaction({ to: toAddress, value: BigInt(amountWei) })
  const receipt = await tx.wait()
  return receipt?.hash ?? ''
}

export async function sendErc20(
  tokenAddress: string,
  toAddress:    string,
  amountWei:    string
): Promise<string> {
  const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)']
  const contract = new ethers.Contract(tokenAddress, erc20Abi, getSigner())
  const tx       = await (contract['transfer'] as (
    to:     string,
    amount: bigint
  ) => Promise<ethers.ContractTransactionResponse>)(toAddress, BigInt(amountWei))
  const receipt  = await tx.wait()
  return receipt?.hash ?? ''
}

// ── SKILLS 10 & 11: EIP-8004 identity ────────────────────

export async function registerAgentIdentity(
  name:         string,
  imageUrl?:    string,
  description?: string
): Promise<{ tokenId: string; txHash: string }> {
  const registryAbi = [
    'function register(string calldata name, string calldata imageUrl, string calldata description) external returns (uint256 tokenId)',
  ]
  const contract = new ethers.Contract(EIP8004_REGISTRY, registryAbi, getSigner())
  const tx       = await (contract['register'] as (
    name:        string,
    imageUrl:    string,
    description: string
  ) => Promise<ethers.ContractTransactionResponse>)(
    name,
    imageUrl    ?? '',
    description ?? `Sixteen agent: ${name}`
  )
  const receipt = await tx.wait()
  if (!receipt) throw new Error('Register tx receipt is null')

  const tokenId = receipt.logs[0]?.topics[3] ?? '0'
  return { tokenId: BigInt(tokenId).toString(), txHash: receipt.hash }
}

export async function getAgentIdentityBalance(ownerAddress: string): Promise<number> {
  const registryAbi = ['function balanceOf(address owner) view returns (uint256)']
  const contract    = new ethers.Contract(EIP8004_REGISTRY, registryAbi, getProvider())
  const balance     = await (contract['balanceOf'] as (addr: string) => Promise<bigint>)(ownerAddress)
  return Number(balance)
}

// ── SKILL 12: Platform config ─────────────────────────────

export interface FourMemeConfig {
  tokenManager2Address: string
  supportedTokens:      Array<{ symbol: string; address: string }>
  buyFee:               string
  sellFee:              string
  maxRaising:           string
}

export async function getPlatformConfig(): Promise<FourMemeConfig> {
  const res = await axios.get(`${FOURMEME_BASE_URL}/v1/public/config`)
  return res.data.data as FourMemeConfig
}

// ── Token image upload ────────────────────────────────────

export async function uploadMemeImage(imageBuffer: Buffer, mimeType = 'image/jpeg'): Promise<string> {
  const accessToken = await getFourMemeAccessToken()

  // Dynamic import avoids the missing @types/form-data issue at compile time
  // Install: pnpm add form-data && pnpm add -D @types/form-data --filter @sixteen/blockchain
  const FormData = (await import('form-data')).default
  const form     = new FormData()
  form.append('file', imageBuffer, { filename: 'meme.jpg', contentType: mimeType })

  const res = await axios.post(`${FOURMEME_BASE_URL}/v1/private/token/upload`, form, {
    headers: {
      ...form.getHeaders(),
      'meme-web-access': accessToken,
    },
  })
  return res.data.data as string
}