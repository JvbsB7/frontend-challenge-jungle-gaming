import { expect, test, type Page } from '@playwright/test'

// Testa contratos REST + Socket.IO usando os módulos reais da app (Axios, socket.io-client)
// contra o backend simulado (MSW), dentro do navegador.

async function boot(page: Page, scenario = 'default') {
  await page.goto(`/?mockReset=1&scenario=${scenario}`)
  await page.waitForFunction(() => window.__kurio !== undefined)
}

test('fluxo de compra: carrinho de visitante, cupom, idempotência e confirmação via socket', async ({ page }) => {
  await boot(page)
  const result = await page.evaluate(async () => {
    const { api } = await import('/src/api/endpoints.ts')
    const { sessionStore } = await import('/src/api/session-store.ts')
    const { realtimeBus } = await import('/src/api/realtime.ts')
    const { ApiError } = await import('/src/api/client.ts')
    const err = (p: Promise<unknown>) => p.then(() => null, (e: InstanceType<typeof ApiError>) => e.code)

    await api.addToCart({ nftId: 'nft-001', editionId: 'e50', quantity: 2 })
    const session = await api.login({ email: 'ana@kurio.test', password: 'Kurio@123' })
    sessionStore.set(session)
    const cart = await api.cart()

    const invalidCoupon = await err(api.quote({ network: 'ethereum', couponCode: 'NAOEXISTE' }))
    const expiredCoupon = await err(api.quote({ network: 'ethereum', couponCode: 'VERAO2025' }))
    const quote = await api.quote({ network: 'ethereum', couponCode: 'kurio10' })

    const buyer = {
      displayName: 'Ana Souza', username: 'ana.colecionadora', network: 'ethereum' as const, profileName: 'ana',
      address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', provider: 'metamask' as const,
      referralCode: 'KURIO-ANA', email: 'ana@kurio.test', ensName: 'anasouza',
    }
    const input = { quoteId: quote.quoteId, couponCode: 'kurio10', network: 'ethereum' as const, walletSlot: 'primary' as const, buyer }
    const confirmed = new Promise<string>((resolve) =>
      realtimeBus.addEventListener('order-change', (e) => {
        const order = (e as CustomEvent<{ status: string }>).detail
        if (order.status !== 'pending') resolve(order.status)
      }),
    )
    const order = await api.createOrder(input, 'key-1')
    const retry = await api.createOrder(input, 'key-1')
    const conflict = await err(api.createOrder({ ...input, network: 'polygon' }, 'key-1'))
    const finalStatus = await confirmed
    const receipt = await api.order(order.id)
    const cartAfter = await api.cart()
    return { cart, invalidCoupon, expiredCoupon, quote, order, retryId: retry.id, conflict, finalStatus, receipt, cartAfter }
  })

  expect(result.cart.items).toHaveLength(1)
  expect(result.cart.subtotal).toBe('2.38')
  expect(result.invalidCoupon).toBe('COUPON_INVALID')
  expect(result.expiredCoupon).toBe('COUPON_EXPIRED')
  expect(result.quote).toMatchObject({ subtotal: '2.38', discount: '0.238', networkFee: '0.016', total: '2.158' })
  expect(result.order.status).toBe('pending')
  expect(result.retryId).toBe(result.order.id)
  expect(result.conflict).toBe('IDEMPOTENCY_CONFLICT')
  expect(result.finalStatus).toBe('confirmed')
  expect(result.receipt.txHash).toMatch(/^0x[0-9a-f]{64}$/)
  expect(result.receipt.total).toBe('2.158')
  expect(result.cartAfter.items).toHaveLength(0)
})

test('nft.updated: aplica uma vez, ignora duplicata e evento antigo, reconecta', async ({ page }) => {
  await boot(page)
  const result = await page.evaluate(async () => {
    const { realtimeBus } = await import('/src/api/realtime.ts')
    const changes: number[] = []
    realtimeBus.addEventListener('nft-change', (e) => changes.push((e as CustomEvent<{ event: { version: number } }>).detail.event.version))
    const statuses: string[] = []
    realtimeBus.addEventListener('status', (e) => statuses.push((e as CustomEvent<string>).detail))
    const until = async (check: () => boolean) => {
      for (let i = 0; i < 50 && !check(); i++) await new Promise((r) => setTimeout(r, 100))
    }
    await until(() => window.__kurio!.connectionCount() > 0)

    window.__kurio!.updateEdition('nft-001', 'e50', { price: '1.25' })
    window.__kurio!.updateEdition('nft-001', 'e50', { price: '1.30' })
    await until(() => changes.length >= 2)
    window.__kurio!.replayEvent(0) // duplicata (mesmo eventId)
    window.__kurio!.replayEvent(1) // evento antigo (versão menor)
    await new Promise((r) => setTimeout(r, 300))

    window.__kurio!.dropConnections()
    await until(() => statuses.filter((s) => s === 'online').length >= 1 && statuses.at(-1) === 'online')
    return { changes, statuses }
  })

  expect(result.changes).toEqual([2, 3])
  expect(result.statuses).toContain('offline')
  expect(result.statuses.at(-1)).toBe('online')
})

test('pedido de outro usuário não é visível nem chega pelo socket', async ({ page }) => {
  await boot(page)
  const result = await page.evaluate(async () => {
    const { api } = await import('/src/api/endpoints.ts')
    const { sessionStore } = await import('/src/api/session-store.ts')
    const { ApiError } = await import('/src/api/client.ts')
    const bruno = await api.login({ email: 'bruno@kurio.test', password: 'Kurio@123' })
    sessionStore.set(bruno)
    const anaOrders = await api.orders().catch((e: InstanceType<typeof ApiError>) => e.code)
    const missing = await api.order('ord_inexistente').catch((e: InstanceType<typeof ApiError>) => e.code)
    window.__kurio!.expireSessions()
    const expired = await api.profile().catch((e: InstanceType<typeof ApiError>) => e.code)
    return { anaOrders, missing, expired, sessionAfter: sessionStore.get() }
  })
  expect(result.anaOrders).toEqual([])
  expect(result.missing).toBe('NOT_FOUND')
  expect(result.expired).toBe('SESSION_EXPIRED')
  expect(result.sessionAfter).toBeNull()
})
