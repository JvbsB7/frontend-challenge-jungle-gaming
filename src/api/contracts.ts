// Contratos REST + Socket.IO compartilhados entre cliente (src/api) e mocks (src/mocks).

/** Valor em ETH como string decimal (ex.: "1.19"). Nunca converter para number. */
export type Eth = string

export const CATEGORIES = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export type Category = (typeof CATEGORIES)[number]

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export type Network = (typeof NETWORKS)[number]

export const WALLET_PROVIDERS = ['metamask', 'walletconnect', 'coinbase'] as const
export type WalletProvider = (typeof WALLET_PROVIDERS)[number]

// ---------- Erros ----------

export type ApiErrorCode =
  | 'VALIDATION'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'OUT_OF_STOCK'
  | 'QUOTE_OUTDATED'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'TRANSIENT'

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  /** Erros por campo (nome do campo → mensagem). */
  fields?: Record<string, string>
  /** Dados extras, ex.: cotação atualizada em QUOTE_OUTDATED. */
  details?: unknown
}

// ---------- NFTs ----------

export interface Edition {
  id: string
  /** "1/1", "1/10", "1/50", "Aberta" */
  label: string
  /** null = edição aberta (sem limite de tiragem). */
  supply: number | null
  available: number
  price: Eth
}

export interface NftSummary {
  id: string
  name: string
  image: string
  price: Eth
  /** Preço anterior riscado (promoção). */
  compareAtPrice?: Eth
  category: Category
  network: Network
  rare: boolean
  available: number
  version: number
}

export interface Nft extends NftSummary {
  collection: string
  description: string
  images: string[]
  tokenId: string
  contract: string
  royaltyPercent: number
  attributes: string[]
  editions: Edition[]
  rating: number
  reviewsCount: number
  createdAt: string
}

export const NFT_SORTS = ['recent', 'price-asc', 'price-desc', 'name'] as const
export type NftSort = (typeof NFT_SORTS)[number]

export const NFT_TABS = ['all', 'new', 'trending'] as const
export type NftTab = (typeof NFT_TABS)[number]

export interface NftListParams {
  q?: string
  category?: Category[]
  network?: Network[]
  minPrice?: Eth
  maxPrice?: Eth
  tab?: NftTab
  sort?: NftSort
  page?: number
  pageSize?: number
}

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface NftListResponse extends Page<NftSummary> {
  facets: {
    category: Record<Category, number>
    network: Record<Network, number>
    priceRange: { min: Eth; max: Eth }
  }
}

export interface FeaturedResponse {
  hero: NftSummary[]
  spotlight: NftSummary
}

// ---------- Sessão e conta ----------

export interface User {
  id: string
  username: string
  displayName: string
  email: string
  ensName?: string
  walletNickname?: string
  avatarUrl?: string
}

export interface Session {
  token: string
  expiresAt: string
  user: User
}

export interface RegisterInput {
  username: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export type ProfileInput = Pick<User, 'displayName' | 'username' | 'email' | 'ensName' | 'walletNickname'>

export interface AvatarInput {
  /** data URL (image/png|jpeg|webp), máx. 1 MB. null remove o avatar. */
  dataUrl: string | null
}

export interface PasswordInput {
  currentPassword: string
  newPassword: string
}

// ---------- Favoritos ----------

export interface FavoritesResponse {
  nftIds: string[]
}

// ---------- Carrinho ----------

export interface CartLineInput {
  nftId: string
  editionId: string
  quantity: number
}

export interface CartItem extends CartLineInput {
  name: string
  image: string
  tokenId: string
  editionLabel: string
  unitPrice: Eth
  lineTotal: Eth
  /** Unidades disponíveis agora para esta edição. */
  available: number
}

export interface Cart {
  items: CartItem[]
  subtotal: Eth
  count: number
  version: number
}

// ---------- Cotação ----------

export interface QuoteInput {
  couponCode?: string
  network: Network
}

export interface Quote {
  /** Hash do conteúdo; o pedido só é aceito com o quoteId atual. */
  quoteId: string
  items: CartItem[]
  network: Network
  subtotal: Eth
  discount: Eth
  networkFee: Eth
  total: Eth
  coupon?: { code: string; percentOff: number }
  /** Linhas que não podem ser compradas na quantidade pedida. */
  issues: Array<{ nftId: string; editionId: string; kind: 'unavailable' | 'insufficient'; available: number }>
}

// ---------- Carteiras ----------

export type WalletSlot = 'primary' | 'secondary'

export interface WalletInput {
  displayName: string
  nickname?: string
  network: Network
  profileName: string
  address: string
  secondaryAddress?: string
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
}

export interface Wallet extends WalletInput {
  slot: WalletSlot
  updatedAt: string
}

// ---------- Pedidos ----------

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface BuyerInput {
  displayName: string
  username: string
  network: Network
  profileName: string
  address: string
  secondaryAddress?: string
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
  note?: string
}

export interface CreateOrderInput {
  quoteId: string
  couponCode?: string
  network: Network
  walletSlot: WalletSlot
  buyer: BuyerInput
}

export interface OrderLine {
  nftId: string
  editionId: string
  name: string
  image: string
  tokenId: string
  editionLabel: string
  quantity: number
  unitPrice: Eth
  lineTotal: Eth
}

/** Snapshot imutável: valores não mudam quando o catálogo muda. */
export interface Order {
  id: string
  status: OrderStatus
  version: number
  createdAt: string
  updatedAt: string
  network: Network
  provider: WalletProvider
  walletAddress: string
  items: OrderLine[]
  subtotal: Eth
  discount: Eth
  networkFee: Eth
  total: Eth
  coupon?: { code: string; percentOff: number }
  txHash?: string
  explorerUrl?: string
  declineReason?: string
}

// ---------- Eventos Socket.IO ----------

interface EventEnvelope<Type extends string, Resource extends string, Data> {
  /** Identidade estável: o mesmo evento reenviado mantém o mesmo id. */
  eventId: string
  type: Type
  resource: { type: Resource; id: string }
  /** Versão do recurso após a mudança; eventos com versão <= à conhecida são ignorados. */
  version: number
  occurredAt: string
  data: Data
}

export type NftUpdatedEvent = EventEnvelope<
  'nft.updated',
  'nft',
  Pick<Nft, 'price' | 'available' | 'editions'>
>

export type OrderUpdatedEvent = EventEnvelope<'order.updated', 'order', Order> & { userId: string }

export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
}

export const API_BASE = '/api'
export const GUEST_HEADER = 'X-Guest-Id'
export const IDEMPOTENCY_HEADER = 'Idempotency-Key'
