import { expect, test, type Page } from '@playwright/test'
import { loginViaUi } from '../e2e/helpers'

// Regressão visual de Início, Detalhe, Carrinho e Pagamento (desktop e mobile).
// Dados estáveis: mock resetado, latência fixa, sem animações, toasts ocultos.
// Atualizar baselines: pnpm test:visual:update (revisar as imagens antes de commitar).

const HIDE_TRANSIENT = `
  [data-sonner-toaster] { display: none !important; }
  *, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }
`

/** Espera fontes e todas as imagens visíveis carregarem antes de capturar. */
async function settle(page: Page) {
  await page.addStyleTag({ content: HIDE_TRANSIENT })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => [...document.images].every((img) => img.loading === 'lazy' || (img.complete && img.naturalWidth > 0)))
  await page.waitForLoadState('networkidle')
}

async function seedCart(page: Page) {
  await page.evaluate(async () => {
    const { api } = await import('/src/api/endpoints.ts')
    await api.addToCart({ nftId: 'nft-001', editionId: 'e50', quantity: 2 })
    await api.addToCart({ nftId: 'nft-005', editionId: 'e50', quantity: 6 })
    await api.addToCart({ nftId: 'nft-003', editionId: 'e50', quantity: 1 })
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?mockReset=1&scenario=default')
  await expect(page.locator('#catalogo article').first()).toBeVisible()
})

test('início', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#catalogo article')).toHaveCount(9)
  await settle(page)
  await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
})

test('detalhe do NFT', async ({ page }) => {
  await page.goto('/nft/nft-001')
  await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mais desta coleção' })).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
})

test('carrinho', async ({ page }) => {
  await seedCart(page)
  await page.goto('/carrinho')
  await expect(page.getByText('Total', { exact: true }).last()).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
})

test('pagamento', async ({ page }) => {
  await seedCart(page)
  await loginViaUi(page, 'ana', '/pagamento')
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
})
