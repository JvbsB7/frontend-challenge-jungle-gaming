import { expect, test, type Page } from '@playwright/test'

// Carrossel do hero: troca automática (relógio controlado), pausa, arrastar e
// sem troca automática para quem prefere movimento reduzido.

// Desktop e mobile têm versões diferentes do hero; vale a visível.
const hero = (page: Page, _isMobile: boolean) => page.getByRole('region', { name: 'Destaques' }).filter({ visible: true }).first()
const activeDot = (page: Page, isMobile: boolean) => hero(page, isMobile).locator('button[aria-pressed="true"][aria-label^="Destaque"]')

async function open(page: Page) {
  await page.clock.install()
  await page.goto('/?mockReset=1&scenario=default')
  await page.locator('#catalogo article').first().waitFor()
}

test('troca sozinho a cada 6 s e pausa pelo botão', async ({ page, isMobile }) => {
  await open(page)
  await page.mouse.move(0, 0) // mouse fora do carrossel (hover pausa)
  await expect(activeDot(page, isMobile)).toHaveAccessibleName('Destaque 1 de 3')
  await page.clock.fastForward(6100)
  await expect(activeDot(page, isMobile)).toHaveAccessibleName('Destaque 2 de 3')

  await hero(page, isMobile).getByRole('button', { name: 'Pausar troca automática dos destaques' }).click()
  await page.mouse.move(0, 0)
  await page.clock.fastForward(20_000)
  await expect(activeDot(page, isMobile)).toHaveAccessibleName('Destaque 2 de 3')
  await expect(hero(page, isMobile).getByRole('button', { name: 'Retomar troca automática dos destaques' })).toBeVisible()
})

test('arrastar para o lado troca o destaque sem abrir o NFT', async ({ page, isMobile }) => {
  await open(page)
  const image = hero(page, isMobile).getByRole('img', { name: /ver detalhes/ })
  const box = (await image.boundingBox())!
  const y = box.y + box.height / 2
  // Arrasta da direita para a esquerda → próximo.
  await page.mouse.move(box.x + box.width - 10, y)
  await page.mouse.down()
  await page.mouse.move(box.x + 10, y, { steps: 8 })
  await page.mouse.up()
  await expect(activeDot(page, isMobile)).toHaveAccessibleName('Destaque 2 de 3')
  await expect(page).toHaveURL(/\/(\?|$)/) // não navegou para o NFT
  // Esquerda → direita volta.
  await page.mouse.move(box.x + 10, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 10, y, { steps: 8 })
  await page.mouse.up()
  await expect(activeDot(page, isMobile)).toHaveAccessibleName('Destaque 1 de 3')
})

test('movimento reduzido: não troca sozinho', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await page.mouse.move(0, 0)
  await page.clock.fastForward(20_000)
  await expect(activeDot(page, isMobile)).toHaveAccessibleName('Destaque 1 de 3')
  await expect(hero(page, isMobile).getByRole('button', { name: /troca automática/ })).toHaveCount(0)
})
