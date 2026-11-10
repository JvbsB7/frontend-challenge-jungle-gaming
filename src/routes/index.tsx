import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { q } from '@/api/queries'
import { sessionStore } from '@/api/session-store'
import { Catalog, PAGE_SIZE } from '@/components/catalog/catalog'
import { Blog, Hero, Promos, Spotlight } from '@/components/home/sections'
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

/** Busca do mobile ("Explorar coleções"), com atraso para não consultar a cada tecla. */
function MobileSearch({ value, onSearch }: { value?: string; onSearch: (q?: string) => void }) {
  const id = useId()
  const [text, setText] = useState(value ?? '')
  // URL mudou por fora (voltar no histórico, "limpar busca"): sincroniza o campo.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    if ((value ?? '') !== text.trim()) setText(value ?? '')
  }
  useEffect(() => {
    const trimmed = text.trim()
    if (trimmed === (value ?? '')) return
    const timer = setTimeout(() => onSearch(trimmed || undefined), 350)
    return () => clearTimeout(timer)
  }, [text, value, onSearch])

  return (
    <div role="search" className="flex gap-2 md:hidden">
      <label htmlFor={id} className="flex h-[45px] flex-1 items-center gap-2 rounded-[10px] bg-card px-3 focus-within:ring-3 focus-within:ring-ring/50">
        <Search className="size-[22px] shrink-0 text-primary" aria-hidden />
        <span className="sr-only">Buscar NFTs</span>
        <input
          id={id}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Explorar coleções"
          className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-subtle"
        />
      </label>
      <a
        href="#catalogo"
        aria-label="Ir para filtros do catálogo"
        className="grid size-[45px] place-items-center rounded-[14px] bg-gradient-to-br from-primary/45 to-primary focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <SlidersHorizontal className="size-[22px]" aria-hidden />
      </a>
    </div>
  )
}

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

  return (
    <>
      <MobileSearch value={search.q} onSearch={(value) => onChange({ q: value })} />
      {search.favorites ? (
        <h1 className="mt-10 mb-6 text-2xl font-bold">Meus favoritos</h1>
      ) : (
        <Hero />
      )}
      <div className="mt-6 md:mt-24">
        <Catalog search={search} onChange={onChange} aside={<Spotlight />} />
      </div>
      {!search.favorites && (
        <>
          <Promos />
          <Blog />
        </>
      )}
    </>
  )
}
