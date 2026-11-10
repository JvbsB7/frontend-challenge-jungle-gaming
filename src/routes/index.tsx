import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { q } from '@/api/queries'
import { sessionStore } from '@/api/session-store'
import { PAGE_SIZE } from '@/components/catalog/catalog'
import { HomePage } from '@/components/home/home-page'
import { parseCatalogSearch, type CatalogSearch } from '@/lib/catalog-search'

export const Route = createFileRoute('/')({
  validateSearch: parseCatalogSearch,
  beforeLoad: ({ search, location }) => {
    // Favoritos exigem sessão.
    if (search.favorites && !sessionStore.get()) throw redirect({ to: '/entrar', search: { redirect: location.href } })
  },
  loaderDeps: ({ search }) => search,
  // Pré-carrega sem bloquear a navegação: a tela mostra skeletons enquanto isso.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(q.featured())
    void context.queryClient.prefetchQuery(q.nftList({ ...deps, page: deps.page ?? 1, pageSize: PAGE_SIZE }))
  },
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/' })

  const onChange = (patch: Partial<CatalogSearch>, options?: { keepPage?: boolean }) =>
    void navigate({
      search: (prev) => ({ ...prev, ...patch, ...(options?.keepPage ? {} : { page: undefined }) }),
      // Busca digitada não empilha uma entrada de histórico por tecla.
      replace: 'q' in patch && Object.keys(patch).length === 1,
      resetScroll: false,
    })

  return <HomePage search={search} onChange={onChange} />
}
