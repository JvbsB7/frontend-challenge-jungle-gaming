import { expect, test } from '@playwright/test'
import { loginViaUi, logout } from './helpers'

// Conta e sessão: cadastro (validação e conflito), login com retorno ao fluxo,
// expiração da sessão, logout e troca de usuário sem vazar dados.

test.beforeEach(async ({ page }) => {
  await page.goto('/?mockReset=1&scenario=default')
  await page.locator('#catalogo article').first().waitFor()
})

test('cadastro: validação, conflito de e-mail e sucesso', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByRole('button', { name: /^Criar (perfil|conta)$/ }).click()
  const username = page.getByRole('textbox', { name: 'Nome de usuário' })
  await expect(username).toHaveAttribute('aria-invalid', 'true')
  await expect(username).toBeFocused()
  await expect(page.getByText('Informe um nome de usuário')).toBeVisible()

  await username.fill('nova.colecionadora')
  await page.getByRole('textbox', { name: 'E-mail' }).fill('ana@kurio.test')
  await page.getByLabel(/^Senha/).fill('abc')
  await page.getByLabel(/^Confirmar senha/).fill('abd')
  await page.getByRole('button', { name: /^Criar (perfil|conta)$/ }).click()
  await expect(page.getByText('Use pelo menos 8 caracteres')).toBeVisible()
  await expect(page.getByText('As senhas não conferem')).toBeVisible()

  await page.getByLabel(/^Senha/).fill('Segura123')
  await page.getByLabel(/^Confirmar senha/).fill('Segura123')
  await page.getByRole('button', { name: /^Criar (perfil|conta)$/ }).click()
  // Conflito vindo da API, associado ao campo.
  await expect(page.getByText('E-mail já cadastrado')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'E-mail' })).toHaveAttribute('aria-invalid', 'true')

  await page.getByRole('textbox', { name: 'E-mail' }).fill('nova@kurio.test')
  await page.getByRole('button', { name: /^Criar (perfil|conta)$/ }).click()
  await expect(page).toHaveURL(/\/$|\/\?/)
  await expect(page.getByText('Conta criada com sucesso!')).toBeVisible()
})

test('login: credenciais inválidas e retorno ao fluxo anterior', async ({ page }) => {
  await page.goto('/perfil')
  await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil/)
  await page.getByRole('textbox', { name: 'E-mail' }).fill('ana@kurio.test')
  await page.getByLabel(/^Senha/).fill('errada123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()

  await page.getByLabel(/^Senha/).fill('Kurio@123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/perfil$/)

  // Sessão sobrevive ao refresh.
  await page.reload()
  await expect(page).toHaveURL(/\/perfil$/)
})

test('sessão expirada em página privada volta ao login e retoma o contexto', async ({ page }) => {
  await loginViaUi(page, 'ana', '/perfil')
  await page.evaluate(() => window.__kurio!.expireSessions())
  // Qualquer chamada autenticada agora recebe 401 SESSION_EXPIRED.
  await page.evaluate(async () => (await import('/src/api/endpoints.ts')).api.profile().catch(() => null))
  await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil/)
  await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar.')).toBeVisible()

  await page.getByRole('textbox', { name: 'E-mail' }).fill('ana@kurio.test')
  await page.getByLabel(/^Senha/).fill('Kurio@123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/perfil$/)
})

test('logout e troca de usuário não exibem dados do anterior', async ({ page, isMobile }) => {
  await loginViaUi(page, 'ana')
  await page.goto('/?favorites=true')
  await expect(page.getByRole('heading', { name: 'Meus favoritos' })).toBeVisible()
  await expect(page.locator('#catalogo').getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()

  await logout(page, isMobile)
  await loginViaUi(page, 'bruno')
  await page.goto('/?favorites=true')
  await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
  await expect(page.locator('#catalogo').getByRole('heading', { name: 'Emerald Ape #042' })).toHaveCount(0)
})
