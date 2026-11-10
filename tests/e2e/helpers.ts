import { expect, type Page } from '@playwright/test'

export const USERS = {
  ana: { email: 'ana@kurio.test', password: 'Kurio@123', name: 'Ana Souza' },
  bruno: { email: 'bruno@kurio.test', password: 'Kurio@123', name: 'Bruno Lima' },
}

/** Login pela tela (mesmo fluxo do usuário). Espera voltar ao destino. */
export async function loginViaUi(page: Page, user: keyof typeof USERS, redirect = '/') {
  await page.goto(`/entrar?redirect=${encodeURIComponent(redirect)}`)
  await page.getByRole('textbox', { name: 'E-mail' }).fill(USERS[user].email)
  await page.getByLabel(/^Senha/).fill(USERS[user].password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).not.toHaveURL(/\/entrar/)
  // A URL muda antes de o formulário de login sair da tela: espera ele sumir.
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toHaveCount(0)
}

/** Sair: botão do cabeçalho no desktop; no mobile o botão fica no perfil. */
export async function logout(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.evaluate(async () => (await import('/src/lib/auth.ts')).logout())
  } else {
    await page.getByRole('banner').getByRole('button', { name: 'Sair' }).click()
  }
  await expect.poll(() => page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
}
