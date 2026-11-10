import { expect, test } from '@playwright/test'
import { loginViaUi, logout } from './helpers'

// Perfil (dados, avatar, senha) e Carteiras (principal e secundária), com erros de
// validação do cliente e da API; alterações confirmadas persistem após refresh.

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test.beforeEach(async ({ page }) => {
  await page.goto('/?mockReset=1&scenario=default')
  await page.locator('#catalogo article').first().waitFor()
})

test('perfil: validação, conflito, sucesso e persistência', async ({ page }) => {
  await loginViaUi(page, 'ana', '/perfil')
  const email = page.getByRole('textbox', { name: /^E-mail/ })
  await email.fill('email-invalido')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('E-mail inválido')).toBeVisible()
  await expect(email).toBeFocused()

  // Conflito vindo da API (nome de usuário do Bruno).
  await email.fill('ana@kurio.test')
  await page.getByRole('textbox', { name: /^Nome de usuário/ }).fill('bruno.nft')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Nome de usuário em uso')).toBeVisible()

  await page.getByRole('textbox', { name: /^Nome de usuário/ }).fill('ana.souza')
  await page.getByRole('textbox', { name: /^Nome de exibição/ }).fill('Ana S.')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Perfil atualizado.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: /^Nome de exibição/ })).toHaveValue('Ana S.')
  await expect(page.getByRole('textbox', { name: /^Nome de usuário/ })).toHaveValue('ana.souza')
})

test('avatar: tipo inválido, envio e remoção', async ({ page }) => {
  await loginViaUi(page, 'ana', '/perfil')
  const file = page.locator('input[type="file"]')
  await file.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
  await expect(page.getByText('Use uma imagem PNG, JPEG ou WebP')).toBeVisible()

  await file.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1PX })
  await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()

  await page.getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByText('Avatar removido.')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Seu avatar' })).toHaveCount(0)
})

test('senha: atual incorreta, sucesso e login com a nova', async ({ page, isMobile }) => {
  await loginViaUi(page, 'ana', '/perfil')
  await page.getByLabel(/^Senha atual/).fill('errada123')
  await page.getByLabel(/^Nova senha/).fill('NovaSenha1')
  await page.getByLabel(/^Confirmar nova senha/).fill('NovaSenha1')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Senha atual incorreta')).toBeVisible()

  await page.getByLabel(/^Senha atual/).fill('Kurio@123')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Perfil e senha atualizados.')).toBeVisible()

  await logout(page, isMobile)
  await page.goto('/entrar')
  await page.getByRole('textbox', { name: 'E-mail' }).fill('ana@kurio.test')
  await page.getByLabel(/^Senha/).fill('NovaSenha1')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).not.toHaveURL(/\/entrar/)
})

test('carteiras: validação, principal, secundária igual à principal e uso no pagamento', async ({ page }) => {
  await loginViaUi(page, 'bruno', '/carteiras')
  const primary = page.getByRole('region', { name: 'Carteira principal' })
  await primary.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(primary.getByText('Informe o nome de exibição')).toBeVisible()
  await expect(primary.getByRole('textbox', { name: /^Nome de exibição/ })).toBeFocused()

  await primary.getByRole('textbox', { name: /^Nome de exibição/ }).fill('Bruno Lima')
  await primary.getByRole('textbox', { name: /^Apelido da carteira/ }).fill('Carteira do Bruno')
  await primary.getByRole('combobox', { name: /^Rede/ }).selectOption('polygon')
  await primary.getByRole('textbox', { name: /^Nome do perfil/ }).fill('bruno.nft')
  await primary.getByRole('textbox', { name: /^Endereço da carteira/ }).fill('0x123')
  await primary.getByRole('combobox', { name: /^Tipo de carteira/ }).selectOption('coinbase')
  await primary.getByRole('textbox', { name: /^Código de indicação/ }).fill('KURIO-BRUNO')
  await primary.getByRole('textbox', { name: /^E-mail/ }).fill('bruno@kurio.test')
  await primary.getByRole('textbox', { name: /^Nome ENS/ }).fill('brunolima')
  await primary.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(primary.getByText('Endereço 0x inválido (42 caracteres)')).toBeVisible()

  await primary.getByRole('textbox', { name: /^Endereço da carteira/ }).fill('0x1111111111111111111111111111111111111111')
  await primary.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(page.getByText('Carteira principal salva.')).toBeVisible()

  const secondary = page.getByRole('region', { name: 'Carteira secundária' })
  await secondary.getByText('Igual à carteira principal').click()
  await expect(secondary.getByRole('textbox', { name: /^Apelido da carteira/ })).toHaveValue('Carteira do Bruno')
  await secondary.getByRole('textbox', { name: /^Apelido da carteira/ }).fill('Reserva do Bruno')
  await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(page.getByText('Carteira secundária salva.')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('region', { name: 'Carteira secundária' }).getByRole('textbox', { name: /^Apelido da carteira/ })).toHaveValue('Reserva do Bruno')

  // As carteiras cadastradas passam a valer no pagamento.
  await page.evaluate(async () => (await import('/src/api/endpoints.ts')).api.addToCart({ nftId: 'nft-001', editionId: 'e50', quantity: 1 }))
  await page.goto('/pagamento')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('dialog', { name: 'Revise seu pedido' })).toContainText('rede Polygon')
})
