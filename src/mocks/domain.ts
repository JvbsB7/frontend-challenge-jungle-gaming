import type {
  ApiErrorBody,
  Cart,
  CartItem,
  CreateOrderInput,
  Nft,
  NftListResponse,
  NftSummary,
  Quote,
  QuoteInput,
  Session,
  User,
} from '@/api/contracts'
import { CATEGORIES, GUEST_HEADER, NETWORKS, NFT_SORTS, NFT_TABS } from '@/api/contracts'
import { compareEth, isEth, mulEth, percentOf, subEth, sumEth } from '@/lib/eth'
import { commit, db, type OrderRecord, type UserRecord } from './db'
import { COUPONS, EXPLORERS, NETWORK_FEES } from './fixtures'
import { emitNftUpdated, emitOrderUpdated } from './realtime'
import { has, once } from './scenario'

export class HttpError extends Error {
  readonly status: number
  readonly body: ApiErrorBody
  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.status = status
    this.body = body
  }
}

const SESSION_TTL_MS = 30 * 60_000
const SHORT_SESSION_TTL_MS = 30_000
const SETTLE_AFTER_MS = 1500
const MAX_PER_LINE = 10

// ---------- Sessão ----------

export function publicUser({ salt: _s, passwordHash: _p, ...user }: UserRecord): User {
  return user
}

export function createSession(userId: string): Session {
  const s = db()
  const token = `tok_${crypto.randomUUID()}`
  const expiresAt = Date.now() + (has('short-session') ? SHORT_SESSION_TTL_MS : SESSION_TTL_MS)
  s.sessions = s.sessions.filter((x) => x.expiresAt > Date.now()) // não acumula sessões vencidas
  s.sessions.push({ token, userId, expiresAt })
  commit()
  const user = s.users.find((u) => u.id === userId)!
  return { token, expiresAt: new Date(expiresAt).toISOString(), user: publicUser(user) }
}

