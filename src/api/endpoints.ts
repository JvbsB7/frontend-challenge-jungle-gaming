import { http } from './client'
import {
  IDEMPOTENCY_HEADER,
  type AvatarInput,
  type Cart,
  type CartLineInput,
  type CreateOrderInput,
  type FavoritesResponse,
  type FeaturedResponse,
  type LoginInput,
  type Nft,
  type NftListParams,
  type NftListResponse,
  type Order,
  type OrderStatus,
  type PasswordInput,
  type ProfileInput,
  type Quote,
  type QuoteInput,
  type RegisterInput,
  type Session,
  type User,
  type Wallet,
  type WalletInput,
  type WalletProvider,
  type WalletSlot,
} from './contracts'

// Uma função por operação REST. `signal` permite ao TanStack Query cancelar respostas obsoletas.
type Opts = { signal?: AbortSignal }

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

function listQuery(params: NftListParams): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) continue
    out[key] = Array.isArray(value) ? value.join(',') : String(value)
  }
  return out
}

export const api = {
  // Sessão e conta
  register: (input: RegisterInput) => data(http.post<Session>('/auth/register', input)),
  login: (input: LoginInput) => data(http.post<Session>('/auth/login', input)),
  session: (o?: Opts) => data(http.get<Session>('/auth/session', o)),
  logout: () => data(http.post<void>('/auth/logout')),

  // NFTs
  listNfts: (params: NftListParams, o?: Opts) => data(http.get<NftListResponse>('/nfts', { params: listQuery(params), ...o })),
  featured: (o?: Opts) => data(http.get<FeaturedResponse>('/nfts/featured', o)),
  nft: (id: string, o?: Opts) => data(http.get<Nft>(`/nfts/${encodeURIComponent(id)}`, o)),

  // Favoritos
  favorites: (o?: Opts) => data(http.get<FavoritesResponse>('/me/favorites', o)),
  addFavorite: (nftId: string) => data(http.put<FavoritesResponse>(`/me/favorites/${nftId}`)),
  removeFavorite: (nftId: string) => data(http.delete<FavoritesResponse>(`/me/favorites/${nftId}`)),

  // Carrinho
  cart: (o?: Opts) => data(http.get<Cart>('/cart', o)),
  addToCart: (line: CartLineInput) => data(http.post<Cart>('/cart/items', line)),
  setCartQuantity: (nftId: string, editionId: string, quantity: number) =>
    data(http.patch<Cart>(`/cart/items/${nftId}/${editionId}`, { quantity })),
  removeFromCart: (nftId: string, editionId: string) => data(http.delete<Cart>(`/cart/items/${nftId}/${editionId}`)),

  // Cotação
  quote: (input: QuoteInput, o?: Opts) => data(http.post<Quote>('/quote', input, o)),

  // Pedidos
  createOrder: (input: CreateOrderInput, idempotencyKey: string) =>
    data(http.post<Order>('/orders', input, { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } })),
  orders: (status?: OrderStatus, o?: Opts) => data(http.get<Order[]>('/orders', { params: status ? { status } : {}, ...o })),
  order: (id: string, o?: Opts) => data(http.get<Order>(`/orders/${encodeURIComponent(id)}`, o)),

  // Perfil
  profile: (o?: Opts) => data(http.get<User>('/me/profile', o)),
  updateProfile: (input: ProfileInput) => data(http.patch<User>('/me/profile', input)),
  updateAvatar: (input: AvatarInput) => data(http.put<User>('/me/avatar', input)),
  changePassword: (input: PasswordInput) => data(http.post<void>('/me/password', input)),

  // Carteiras
  wallets: (o?: Opts) => data(http.get<Wallet[]>('/me/wallets', o)),
  saveWallet: (slot: WalletSlot, input: WalletInput) => data(http.put<Wallet>(`/me/wallets/${slot}`, input)),
  connectWallet: (slot: WalletSlot) =>
    data(http.post<{ connected: true; address: string; provider: WalletProvider }>(`/me/wallets/${slot}/connect`)),
}
