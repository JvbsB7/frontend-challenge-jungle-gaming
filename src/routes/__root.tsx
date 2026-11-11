import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, useLocation, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast, Toaster } from 'sonner'
import { sessionStore } from '@/api/session-store'
import { isPrivatePath } from '@/lib/require-auth'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { MobileNav } from '@/components/mobile-nav'
import { Button } from '@/components/ui/button'

/** Sessão expirada: avisa; em página privada, leva ao login e volta para o mesmo lugar. */
function useSessionExpiryRedirect() {
  const router = useRouter()
  useEffect(
    () =>
      sessionStore.subscribe((_session, reason) => {
        const { href } = router.state.location
        // Sair numa página privada: vai para a Início (a página deixaria de ter dados).
        if (reason === 'logout' && isPrivatePath(href)) return void router.navigate({ to: '/' })
        if (reason !== 'expired') return
        toast.warning('Sua sessão expirou. Entre novamente para continuar.', { id: 'session-expired' })
        if (isPrivatePath(href)) void router.navigate({ to: '/entrar', search: { redirect: href } })
      }),
    [router],
  )
}

// Telas de conta não têm rodapé no Figma; a confirmação de pedido não tem cabeçalho nem rodapé.
const NO_FOOTER = ['/perfil', '/carteiras']
const isReceipt = (pathname: string) => pathname.startsWith('/pedido/')

function Layout() {
  useSessionExpiryRedirect()
  const { pathname } = useLocation()
  return (
    <>
      <a href="#conteudo" className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-24 md:px-6 md:pb-6 xl:px-0">
        {!isReceipt(pathname) && <Header />}
        <main id="conteudo" tabIndex={-1} className="outline-none">
          <Outlet />
        </main>
        {!NO_FOOTER.includes(pathname) && !isReceipt(pathname) && (
          // Login e Cadastro no mobile são telas cheias, sem rodapé (Figma).
          <div className={['/entrar', '/cadastro'].includes(pathname) ? 'max-md:hidden' : undefined}>
            <Footer />
          </div>
        )}
      </div>
      <MobileNav />
      <Toaster
        theme="dark"
        position="top-center"
        // Abaixo do cabeçalho: não cobre voltar/favoritar (mobile) nem a navegação (desktop).
        offset={{ top: 80 }}
        mobileOffset={{ top: 64 }}
        toastOptions={{ classNames: { toast: '!bg-card !text-foreground !border-border !font-sans' } }}
      />
    </>
  )
}

function NotFound() {
  return (
    <section className="flex flex-col items-center gap-6 py-24 text-center">
      <p className="text-6xl font-bold text-brand">404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="max-w-md text-muted-foreground">O endereço acessado não existe ou foi removido.</p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </section>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Layout,
  notFoundComponent: NotFound,
})