function bearer(request: Request): string | null {
  const header = request.headers.get('Authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

export function userForToken(token: string | null): UserRecord | null {
  if (!token) return null
  const session = db().sessions.find((x) => x.token === token)
  if (!session || session.expiresAt <= Date.now()) return null
  return db().users.find((u) => u.id === session.userId) ?? null
}

/** Usuário autenticado ou null; token inválido/expirado lança 401. */
export function optionalUser(request: Request): UserRecord | null {
  const token = bearer(request)
  if (!token) return null
  const session = db().sessions.find((x) => x.token === token)
  if (!session) throw new HttpError(401, { code: 'UNAUTHORIZED', message: 'Sessão inválida.' })
  if (session.expiresAt <= Date.now()) {
    throw new HttpError(401, { code: 'SESSION_EXPIRED', message: 'Sua sessão expirou. Entre novamente.' })
  }
  return db().users.find((u) => u.id === session.userId) ?? null
}

export function requireUser(request: Request): UserRecord {
  const user = optionalUser(request)
  if (!user) throw new HttpError(401, { code: 'UNAUTHORIZED', message: 'Entre para continuar.' })
  return user
}

export function revokeSession(request: Request): void {
  const token = bearer(request)
  const s = db()
  s.sessions = s.sessions.filter((x) => x.token !== token)
  commit()
}

export function expireAllSessions(): void {
  db().sessions.forEach((x) => (x.expiresAt = Date.now() - 1))
  commit()
}

// ---------- Catálogo ----------

export function toSummary(nft: Nft): NftSummary {
  const { id, name, image, price, compareAtPrice, category, network, rare, available, version } = nft
  return { id, name, image, price, compareAtPrice, category, network, rare, available, version }
}

export function findNft(id: string): Nft {
  const nft = db().nfts.find((n) => n.id === id)
  if (!nft) throw new HttpError(404, { code: 'NOT_FOUND', message: 'NFT não encontrado.' })
  return nft
}

function csv<T extends string>(value: string | null, allowed: readonly T[], field: string): T[] {
  if (!value) return []
  const items = value.split(',')
  const invalid = items.find((i) => !allowed.includes(i as T))
  if (invalid) throw new HttpError(400, { code: 'VALIDATION', message: `Filtro inválido: ${invalid}`, fields: { [field]: 'Valor inválido' } })
  return items as T[]
}

export function listNfts(url: URL, user: UserRecord | null): NftListResponse {
  const p = url.searchParams
  const favoritesOnly = p.get('favorites') === 'true'
  if (favoritesOnly && !user) throw new HttpError(401, { code: 'UNAUTHORIZED', message: 'Entre para ver seus favoritos.' })
  const favoriteIds = favoritesOnly ? (db().favorites[user!.id] ?? []) : null
  const q = (p.get('q') ?? '').trim().toLowerCase()
  const categories = csv(p.get('category'), CATEGORIES, 'category')
  const networks = csv(p.get('network'), NETWORKS, 'network')
  const tab = (p.get('tab') ?? 'all') as (typeof NFT_TABS)[number]
  const sort = (p.get('sort') ?? 'recent') as (typeof NFT_SORTS)[number]
  const minPrice = p.get('minPrice')
  const maxPrice = p.get('maxPrice')
  const page = Number(p.get('page') ?? '1')
  const pageSize = Number(p.get('pageSize') ?? '9')
  const fields: Record<string, string> = {}
  if (!NFT_TABS.includes(tab)) fields.tab = 'Aba inválida'
  if (!NFT_SORTS.includes(sort)) fields.sort = 'Ordenação inválida'
  if (minPrice && !isEth(minPrice)) fields.minPrice = 'Preço inválido'
  if (maxPrice && !isEth(maxPrice)) fields.maxPrice = 'Preço inválido'
  if (!Number.isInteger(page) || page < 1) fields.page = 'Página inválida'
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) fields.pageSize = 'Tamanho inválido'
  if (Object.keys(fields).length) throw new HttpError(400, { code: 'VALIDATION', message: 'Parâmetros inválidos.', fields })

  const all = has('empty-catalog') ? [] : db().nfts
  const newest = [...db().nfts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 15).map((n) => n.id)
  // Base para as contagens da sidebar: busca + aba + preço (sem os próprios filtros de faceta).
  const base = all.filter(
    (n) =>
      (!q || n.name.toLowerCase().includes(q) || n.collection.toLowerCase().includes(q)) &&
      (!favoriteIds || favoriteIds.includes(n.id)) &&
      (tab === 'all' || (tab === 'new' ? newest.includes(n.id) : n.reviewsCount >= 15)) &&
      (!minPrice || compareEth(n.price, minPrice) >= 0) &&
      (!maxPrice || compareEth(n.price, maxPrice) <= 0),
  )
  const filtered = base.filter(
    (n) => (!categories.length || categories.includes(n.category)) && (!networks.length || networks.includes(n.network)),
  )
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'price-asc') return compareEth(a.price, b.price) || a.id.localeCompare(b.id)
    if (sort === 'price-desc') return compareEth(b.price, a.price) || a.id.localeCompare(b.id)
    if (sort === 'name') return a.name.localeCompare(b.name, 'pt-BR')
    return b.createdAt.localeCompare(a.createdAt)
  })
  const count = <K extends string>(keys: readonly K[], pick: (n: Nft) => K) =>
    Object.fromEntries(keys.map((k) => [k, base.filter((n) => pick(n) === k).length])) as Record<K, number>
  const prices = all.map((n) => n.price).sort(compareEth)
  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
    page,
    pageSize,
    total: sorted.length,
    totalPages: Math.max(1, Math.ceil(sorted.length / pageSize)),
    facets: {
      category: count(CATEGORIES, (n) => n.category),
      network: count(NETWORKS, (n) => n.network),
      priceRange: { min: prices[0] ?? '0', max: prices.at(-1) ?? '0' },
    },
  }
}

/** Muda preço/estoque de uma edição e propaga via REST (estado) + Socket.IO (evento). */
export function updateEdition(nftId: string, editionId: string, patch: { price?: string; available?: number }): Nft {
  const nft = findNft(nftId)
  const edition = nft.editions.find((e) => e.id === editionId)
  if (!edition) throw new HttpError(404, { code: 'NOT_FOUND', message: 'Edição não encontrada.' })
  if (patch.price !== undefined) edition.price = patch.price
  if (patch.available !== undefined) edition.available = Math.max(0, patch.available)
  // Preço de vitrine = edição 1/50 (referência do layout).
  nft.price = nft.editions.find((e) => e.id === 'e50')?.price ?? nft.editions[0].price
  nft.available = nft.editions.reduce((n, e) => n + e.available, 0)
  nft.version += 1
  commit()
  emitNftUpdated(nft)
  return nft
}

