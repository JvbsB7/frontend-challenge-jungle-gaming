import { expect, test, type Page } from '@playwright/test'
import { loginViaUi } from './helpers'

// Pagamento e confirmação: compra completa, recusa, clique repetido, timeout com
// idempotência, mudança de preço via Socket.IO, cotação desatualizada no servidor,
// queda de conexão com pedido pendente e carteira recusando conexão.

async function seedAndOpenCheckout(page: Page, scenario = 'default') {
  await page.goto(`/?mockReset=1&scenario=${scenario}`)
  await page.locator('#catalogo article').first().waitFor()
  await page.evaluate(async () => {
    const { api } = await import('/src/api/endpoints.ts')
    await api.addToCart({ nftId: 'nft-001', editionId: 'e50', quantity: 2 })
    await api.addToCart({ nftId: 'nft-005', editionId: 'e50', quantity: 1 })
  })
  await loginViaUi(page, 'ana', '/pagamento')
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeVisible()
}

async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('dialog', { name: 'Revise seu pedido' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar e pagar' })).toBeEnabled()
}

const orderCount = (page: Page) =>
  page.evaluate(async () => (await (await import('/src/api/endpoints.ts')).api.orders()).length)

test('compra completa: do catálogo ao recibo confirmado', async ({ page, isMobile }) => {
  await page.goto('/nft/nft-001?mockReset=1&scenario=default')
  await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR' }).click()
  await expect(page).toHaveURL(/\/carrinho/)
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  // Exige login e volta ao pagamento.
  await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
  await page.getByRole('textbox', { name: 'E-mail' }).fill('ana@kurio.test')
  await page.getByLabel(/^Senha/).fill('Kurio@123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/pagamento$/)

  await openReview(page)
  await expect(page.getByRole('dialog').getByText('1.206 ETH')).toBeVisible() // 1.19 + taxa 0.016
  await page.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page.getByText('Aguardando confirmação na rede…')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  await expect(page.getByText('Emerald Ape #042')).toBeVisible()
  await expect(page.getByRole('link', { name: /Ver no Etherscan/ })).toHaveAttribute('href', /etherscan\.io\/tx\/0x[0-9a-f]{64}/)

  // Itens comprados saem do carrinho.
  await page.goto('/carrinho')
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
})

test('pagamento recusado mantém os itens no carrinho', async ({ page }) => {
  await seedAndOpenCheckout(page, 'payment-declined')
  await openReview(page)
  await page.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
  await page.getByRole('link', { name: 'Ver carrinho' }).click()
  await expect(page.getByRole('region', { name: 'Itens do carrinho' }).getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
})

test('clique repetido não duplica o pedido', async ({ page }) => {
  await seedAndOpenCheckout(page)
  await openReview(page)
  await page.getByRole('button', { name: 'Confirmar e pagar' }).dblclick()
  await expect(page.getByText(/Aguardando confirmação|Seus NFTs agora estão/)).toBeVisible()
  expect(await orderCount(page)).toBe(1)
})

test('timeout após criar o pedido: reenviar recupera o mesmo pedido', async ({ page }) => {
  test.setTimeout(60_000)
  await seedAndOpenCheckout(page, 'order-timeout')
  await openReview(page)
  await page.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page.getByText(/Não recebemos a confirmação do servidor/)).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByText(/Aguardando confirmação|Seus NFTs agora estão/)).toBeVisible()
  expect(await orderCount(page)).toBe(1)
})

test('preço muda via Socket.IO durante a revisão: exige nova confirmação', async ({ page }) => {
  await seedAndOpenCheckout(page)
  await openReview(page)
  await page.evaluate(() => window.__kurio!.updateEdition('nft-001', 'e50', { price: '1.30' }))
  const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(dialog.getByText('Os valores mudaram desde a sua revisão. Confira e confirme novamente.')).toBeVisible()
  await expect(dialog.getByText('2.60 ETH')).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirmar novos valores' }).click()
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  await expect(page.getByText('2.60 ETH')).toBeVisible() // recibo com o preço novo
})

test('servidor rejeita cotação desatualizada e o usuário confirma de novo', async ({ page }) => {
  await seedAndOpenCheckout(page, 'price-change-on-order')
  await openReview(page)
  await page.getByRole('button', { name: 'Confirmar e pagar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(dialog.getByText('Os valores mudaram. Revise e confirme novamente.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirmar novos valores' }).click()
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  expect(await orderCount(page)).toBe(1)
})

test('queda de conexão com pedido pendente: recarregar retoma sem nova compra (relógio controlado)', async ({ page }) => {
  // Liquidação em 60 s + relógio falso: o pedido fica pendente o tempo que o teste quiser.
  await page.clock.install()
  await seedAndOpenCheckout(page, 'slow-settlement')
  await openReview(page)
  await page.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page.getByText('Aguardando confirmação na rede…')).toBeVisible()

  await page.evaluate(() => window.__kurio!.dropConnections())
  await page.reload()
  // Depois do refresh o estado é recuperado: continua pendente, sem nova compra.
  await expect(page.getByText('Aguardando confirmação na rede…')).toBeVisible()
  expect(await orderCount(page)).toBe(1)

  await page.clock.fastForward('01:05') // passa do prazo de liquidação
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  expect(await orderCount(page)).toBe(1)
  // Pedido confirmado é terminal: reenviar evento antigo não volta para "pendente".
  await page.evaluate(() => window.__kurio!.replayEvent(1))
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
})

test('carteira recusa a conexão', async ({ page }) => {
  await seedAndOpenCheckout(page, 'wallet-refused')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByText(/Conexão recusada na carteira/)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
