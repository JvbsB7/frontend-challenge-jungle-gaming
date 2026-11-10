import { expect, test, type Page } from '@playwright/test'
import { loginViaUi } from './helpers'

// Sem overflow horizontal nas larguras exigidas (390, 768 e 1440), públicas e privadas.

const WIDTHS = [390, 768, 1024, 1440]

async function noOverflow(page: Page, label: string) {
  await page.waitForLoadState('networkidle')
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  const width = page.viewportSize()!.width
  expect(scrollWidth, `overflow horizontal em ${label} (${width}px)`).toBeLessThanOrEqual(width)
}

for (const width of WIDTHS) {
  test(`sem overflow horizontal em ${width}px`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'larguras controladas manualmente no projeto desktop')
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/?mockReset=1&scenario=default')
    await page.locator('#catalogo article').first().waitFor()
    await page.evaluate(async () => {
      const { api } = await import('/src/api/endpoints.ts')
      await api.addToCart({ nftId: 'nft-001', editionId: 'e50', quantity: 2 })
    })
    for (const path of ['/', '/nft/nft-001', '/carrinho', '/entrar', '/cadastro', '/rota-inexistente']) {
      await page.goto(path)
      await noOverflow(page, path)
    }
    await loginViaUi(page, 'ana', '/pagamento')
    for (const path of ['/pagamento', '/perfil', '/carteiras', '/?favorites=true']) {
      await page.goto(path)
      await noOverflow(page, path)
    }
  })
}
