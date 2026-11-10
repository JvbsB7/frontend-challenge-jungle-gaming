import { delay, http, HttpResponse } from 'msw'
import type {
  AvatarInput,
  CartLineInput,
  CreateOrderInput,
  FeaturedResponse,
  LoginInput,
  PasswordInput,
  ProfileInput,
  QuoteInput,
  RegisterInput,
  WalletInput,
  WalletSlot,
} from '@/api/contracts'
import { API_BASE, GUEST_HEADER, IDEMPOTENCY_HEADER, NETWORKS, WALLET_PROVIDERS } from '@/api/contracts'
import { commit, db, hashPassword, newSalt } from './db'
import {
  addToCart,
  buildCart,
  cartKey,
  computeQuote,
  createOrder,
  createSession,
  findNft,
  findOrder,
  HttpError,
  listNfts,
  mergeGuestCart,
  optionalUser,
  publicOrder,
  publicUser,
  removeFromCart,
  requireUser,
  revokeSession,
  setCartQuantity,
  settleDueOrders,
  toSummary,
} from './domain'
import { applyNetwork, errorResponse, has, orderTimeoutDelay } from './scenario'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'
interface Ctx {
  request: Request
  params: Record<string, string>
  url: URL
}

function route(method: Method, path: string, handler: (ctx: Ctx) => unknown, status = 200) {
  const routeKey = `${method.toUpperCase()} ${API_BASE}${path}`
  return http[method](`${API_BASE}${path}`, async ({ request, params }) => {
    const early = await applyNetwork(request, routeKey)
    if (early) return early
    try {
      settleDueOrders()
      const body = await handler({ request, params: params as Record<string, string>, url: new URL(request.url) })
      if (body instanceof Response) return body
      return body === undefined ? new HttpResponse(null, { status: 204 }) : HttpResponse.json(body as object, { status })
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error.status, error.body)
      console.error('[mock]', error)
      return errorResponse(500, { code: 'TRANSIENT', message: 'Erro inesperado no servidor simulado.' })
    }
  })
}

async function json<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new HttpError(400, { code: 'VALIDATION', message: 'Corpo da requisição inválido.' })
  }
}

// ---------- Validação ----------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME = /^[a-z0-9._]{3,24}$/i
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const ENS = /^[a-z0-9-]{3,63}$/

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function passwordError(password: unknown): string | undefined {
  const p = typeof password === 'string' ? password : ''
  if (p.length < 8) return 'Use pelo menos 8 caracteres'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use letras e números'
}

function fail(fields: Record<string, string | undefined>): void {
  const errors = Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) as Record<string, string>
  if (Object.keys(errors).length) throw new HttpError(422, { code: 'VALIDATION', message: 'Revise os campos destacados.', fields: errors })
}

function walletFieldErrors(input: Partial<WalletInput>) {
  const network = input.network
  const address = text(input.address)
  const addressOk = network === 'solana' ? SOLANA_ADDRESS.test(address) : EVM_ADDRESS.test(address)
  return {
    displayName: text(input.displayName) ? undefined : 'Informe o nome de exibição',
    network: network && NETWORKS.includes(network) ? undefined : 'Selecione uma rede',
    profileName: text(input.profileName) ? undefined : 'Informe o nome do perfil',
    address: !address ? 'Informe o endereço da carteira' : addressOk ? undefined : network === 'solana' ? 'Endereço Solana inválido' : 'Endereço 0x inválido (42 caracteres)',
    secondaryAddress:
      !text(input.secondaryAddress) || EVM_ADDRESS.test(text(input.secondaryAddress)) || ENS.test(text(input.secondaryAddress).replace(/\.eth$/, ''))
        ? undefined
        : 'Informe um ENS ou endereço válido',
    provider: input.provider && WALLET_PROVIDERS.includes(input.provider) ? undefined : 'Selecione uma carteira',
    referralCode: text(input.referralCode) ? undefined : 'Informe o código de indicação',
    email: EMAIL.test(text(input.email)) ? undefined : 'E-mail inválido',
    ensName: ENS.test(text(input.ensName).replace(/\.eth$/, '')) ? undefined : 'Nome ENS inválido',
  }
}

function assertUnique(field: 'email' | 'username', value: string, exceptUserId?: string): void {
  const taken = db().users.some((u) => u.id !== exceptUserId && u[field].toLowerCase() === value.toLowerCase())
  if (taken) {
    throw new HttpError(409, {
      code: 'CONFLICT',
      message: field === 'email' ? 'Este e-mail já está cadastrado.' : 'Este nome de usuário já está em uso.',
      fields: { [field]: field === 'email' ? 'E-mail já cadastrado' : 'Nome de usuário em uso' },
    })
  }
}

// ---------- Handlers ----------

