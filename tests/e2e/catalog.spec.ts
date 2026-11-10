import { expect, test, type Page } from '@playwright/test'

// Catálogo: estado na URL, filtros combinados, ordenação, paginação,
// histórico, skeletons, falha e recuperação. Cada teste parte de um mock resetado.

const catalog = (page: Page) => page.locator('#catalogo')
const cards = (page: Page) => catalog(page).locator('article')
const names = (page: Page) => cards(page).locator('h3').allInnerTexts()

async function open(page: Page, query = '') {
  await page.goto(`/?mockReset=1&scenario=default${query ? `&${query}` : ''}`)
  await expect(cards(page).first()).toBeVisible()
}

async function openFilters(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: /^Filtros/ }).click()
  return isMobile ? page.getByRole('dialog', { name: 'Filtros' }) : page.getByRole('complementary', { name: 'Filtros' })
}

test('filtros combinados, ordenação e paginação compõem a URL e voltam pelo histórico', async ({ page, isMobile }) => {
  await open(page)
  await expect(cards(page)).toHaveCount(9)

  const filters = await openFilters(page, isMobile)
  await filters.getByRole('button', { name: /Arte digital/ }).click()
  await filters.getByRole('button', { name: /Ethereum/ }).click()
  if (isMobile) await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/category=.*arte-digital/)
  await expect(page).toHaveURL(/network=.*ethereum/)

  await page.getByLabel('Ordenar por:').selectOption('price-desc')
  await expect(page).toHaveURL(/sort=price-desc/)
  // Espera a lista nova (durante a busca a anterior continua visível, esmaecida).
  await expect(catalog(page).locator('ul[aria-busy="false"]')).toBeVisible()
  const prices = async () => (await catalog(page).locator('article p span.text-brand').allInnerTexts()).map((v) => Number(v.replace(' ETH', '')))
  await expect.poll(async () => {
    const values = await prices()
    return values.length > 0 && values.every((v, i) => i === 0 || values[i - 1] >= v)
  }).toBe(true)

  // Sem filtros: paginação; mudar filtro volta para a página 1.
  await page.goto('/?scenario=default')
  await expect(cards(page).first()).toBeVisible()
  const page1 = await names(page)
  await page.getByRole('button', { name: 'Página 2' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect.poll(() => names(page)).not.toEqual(page1)
  const page2 = await names(page)
  await page.getByRole('tab', { name: 'Em alta' }).click()
  await expect(page).not.toHaveURL(/page=2/)

  await page.goBack()
  await expect(page).toHaveURL(/page=2/)
  await expect.poll(() => names(page)).toEqual(page2)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  await expect.poll(() => names(page)).toEqual(page2)
})

test('busca com resultado e sem resultado', async ({ page, isMobile }) => {
  await open(page)
  if (isMobile) {
    await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('baron')
  } else {
    await page.getByRole('button', { name: 'Buscar NFTs' }).click()
    await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('baron')
    await page.keyboard.press('Enter')
  }
  await expect(page).toHaveURL(/q=baron/)
  await expect.poll(async () => (await names(page)).every((n) => /baron/i.test(n))).toBe(true)

  await page.goto('/?q=nada-existe-aqui')
  await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
  await page.getByRole('button', { name: 'Limpar busca e filtros' }).click()
  await expect(cards(page)).toHaveCount(9)
})

test('skeleton durante carregamento lento', async ({ page }) => {
  await page.goto('/?mockReset=1&scenario=slow')
  await expect(catalog(page).locator('ul .skeleton').first()).toBeVisible()
  await expect(cards(page).first()).toBeVisible({ timeout: 15_000 })
  await expect(catalog(page).locator('ul .skeleton')).toHaveCount(0)
})

test('falha do catálogo mostra erro e recupera ao tentar novamente', async ({ page }) => {
  await page.goto('/?mockReset=1&scenario=catalog-error')
  await expect(page.getByText('Não foi possível carregar o catálogo.')).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => window.__kurio!.setScenario('default'))
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(cards(page).first()).toBeVisible()
})

test('respostas fora de ordem não sobrescrevem o filtro atual', async ({ page }) => {
  await page.goto('/?mockReset=1&scenario=jitter')
  await expect(cards(page).first()).toBeVisible({ timeout: 15_000 })
  for (const tab of ['Novos lançamentos', 'Em alta', 'Todos os NFTs', 'Em alta']) {
    await page.getByRole('tab', { name: tab }).click()
  }
  await expect(page).toHaveURL(/tab=trending/)
  // Resultado final precisa ser o da última aba, mesmo com latências diferentes.
  await page.waitForTimeout(2500)
  const shown = await names(page)
  const expected = await page.evaluate(async () => {
    const { api } = await import('/src/api/endpoints.ts')
    return (await api.listNfts({ tab: 'trending', page: 1, pageSize: 9 })).items.map((n) => n.name)
  })
  expect(shown).toEqual(expected)
})

test('rota inexistente mostra 404', async ({ page }) => {
  await page.goto('/rota/que/nao/existe')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})

test('sem overflow horizontal', async ({ page }) => {
  await open(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})

test('ações do card no hover (desktop): adicionar ao carrinho e ver detalhes', async ({ page, isMobile }) => {
  test.skip(isMobile, 'ações de hover existem só no desktop (Figma)')
  await open(page)
  const card = cards(page).first()
  await card.hover()
  await card.getByRole('button', { name: /Adicionar Emerald Ape #042/ }).click()
  await expect(page.getByText('Emerald Ape #042 adicionado ao carrinho.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Carrinho, 1 item/ })).toBeVisible()
  await card.getByRole('link', { name: 'Ver detalhes de Emerald Ape #042' }).click()
  await expect(page).toHaveURL(/\/nft\/nft-001/)
})

test('trocar de página leva ao topo da lista nova', async ({ page }) => {
  await open(page)
  const pagination = page.getByRole('navigation', { name: 'Paginação' })
  await pagination.scrollIntoViewIfNeeded()
  const page1 = await names(page)
  await pagination.getByRole('button', { name: 'Página 3' }).click()
  await expect.poll(() => names(page)).not.toEqual(page1)
  await expect(cards(page).first()).toBeInViewport()
  await expect(page.getByRole('heading', { name: 'Resultados' })).toBeFocused()
})
