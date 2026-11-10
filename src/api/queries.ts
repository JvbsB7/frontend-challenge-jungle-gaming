import { keepPreviousData, QueryClient, queryOptions } from '@tanstack/react-query'
import { ApiError } from './client'
import type { NftListParams, OrderStatus, QuoteInput } from './contracts'
import { api } from './endpoints'
import { guestId, sessionStore } from './session-store'

// Política de cache (documentada em ARCHITECTURE.md):
// - catálogo público: stale em 30 s; eventos nft.updated atualizam o cache direto;
// - dados privados ficam sob ['user', <escopo>] e são removidos no logout/troca de usuário;
// - retry automático só para falhas transitórias (rede, timeout, 5xx), até 2 vezes.
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => error instanceof ApiError && error.transient && failureCount < 2,
      },
      mutations: { retry: false },
    },
  })
}

/** Escopo dos dados privados: usuário logado ou visitante (carrinho). */
export function scope(): string {
  const session = sessionStore.get()
  return session ? session.userId : `guest:${guestId()}`
}

export const keys = {
  nfts: ['nfts'] as const,
  nftList: (params: NftListParams) => ['nfts', 'list', params] as const,
  nft: (id: string) => ['nfts', 'detail', id] as const,
  featured: ['nfts', 'featured'] as const,
  user: ['user'] as const,
  private: (s: string) => ['user', s] as const,
  cart: (s: string) => ['user', s, 'cart'] as const,
  quote: (s: string, input: QuoteInput) => ['user', s, 'quote', input] as const,
  favorites: (s: string) => ['user', s, 'favorites'] as const,
  profile: (s: string) => ['user', s, 'profile'] as const,
  wallets: (s: string) => ['user', s, 'wallets'] as const,
  orders: (s: string, status?: OrderStatus) => ['user', s, 'orders', { status }] as const,
  order: (s: string, id: string) => ['user', s, 'order', id] as const,
}

export const q = {
  nftList: (params: NftListParams) =>
    queryOptions({
      queryKey: keys.nftList(params),
      queryFn: ({ signal }) => api.listNfts(params, { signal }),
      placeholderData: keepPreviousData,
    }),
  nft: (id: string) =>
    queryOptions({
      queryKey: keys.nft(id),
      queryFn: ({ signal }) => api.nft(id, { signal }),
      retry: (n, e) => e instanceof ApiError && e.transient && n < 2,
    }),
  featured: () => queryOptions({ queryKey: keys.featured, queryFn: ({ signal }) => api.featured({ signal }) }),
  cart: () => {
    const s = scope()
    return queryOptions({ queryKey: keys.cart(s), queryFn: ({ signal }) => api.cart({ signal }), staleTime: 0 })
  },
  quote: (input: QuoteInput) => {
    const s = scope()
    return queryOptions({ queryKey: keys.quote(s, input), queryFn: ({ signal }) => api.quote(input, { signal }), staleTime: 0 })
  },
  favorites: () => {
    const s = scope()
    return queryOptions({ queryKey: keys.favorites(s), queryFn: ({ signal }) => api.favorites({ signal }) })
  },
  profile: () => {
    const s = scope()
    return queryOptions({ queryKey: keys.profile(s), queryFn: ({ signal }) => api.profile({ signal }) })
  },
  wallets: () => {
    const s = scope()
    return queryOptions({ queryKey: keys.wallets(s), queryFn: ({ signal }) => api.wallets({ signal }) })
  },
  orders: (status?: OrderStatus) => {
    const s = scope()
    return queryOptions({ queryKey: keys.orders(s, status), queryFn: ({ signal }) => api.orders(status, { signal }) })
  },
  order: (id: string) => {
    const s = scope()
    return queryOptions({ queryKey: keys.order(s, id), queryFn: ({ signal }) => api.order(id, { signal }) })
  },
}