// ---------- Carrinho ----------

export function cartKey(request: Request, user: UserRecord | null): string {
  if (user) return `user:${user.id}`
  const guest = request.headers.get(GUEST_HEADER)
  if (!guest) throw new HttpError(400, { code: 'VALIDATION', message: `Cabeçalho ${GUEST_HEADER} obrigatório para visitantes.` })
  return `guest:${guest}`
}

function edition(nftId: string, editionId: string) {
  const nft = findNft(nftId)
  const ed = nft.editions.find((e) => e.id === editionId)
  if (!ed) throw new HttpError(404, { code: 'NOT_FOUND', message: 'Edição não encontrada.' })
  return { nft, ed }
}

export function buildCart(key: string): Cart {
  const s = db()
  const items: CartItem[] = (s.carts[key] ?? []).map((line) => {
    const { nft, ed } = edition(line.nftId, line.editionId)
    return {
      ...line,
      name: nft.name,
      image: nft.image,
      tokenId: nft.tokenId,
      editionLabel: ed.label,
      unitPrice: ed.price,
      lineTotal: mulEth(ed.price, line.quantity),
      available: ed.available,
    }
  })
  return {
    items,
    subtotal: sumEth(items.map((i) => i.lineTotal)),
    count: items.reduce((n, i) => n + i.quantity, 0),
    version: s.cartVersions[key] ?? 0,
  }
}

function assertQuantity(quantity: unknown, available: number): number {
  if (!Number.isInteger(quantity) || (quantity as number) < 1) {
    throw new HttpError(400, { code: 'VALIDATION', message: 'Quantidade inválida.', fields: { quantity: 'Informe um número inteiro maior que zero' } })
  }
  const max = Math.min(available, MAX_PER_LINE)
  if ((quantity as number) > max) {
    throw new HttpError(409, {
      code: 'OUT_OF_STOCK',
      message: available === 0 ? 'Edição esgotada.' : `Só há ${max} unidade(s) disponível(is) para esta edição.`,
      details: { available: max },
    })
  }
  return quantity as number
}

function touchCart(key: string): void {
  const s = db()
  s.cartVersions[key] = (s.cartVersions[key] ?? 0) + 1
  commit()
}

export function addToCart(key: string, input: { nftId: string; editionId: string; quantity: number }): Cart {
  const { ed } = edition(input.nftId, input.editionId)
  assertQuantity(input.quantity, Number.MAX_SAFE_INTEGER) // inteiro ≥ 1 (o limite real vem abaixo)
  const lines = (db().carts[key] ??= [])
  const existing = lines.find((l) => l.nftId === input.nftId && l.editionId === input.editionId)
  const quantity = assertQuantity((existing?.quantity ?? 0) + input.quantity, ed.available)
  if (existing) existing.quantity = quantity
  else lines.push({ nftId: input.nftId, editionId: input.editionId, quantity })
  touchCart(key)
  return buildCart(key)
}

export function setCartQuantity(key: string, nftId: string, editionId: string, quantity: number): Cart {
  const line = db().carts[key]?.find((l) => l.nftId === nftId && l.editionId === editionId)
  if (!line) throw new HttpError(404, { code: 'NOT_FOUND', message: 'Item não está no carrinho.' })
  line.quantity = assertQuantity(quantity, edition(nftId, editionId).ed.available)
  touchCart(key)
  return buildCart(key)
}

export function removeFromCart(key: string, nftId: string, editionId: string): Cart {
  const s = db()
  s.carts[key] = (s.carts[key] ?? []).filter((l) => !(l.nftId === nftId && l.editionId === editionId))
  touchCart(key)
  return buildCart(key)
}

/** Junta o carrinho do visitante ao do usuário no login, limitado ao estoque. */
export function mergeGuestCart(guestId: string | null, userId: string): void {
  if (!guestId) return
  const s = db()
  const guestLines = s.carts[`guest:${guestId}`] ?? []
  if (!guestLines.length) return
  const userKey = `user:${userId}`
  const lines = (s.carts[userKey] ??= [])
  for (const g of guestLines) {
    const ed = s.nfts.find((n) => n.id === g.nftId)?.editions.find((e) => e.id === g.editionId)
    if (!ed) continue
    const existing = lines.find((l) => l.nftId === g.nftId && l.editionId === g.editionId)
    const quantity = Math.min((existing?.quantity ?? 0) + g.quantity, ed.available, MAX_PER_LINE)
    if (quantity < 1) continue
    if (existing) existing.quantity = quantity
    else lines.push({ ...g, quantity })
  }
  delete s.carts[`guest:${guestId}`]
  touchCart(userKey)
}

