import { expect, test, type Page } from '@playwright/test'

// Carrinho: quantidades, remoção, cupom, resumo da API, persistência após
// refresh/login e alteração de preço via Socket.IO com o carrinho aberto.

async function seedGuestCart(page: Page) {
  await page.goto('/?mockReset=1&scenario=default')
  await page.locator('#catalogo article').first().waitFor()
  await page.evaluate(async () => {
    const { api } = await import('/src/api/endpoints.ts')
    await api.addToCart({ nftId: 'nft-001', editionId: 'e50', quantity: 2 }) // 1.19
    await api.addToCart({ nftId: 'nft-005', editionId: 'e50', quantity: 1 }) // 1.39
  })
  await page.goto('/carrinho')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
}

const items = (page: Page) => page.getByRole('region', { name: 'Itens do carrinho' })
const summary = (page: Page) => page.locator('section[aria-labelledby="resumo-titulo"]')

test('quantidades, remoção com desfazer e resumo calculado pela API', async ({ page }) => {
  await seedGuestCart(page)
  await expect(summary(page).getByText('3.77 ETH')).toBeVisible() // subtotal 2.38 + 1.39
  await expect(summary(page).getByText('3.786 ETH')).toBeVisible() // + taxa 0.016

  await page.getByRole('button', { name: 'Aumentar quantidade de Violet Nomad #314' }).click()
  await expect(summary(page).getByText('5.16 ETH')).toBeVisible()

  await page.getByRole('button', { name: /Remover Violet Nomad #314/ }).click()
  await expect(items(page).getByRole('heading', { name: 'Violet Nomad #314' })).toHaveCount(0)
  await expect(summary(page).getByText('2.38 ETH').first()).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(items(page).getByRole('heading', { name: 'Violet Nomad #314' })).toBeVisible()
})

test('cupom inválido, expirado e válido (persiste após refresh)', async ({ page }) => {
  await seedGuestCart(page)
  const input = page.getByRole('textbox', { name: 'Código promocional' })
  await input.fill('NAOEXISTE')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Cupom inválido.' })).toBeVisible()
  await expect(input).toHaveAttribute('aria-invalid', 'true')

  await input.fill('VERAO2025')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Este cupom expirou.' })).toBeVisible()

  await input.fill('kurio10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(summary(page).getByText('(-) 0.377')).toBeVisible() // 10% de 3.77
  await expect(summary(page).getByText('3.409 ETH')).toBeVisible()

  await page.reload()
  await expect(summary(page).getByText('KURIO10')).toBeVisible()
  await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
  await expect(summary(page).getByText('3.786 ETH')).toBeVisible()
})

test('carrinho do visitante persiste após refresh e é preservado no login', async ({ page }) => {
  await seedGuestCart(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Violet Nomad #314' })).toBeVisible()
  await page.evaluate(async () => {
    const { api } = await import('/src/api/endpoints.ts')
    const { sessionStore } = await import('/src/api/session-store.ts')
    sessionStore.set(await api.login({ email: 'bruno@kurio.test', password: 'Kurio@123' }))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Violet Nomad #314' })).toBeVisible()
})

test('preço e disponibilidade mudam via Socket.IO com o carrinho aberto', async ({ page }) => {
  await seedGuestCart(page)
  await page.waitForFunction(() => (window.__kurio?.connectionCount() ?? 0) > 0)

  await page.evaluate(() => window.__kurio!.updateEdition('nft-001', 'e50', { price: '1.50' }))
  await expect(page.getByText(/preço alterado de 1.19 para 1.50 ETH/)).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Preço alterado' })).toBeVisible()
  await expect(summary(page).getByText('4.39 ETH')).toBeVisible() // 3.00 + 1.39

  await page.evaluate(() => window.__kurio!.updateEdition('nft-005', 'e50', { available: 0 }))
  await expect(page.getByText('Edição esgotada. Remova o item para continuar.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
})
