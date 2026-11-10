import { expect, test } from '@playwright/test'

// Detalhe do NFT: acesso direto, inexistente, edição esgotada, limite de quantidade,
// favoritos (com falha e rollback) e alteração em tempo real.

test('acesso direto, edição, limite de quantidade e compra', async ({ page, isMobile }) => {
  await page.goto('/nft/nft-001?mockReset=1&scenario=default')
  await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()

  // nft-002 tem a 1/1 esgotada nas fixtures: o rádio fica desabilitado.
  await page.goto('/nft/nft-002')
  await expect(page.getByRole('radio', { name: /^1\/1( |$)/ })).toBeDisabled()
  await page.getByRole('radio', { name: '1/10' }).click()
  await expect(page).toHaveURL(/edicao=e10/)

  const plus = page.getByRole('button', { name: 'Aumentar quantidade' }).filter({ visible: true })
  const text = await page.getByText(/disponível\(is\) nesta edição/).innerText()
  const max = Number(text.match(/máximo (\d+)/)![1])
  for (let i = 1; i < max; i++) await plus.click()
  await expect(plus).toBeDisabled()

  const buy = isMobile ? page.getByRole('button', { name: 'Comprar NFT' }) : page.getByRole('button', { name: 'COMPRAR' })
  await buy.click()
  await expect(page).toHaveURL(/\/carrinho/)
})

test('NFT inexistente mostra mensagem e caminho de volta', async ({ page }) => {
  await page.goto('/nft/nao-existe?mockReset=1')
  await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao mercado' }).click()
  await expect(page.locator('#catalogo article').first()).toBeVisible()
})

test('NFT totalmente esgotado bloqueia a compra', async ({ page, isMobile }) => {
  // nft-006 (índice 5): todas as edições esgotadas nas fixtures.
  await page.goto('/nft/nft-006?mockReset=1')
  await expect(page.getByText('Edição esgotada. Escolha outra edição.')).toBeVisible()
  const buy = isMobile ? page.getByRole('button', { name: 'Comprar NFT' }) : page.getByRole('button', { name: 'COMPRAR' })
  await expect(buy).toBeDisabled()
})

test('favoritar: exige login; com falha da API volta ao estado anterior', async ({ page, isMobile }) => {
  await page.goto('/nft/nft-003?mockReset=1&scenario=default')
  const fav = isMobile ? page.getByRole('button', { name: 'Favoritar Neon Vessel #552' }) : page.getByRole('button', { name: 'Favoritar', exact: true })
  await fav.click()
  await expect(page).toHaveURL(/\/entrar\?redirect=/)

  // Login pela API (a tela de login vem depois) e volta ao NFT.
  await page.evaluate(async () => {
    const { api } = await import('/src/api/endpoints.ts')
    const { sessionStore } = await import('/src/api/session-store.ts')
    sessionStore.set(await api.login({ email: 'bruno@kurio.test', password: 'Kurio@123' }))
  })
  await page.goto('/nft/nft-003')
  await fav.click()
  await expect(fav).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/adicionado aos favoritos/)).toBeVisible()

  await page.evaluate(() => window.__kurio!.setScenario('favorite-fail'))
  await fav.click()
  await expect(page.getByText(/Não foi possível remover dos favoritos/)).toBeVisible()
  await expect(fav).toHaveAttribute('aria-pressed', 'true') // rollback

  await page.reload()
  await expect(fav).toHaveAttribute('aria-pressed', 'true') // persistiu
})

test('preço muda em tempo real e a tela avisa', async ({ page }) => {
  await page.goto('/nft/nft-001?mockReset=1&scenario=default')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForFunction(() => (window.__kurio?.connectionCount() ?? 0) > 0)
  await page.evaluate(() => window.__kurio!.updateEdition('nft-001', 'e50', { price: '1.42' }))
  await expect(page.getByText('1.42 ETH').filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText(/preço alterado de 1.19 ETH para 1.42 ETH/)).toBeVisible()
})