// ---------- Cotação ----------

function couponFor(code: unknown) {
  if (code === undefined || code === null || code === '') return undefined
  if (typeof code !== 'string') throw new HttpError(400, { code: 'VALIDATION', message: 'Cupom inválido.', fields: { couponCode: 'Cupom inválido' } })
  const normalized = code.trim().toUpperCase()
  const coupon = COUPONS[normalized]
  if (!coupon) throw new HttpError(422, { code: 'COUPON_INVALID', message: 'Cupom inválido.', fields: { couponCode: 'Cupom inválido' } })
  if (Date.parse(coupon.expiresAt) < Date.now()) {
    throw new HttpError(422, { code: 'COUPON_EXPIRED', message: 'Este cupom expirou.', fields: { couponCode: 'Cupom expirado' } })
  }
  return { code: normalized, percentOff: coupon.percentOff }
}

function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function computeQuote(key: string, input: QuoteInput): Quote {
  if (!NETWORKS.includes(input.network)) {
    throw new HttpError(400, { code: 'VALIDATION', message: 'Rede inválida.', fields: { network: 'Selecione uma rede' } })
  }
  const cart = buildCart(key)
  const coupon = couponFor(input.couponCode)
  const discount = coupon ? percentOf(cart.subtotal, coupon.percentOff) : '0.00'
  const networkFee = cart.items.length ? NETWORK_FEES[input.network] : '0.00'
  const total = sumEth([subEth(cart.subtotal, discount), networkFee])
  const issues = cart.items
    .filter((i) => i.quantity > i.available)
    .map((i) => ({ nftId: i.nftId, editionId: i.editionId, kind: i.available === 0 ? ('unavailable' as const) : ('insufficient' as const), available: i.available }))
  const quoteId = fnv1a(
    JSON.stringify([cart.items.map((i) => [i.nftId, i.editionId, i.quantity, i.unitPrice]), coupon?.code, input.network, total]),
  )
  return { quoteId, items: cart.items, network: input.network, subtotal: cart.subtotal, discount, networkFee, total, coupon, issues }
}

// ---------- Pedidos ----------

export function publicOrder({ userId: _u, idempotencyKey: _k, fingerprint: _f, settleAt: _s, outcome: _o, ...order }: OrderRecord) {
  return order
}

