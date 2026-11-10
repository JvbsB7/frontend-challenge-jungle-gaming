import type { QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import type { FeaturedResponse, Nft, NftListResponse, NftUpdatedEvent, Order, OrderUpdatedEvent, ServerToClientEvents } from './contracts'
import { keys, scope } from './queries'
import { SOCKET_URL } from './socket-url'

// Cliente Socket.IO: aplica eventos no cache do TanStack Query com proteção contra
// duplicatas (eventId) e eventos antigos (version), e reconcilia com REST ao reconectar.

export type RealtimeStatus = 'connecting' | 'online' | 'offline'

/** Avisos para a UI (região aria-live, toasts). */
export const realtimeBus = new EventTarget()
export type NftChangeDetail = { event: NftUpdatedEvent; previous?: Pick<Nft, 'price' | 'available'> }

const seenEvents = new Set<string>()
const versions = new Map<string, number>()

/** true se o evento é novo e mais recente que o estado conhecido. */
function accept(event: { eventId: string; resource: { type: string; id: string }; version: number }, cachedVersion?: number): boolean {
  if (seenEvents.has(event.eventId)) return false
  const key = `${event.resource.type}:${event.resource.id}`
  const known = Math.max(versions.get(key) ?? 0, cachedVersion ?? 0)
  if (event.version <= known) return false
  seenEvents.add(event.eventId)
  if (seenEvents.size > 500) seenEvents.delete(seenEvents.values().next().value!)
  versions.set(key, event.version)
  return true
}

function applyNft(client: QueryClient, event: NftUpdatedEvent): void {
  const id = event.resource.id
  const detail = client.getQueryData<Nft>(keys.nft(id))
  if (!accept(event, detail?.version)) return
  // Estado anterior para avisos ("preço mudou de X para Y"): detalhe ou qualquer lista em cache.
  const fromList = client
    .getQueriesData<NftListResponse>({ queryKey: [...keys.nfts, 'list'] })
    .flatMap(([, data]) => data?.items ?? [])
    .find((n) => n.id === id)
  const before = detail ?? fromList
  const patch = { ...event.data, version: event.version }
  client.setQueryData<Nft>(keys.nft(id), (old) => (old ? { ...old, ...patch } : old))
  client.setQueriesData<NftListResponse>({ queryKey: [...keys.nfts, 'list'] }, (old) =>
    old && { ...old, items: old.items.map((n) => (n.id === id ? { ...n, price: patch.price, available: patch.available, version: patch.version } : n)) },
  )
  client.setQueryData<FeaturedResponse>(keys.featured, (old) => {
    if (!old) return old
    const fix = <T extends { id: string }>(n: T) => (n.id === id ? { ...n, price: patch.price, available: patch.available, version: patch.version } : n)
    return { hero: old.hero.map(fix), spotlight: fix(old.spotlight) }
  })
  // Carrinho e cotação recalculam pela API (fonte da verdade dos valores).
  const s = scope()
  void client.invalidateQueries({ queryKey: keys.cart(s) })
  void client.invalidateQueries({ queryKey: [...keys.private(s), 'quote'] })
  realtimeBus.dispatchEvent(
    new CustomEvent<NftChangeDetail>('nft-change', { detail: { event, previous: before && { price: before.price, available: before.available } } }),
  )
}

function applyOrder(client: QueryClient, event: OrderUpdatedEvent, userId: string): void {
  // Defesa extra: nunca aplicar evento de outro usuário.
  if (event.userId !== userId) return
  const cached = client.getQueryData<Order>(keys.order(userId, event.resource.id))
  if (!accept(event, cached?.version)) return
  client.setQueryData<Order>(keys.order(userId, event.resource.id), event.data)
  void client.invalidateQueries({ queryKey: [...keys.private(userId), 'orders'] })
  if (event.data.status === 'confirmed') void client.invalidateQueries({ queryKey: keys.cart(userId) })
  realtimeBus.dispatchEvent(new CustomEvent<Order>('order-change', { detail: event.data }))
}

/**
 * Abre o socket da sessão atual. Retorna a função que libera listeners e conexão.
 * O socket.io-client é importado sob demanda: o engine.io-client guarda o WebSocket global
 * ao ser carregado, e com mocks ativos ele precisa enxergar o WebSocket do MSW.
 */
export function connectRealtime(client: QueryClient, session: { token: string; userId: string } | null): () => void {
  let socket: Socket<ServerToClientEvents> | undefined
  let disposed = false
  const status = (s: RealtimeStatus) => realtimeBus.dispatchEvent(new CustomEvent<RealtimeStatus>('status', { detail: s }))
  let connectedBefore = false

  status('connecting')
  void import('socket.io-client').then(({ io }) => {
    if (disposed) return
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: session ? { token: session.token } : {},
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    })
    socket.on('connect', () => {
      status('online')
      // Reconexão: eventos perdidos durante a queda são recuperados pela API REST.
      if (connectedBefore) void client.invalidateQueries({ refetchType: 'active' })
      connectedBefore = true
    })
    socket.on('disconnect', () => status('offline'))
    socket.on('nft.updated', (event) => applyNft(client, event))
    socket.on('order.updated', (event) => session && applyOrder(client, event, session.userId))
  })

  return () => {
    disposed = true
    socket?.removeAllListeners()
    socket?.disconnect()
  }
}