export const httpHandlers = [
  // Sessão e conta
  route(
    'post',
    '/auth/register',
    async ({ request }) => {
      const input = await json<RegisterInput>(request)
      const username = text(input.username)
      const email = text(input.email).toLowerCase()
      fail({
        username: USERNAME.test(username) ? undefined : 'Use 3 a 24 letras, números, ponto ou _',
        email: EMAIL.test(email) ? undefined : 'E-mail inválido',
        password: passwordError(input.password),
      })
      assertUnique('email', email)
      assertUnique('username', username)
      const salt = newSalt()
      const user = { id: `user-${crypto.randomUUID().slice(0, 8)}`, username, displayName: username, email, salt, passwordHash: await hashPassword(input.password, salt) }
      db().users.push(user)
      commit()
      mergeGuestCart(request.headers.get(GUEST_HEADER), user.id)
      return createSession(user.id)
    },
    201,
  ),
  route('post', '/auth/login', async ({ request }) => {
    const input = await json<LoginInput>(request)
    const user = db().users.find((u) => u.email === text(input.email).toLowerCase())
    if (!user || (await hashPassword(String(input.password ?? ''), user.salt)) !== user.passwordHash) {
      throw new HttpError(401, { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' })
    }
    mergeGuestCart(request.headers.get(GUEST_HEADER), user.id)
    return createSession(user.id)
  }),
  route('get', '/auth/session', ({ request }) => {
    const user = requireUser(request)
    const token = request.headers.get('Authorization')!.slice(7)
    const session = db().sessions.find((s) => s.token === token)!
    return { token, expiresAt: new Date(session.expiresAt).toISOString(), user: publicUser(user) }
  }),
  route('post', '/auth/logout', ({ request }) => {
    revokeSession(request)
  }),

  // NFTs (featured antes de :id)
  route('get', '/nfts', ({ request, url }) => listNfts(url, optionalUser(request))),
  route('get', '/nfts/featured', (): FeaturedResponse => {
    const nfts = db().nfts
    return { hero: nfts.slice(0, 3).map(toSummary), spotlight: toSummary(nfts[1]) }
  }),
  route('get', '/nfts/:id', ({ params }) => findNft(params.id)),

  // Favoritos
  route('get', '/me/favorites', ({ request }) => ({ nftIds: db().favorites[requireUser(request).id] ?? [] })),
  route('put', '/me/favorites/:nftId', ({ request, params }) => {
    const user = requireUser(request)
    findNft(params.nftId)
    const list = (db().favorites[user.id] ??= [])
    if (!list.includes(params.nftId)) list.push(params.nftId)
    commit()
    return { nftIds: list }
  }),
  route('delete', '/me/favorites/:nftId', ({ request, params }) => {
    const user = requireUser(request)
    db().favorites[user.id] = (db().favorites[user.id] ?? []).filter((id) => id !== params.nftId)
    commit()
    return { nftIds: db().favorites[user.id] }
  }),

  // Carrinho (visitante via X-Guest-Id ou usuário autenticado)
  route('get', '/cart', ({ request }) => buildCart(cartKey(request, optionalUser(request)))),
  route('post', '/cart/items', async ({ request }) => {
    const key = cartKey(request, optionalUser(request))
    return addToCart(key, await json<CartLineInput>(request))
  }),
  route('patch', '/cart/items/:nftId/:editionId', async ({ request, params }) => {
    const key = cartKey(request, optionalUser(request))
    const { quantity } = await json<{ quantity: number }>(request)
    return setCartQuantity(key, params.nftId, params.editionId, quantity)
  }),
  route('delete', '/cart/items/:nftId/:editionId', ({ request, params }) =>
    removeFromCart(cartKey(request, optionalUser(request)), params.nftId, params.editionId),
  ),

  // Cotação
  route('post', '/quote', async ({ request }) => {
    const key = cartKey(request, optionalUser(request))
    return computeQuote(key, await json<QuoteInput>(request))
  }),

  // Pedidos
  route(
    'post',
    '/orders',
    async ({ request }) => {
      const user = requireUser(request)
      const key = request.headers.get(IDEMPOTENCY_HEADER)
      if (!key) throw new HttpError(400, { code: 'VALIDATION', message: `Cabeçalho ${IDEMPOTENCY_HEADER} obrigatório.` })
      const input = await json<CreateOrderInput>(request)
      const buyer = input.buyer ?? ({} as CreateOrderInput['buyer'])
      fail({
        ...walletFieldErrors(buyer),
        username: text(buyer.username) ? undefined : 'Informe o nome de usuário',
        walletSlot: input.walletSlot === 'primary' || input.walletSlot === 'secondary' ? undefined : 'Selecione a carteira',
      })
      const { order, created } = createOrder(user, key, input)
      // Cenário: o pedido existe, mas a resposta chega depois do timeout do cliente.
      if (created && has('order-timeout')) await delay(orderTimeoutDelay())
      return HttpResponse.json(publicOrder(order), { status: created ? 201 : 200 })
    },
  ),
  route('get', '/orders', ({ request, url }) => {
    const user = requireUser(request)
    const status = url.searchParams.get('status')
    return db()
      .orders.filter((o) => o.userId === user.id && (!status || o.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(publicOrder)
  }),
  route('get', '/orders/:id', ({ request, params }) => publicOrder(findOrder(requireUser(request), params.id))),

  // Perfil
  route('get', '/me/profile', ({ request }) => publicUser(requireUser(request))),
  route('patch', '/me/profile', async ({ request }) => {
    const user = requireUser(request)
    const input = await json<ProfileInput>(request)
    const username = text(input.username)
    const email = text(input.email).toLowerCase()
    const ensName = text(input.ensName).replace(/\.eth$/, '')
    fail({
      displayName: text(input.displayName) ? undefined : 'Informe o nome de exibição',
      username: USERNAME.test(username) ? undefined : 'Use 3 a 24 letras, números, ponto ou _',
      email: EMAIL.test(email) ? undefined : 'E-mail inválido',
      ensName: !ensName || ENS.test(ensName) ? undefined : 'Nome ENS inválido',
    })
    assertUnique('email', email, user.id)
    assertUnique('username', username, user.id)
    Object.assign(user, { displayName: text(input.displayName), username, email, ensName: ensName || undefined, walletNickname: text(input.walletNickname) || undefined })
    commit()
    return publicUser(user)
  }),
  route('put', '/me/avatar', async ({ request }) => {
    const user = requireUser(request)
    const { dataUrl } = await json<AvatarInput>(request)
    if (dataUrl !== null) {
      fail({
        avatar: !/^data:image\/(png|jpeg|webp);base64,/.test(String(dataUrl))
          ? 'Use uma imagem PNG, JPEG ou WebP'
          : String(dataUrl).length > 700_000
            ? 'A imagem deve ter no máximo 500 KB'
            : undefined,
      })
    }
    user.avatarUrl = dataUrl ?? undefined
    commit()
    return publicUser(user)
  }),
  route('post', '/me/password', async ({ request }) => {
    const user = requireUser(request)
    const input = await json<PasswordInput>(request)
    const currentOk = (await hashPassword(String(input.currentPassword ?? ''), user.salt)) === user.passwordHash
    fail({
      currentPassword: currentOk ? undefined : 'Senha atual incorreta',
      newPassword: passwordError(input.newPassword) ?? (input.newPassword === input.currentPassword ? 'A nova senha deve ser diferente da atual' : undefined),
    })
    user.salt = newSalt()
    user.passwordHash = await hashPassword(input.newPassword, user.salt)
    commit()
  }),

  // Carteiras
  route('get', '/me/wallets', ({ request }) => db().wallets[requireUser(request).id] ?? []),
  route('put', '/me/wallets/:slot', async ({ request, params }) => {
    const user = requireUser(request)
    const slot = params.slot as WalletSlot
    if (slot !== 'primary' && slot !== 'secondary') throw new HttpError(404, { code: 'NOT_FOUND', message: 'Carteira não encontrada.' })
    const wallets = (db().wallets[user.id] ??= [])
    if (slot === 'secondary' && !wallets.some((w) => w.slot === 'primary')) {
      throw new HttpError(409, { code: 'CONFLICT', message: 'Cadastre a carteira principal primeiro.' })
    }
    const input = await json<WalletInput>(request)
    fail(walletFieldErrors(input))
    const wallet = {
      slot,
      displayName: text(input.displayName),
      nickname: text(input.nickname) || undefined,
      network: input.network,
      profileName: text(input.profileName),
      address: text(input.address),
      secondaryAddress: text(input.secondaryAddress) || undefined,
      provider: input.provider,
      referralCode: text(input.referralCode),
      email: text(input.email).toLowerCase(),
      ensName: text(input.ensName).replace(/\.eth$/, ''),
      updatedAt: new Date().toISOString(),
    }
    db().wallets[user.id] = [...wallets.filter((w) => w.slot !== slot), wallet].sort((a) => (a.slot === 'primary' ? -1 : 1))
    commit()
    return wallet
  }),
  route('post', '/me/wallets/:slot/connect', ({ request, params }) => {
    const user = requireUser(request)
    const wallet = db().wallets[user.id]?.find((w) => w.slot === params.slot)
    if (!wallet) throw new HttpError(404, { code: 'NOT_FOUND', message: 'Carteira não encontrada.' })
    if (has('wallet-refused')) throw new HttpError(403, { code: 'FORBIDDEN', message: 'Conexão recusada na carteira.' })
    return { connected: true, address: wallet.address, provider: wallet.provider }
  }),

  // Rota desconhecida da API → 404 no contrato padrão (em vez de cair no index.html).
  route('get', '/*', () => {
    throw new HttpError(404, { code: 'NOT_FOUND', message: 'Recurso inexistente.' })
  }),
]