export function createOrder(user: UserRecord, idempotencyKey: string, input: CreateOrderInput): { order: OrderRecord; created: boolean } {
  const s = db()
  // Conteúdo normalizado: ordem de chaves e caixa do cupom não mudam o "mesmo pedido".
  const b = input.buyer ?? ({} as CreateOrderInput['buyer'])
  const fingerprint = fnv1a(
    JSON.stringify([
      input.quoteId,
      String(input.couponCode ?? '').trim().toUpperCase(),
      input.network,
      input.walletSlot,
      Object.keys(b).sort().map((k) => [k, b[k as keyof typeof b]]),
    ]),
  )
  const previous = s.orders.find((o) => o.userId === user.id && o.idempotencyKey === idempotencyKey)
  if (previous) {
    if (previous.fingerprint !== fingerprint) {
      throw new HttpError(409, { code: 'IDEMPOTENCY_CONFLICT', message: 'Esta chave de idempotência já foi usada com outro conteúdo.' })
    }
    return { order: previous, created: false }
  }

  // Um pedido por vez: outro pendente já reservou este carrinho (evita cobrar duas vezes).
  const pending = s.orders.find((o) => o.userId === user.id && o.status === 'pending')
  if (pending) {
    throw new HttpError(409, { code: 'CONFLICT', message: 'Você já tem um pedido em processamento. Aguarde a confirmação.', details: { orderId: pending.id } })
  }

  const key = `user:${user.id}`
  const wallet = s.wallets[user.id]?.find((w) => w.slot === input.walletSlot)
  if (!wallet) throw new HttpError(400, { code: 'VALIDATION', message: 'Carteira não cadastrada.', fields: { walletSlot: 'Cadastre a carteira antes de pagar' } })
  // A rede do pedido é a do endereço que paga (validado contra ela no handler).
  if (input.buyer?.network !== input.network) {
    throw new HttpError(422, { code: 'VALIDATION', message: 'A rede do pedido difere da rede da carteira.', fields: { network: 'Use a mesma rede da carteira' } })
  }

  // Cenários de mudança durante a compra: aplicados antes da revalidação.
  const firstLine = s.carts[key]?.[0]
  if (firstLine && once('price-change-on-order')) {
    const { ed } = edition(firstLine.nftId, firstLine.editionId)
    updateEdition(firstLine.nftId, firstLine.editionId, { price: percentOf(ed.price, 110) })
  }
  if (firstLine && once('sold-out-on-order')) updateEdition(firstLine.nftId, firstLine.editionId, { available: 0 })

  const quote = computeQuote(key, { couponCode: input.couponCode, network: input.network })
  if (!quote.items.length) throw new HttpError(400, { code: 'VALIDATION', message: 'Seu carrinho está vazio.' })
  if (quote.issues.length) {
    throw new HttpError(409, { code: 'OUT_OF_STOCK', message: 'Alguns itens não estão mais disponíveis na quantidade pedida.', details: { quote } })
  }
  if (quote.quoteId !== input.quoteId) {
    throw new HttpError(409, { code: 'QUOTE_OUTDATED', message: 'Os valores mudaram. Revise e confirme novamente.', details: { quote } })
  }

  // Reserva o estoque enquanto o pagamento está pendente.
  for (const item of quote.items) {
    const { ed } = edition(item.nftId, item.editionId)
    updateEdition(item.nftId, item.editionId, { available: ed.available - item.quantity })
  }

  const now = new Date().toISOString()
  const order: OrderRecord = {
    id: `ord_${crypto.randomUUID().slice(0, 8)}`,
    status: 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
    network: input.network,
    provider: input.buyer.provider,
    walletAddress: input.buyer.address,
    items: quote.items.map(({ nftId, editionId, name, image, tokenId, editionLabel, quantity, unitPrice, lineTotal }) => ({
      nftId, editionId, name, image, tokenId, editionLabel, quantity, unitPrice, lineTotal,
    })),
    subtotal: quote.subtotal,
    discount: quote.discount,
    networkFee: quote.networkFee,
    total: quote.total,
    coupon: quote.coupon,
    userId: user.id,
    idempotencyKey,
    fingerprint,
    settleAt: Date.now() + SETTLE_AFTER_MS,
    outcome: has('payment-declined') ? 'declined' : 'confirmed',
  }
  s.orders.push(order)
  commit()
  emitOrderUpdated(order)
  return { order, created: true }
}

export function findOrder(user: UserRecord, id: string): OrderRecord {
  const order = db().orders.find((o) => o.id === id)
  // Pedido de outro usuário responde 404 para não vazar existência.
  if (!order || order.userId !== user.id) throw new HttpError(404, { code: 'NOT_FOUND', message: 'Pedido não encontrado.' })
  return order
}

/** Liquida pedidos pendentes vencidos. Idempotente: pedidos terminais não mudam. */
export function settleDueOrders(now = Date.now()): void {
  const s = db()
  for (const order of s.orders) {
    if (order.status !== 'pending' || order.settleAt > now) continue
    order.status = order.outcome
    order.version += 1
    order.updatedAt = new Date(now).toISOString()
    if (order.outcome === 'confirmed') {
      order.txHash = `0x${Array.from({ length: 8 }, (_, i) => fnv1a(`${order.id}:${order.idempotencyKey}:${i}`)).join('')}`
      order.explorerUrl = `${EXPLORERS[order.network]}${order.txHash}`
      // Remove do carrinho apenas o que foi comprado.
      const key = `user:${order.userId}`
      s.carts[key] = (s.carts[key] ?? [])
        .map((line) => {
          const bought = order.items.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
          return bought ? { ...line, quantity: line.quantity - bought.quantity } : line
        })
        .filter((line) => line.quantity > 0)
      s.cartVersions[key] = (s.cartVersions[key] ?? 0) + 1
    } else {
      order.declineReason = 'Pagamento recusado pela carteira.'
      for (const item of order.items) {
        const ed = s.nfts.find((n) => n.id === item.nftId)?.editions.find((e) => e.id === item.editionId)
        if (ed) updateEdition(item.nftId, item.editionId, { available: ed.available + item.quantity })
      }
    }
    commit()
    emitOrderUpdated(order)
  }
}
