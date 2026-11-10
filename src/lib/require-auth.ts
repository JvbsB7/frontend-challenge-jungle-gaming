import { redirect } from '@tanstack/react-router'
import { sessionStore } from '@/api/session-store'

/** Rotas que exigem sessão (mesmas que usam requireAuth). */
export const PRIVATE_PATHS = ['/pagamento', '/perfil', '/carteiras', '/pedido']

export const isPrivatePath = (href: string) => PRIVATE_PATHS.some((p) => href.startsWith(p)) || /[?&]favorites=true/.test(href)

/** beforeLoad das rotas privadas: sem sessão, vai ao login e volta para cá depois. */
export function requireAuth({ location }: { location: { href: string } }) {
  if (!sessionStore.get()) throw redirect({ to: '/entrar', search: { redirect: location.href } })
}

/** ?redirect= do login/cadastro: só caminhos internos (evita open redirect). */
export function parseRedirect(raw: Record<string, unknown>): { redirect?: string } {
  const value = raw.redirect
  return { redirect: typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/entrar') && !value.startsWith('/cadastro') ? value : undefined }
}

/** Já logado em /entrar ou /cadastro: segue direto para o destino. */
export function redirectIfAuthenticated({ search }: { search: { redirect?: string } }) {
  if (sessionStore.get()) throw redirect({ to: search.redirect ?? '/' })
}
