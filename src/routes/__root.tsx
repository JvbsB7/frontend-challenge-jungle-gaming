import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast, Toaster } from 'sonner'
import { sessionStore } from '@/api/session-store'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { MobileNav } from '@/components/mobile-nav'
import { Button } from '@/components/ui/button'

const PRIVATE_PATHS = ['/pagamento', '/perfil', '/carteiras', '/pedido']

/** Sessão expirada: avisa; em página privada, leva ao login e volta para o mesmo lugar. */
function useSessionExpiryRedirect() {
  const router = useRouter()
  useEffect(
    () =>
      sessionStore.subscribe((_session, reason) => {
        if (reason !== 'expired') return
        toast.warning('Sua sessão expirou. Entre novamente para continuar.', { id: 'session-expired' })
        const { pathname, href, search } = router.state.location
        const isPrivate = PRIVATE_PATHS.some((p) => pathname.startsWith(p)) || (search as { favorites?: boolean }).favorites
        if (isPrivate) void router.navigate({ to: '/entrar', search: { redirect: href } })
      }),
    [router],
  )
}

function Layout() {
  useSessionExpiryRedirect()
  return (
    <>
      <a href="#conteudo" className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-24 md:px-6 md:pb-6 xl:px-0">
        <Header />
        <main id="conteudo" tabIndex={-1} className="outline-none">
          <Outlet />
        </main>
        <Footer />
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
