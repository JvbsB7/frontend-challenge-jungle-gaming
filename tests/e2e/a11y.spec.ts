import { expect, test } from '@playwright/test'

// Teclado e foco: link de pular conteúdo, diálogo com foco preso e retorno do foco,
// drawer de filtros e ativação de controles sem mouse.

test.beforeEach(async ({ page }) => {
  await page.goto('/?mockReset=1&scenario=default')
  await page.locator('#catalogo article').first().waitFor()
})

test('"Pular para o conteúdo" é o primeiro foco e leva ao conteúdo', async ({ page }) => {
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#conteudo/)
})

test('diálogo de zoom: abre pelo teclado, prende o foco e devolve ao fechar', async ({ page }) => {
  await page.goto('/nft/nft-001')
  const trigger = page.getByRole('button', { name: 'Ampliar imagem' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Emerald Ape #042' })
  await expect(dialog).toBeVisible()
  // Tab várias vezes: o foco não sai do diálogo.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('edição e quantidade operáveis pelo teclado', async ({ page, isMobile }) => {
  await page.goto('/nft/nft-001')
  const radio = page.getByRole('radio', { name: '1/10' })
  await radio.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/edicao=e10/)
  const plus = page.getByRole('button', { name: 'Aumentar quantidade' }).filter({ visible: true })
  await plus.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('output').filter({ visible: true }).first()).toHaveText('2')
  test.info().annotations.push({ type: 'perfil', description: isMobile ? 'mobile' : 'desktop' })
})

test('drawer de filtros (mobile): foco preso, Esc fecha e devolve o foco', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'no desktop os filtros ficam na sidebar')
  const open = page.getByRole('button', { name: /^Filtros/ })
  await open.focus()
  await page.keyboard.press('Enter')
  const drawer = page.getByRole('dialog', { name: 'Filtros' })
  await expect(drawer).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(open).toBeFocused()
})
