import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { useId, useRef } from 'react'
import { cn } from 'cn'
import { ApiError } from '@/api/client'
import { NFT_SORTS, NFT_TABS, type NftSummary } from '@/api/contracts'
import { q } from '@/api/queries'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { CatalogSearch } from '@/lib/catalog-search'
import { useFavoriteIds, useToggleFavorite } from '@/lib/favorites'
import { SORT_LABEL, TAB_LABEL } from '@/lib/labels'
import { Filters } from './filters'

export const PAGE_SIZE = 9

interface Props {
  search: CatalogSearch
  /** Atualiza a URL; mudanças de filtro reiniciam a paginação. */
  onChange: (patch: Partial<CatalogSearch>, options?: { keepPage?: boolean }) => void
  aside?: React.ReactNode
}

/** Páginas visíveis: primeira, última e vizinhas da atual, com "…" nos saltos (cabe em 390px). */
function pageWindow(page: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total))
  const sorted = [...pages].sort((a, b) => a - b)
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? (['gap', p] as const) : [p]))
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages = pageWindow(page, totalPages)
  const cell = 'grid size-[35px] place-items-center rounded-md text-sm font-bold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'
  return (
    <nav aria-label="Paginação" className="flex justify-center md:justify-end">
      <ul className="flex flex-wrap justify-center gap-2">
        <li>
          <button type="button" className={cn(cell, 'bg-card disabled:opacity-40')} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </li>
        {pages.map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} className="grid size-[35px] place-items-center text-sm text-muted-foreground" aria-hidden>
              …
            </li>
          ) : (
          <li key={p}>
            <button
              type="button"
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
              onClick={() => onPage(p)}
              className={cn(cell, p === page ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-surface')}
            >
              {p}
            </button>
          </li>
          ),
        )}
        <li>
          <button type="button" className={cn(cell, 'bg-card disabled:opacity-40')} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Próxima página">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </li>
      </ul>
    </nav>
  )
}

export function Catalog({ search, onChange, aside }: Props) {
  const sortId = useId()
  const resultsRef = useRef<HTMLHeadingElement>(null)
  const params = { ...search, page: search.page ?? 1, pageSize: PAGE_SIZE }
  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = useQuery(q.nftList(params))
  const favorites = useFavoriteIds()
  const toggleFavorite = useToggleFavorite()
  const onFavorite = (nft: NftSummary) => toggleFavorite(nft.id, nft.name, !favorites.has(nft.id))
  const tab = search.tab ?? 'all'
  const filterCount = (search.category?.length ?? 0) + (search.network?.length ?? 0) + (search.minPrice || search.maxPrice ? 1 : 0)

  const filters = <Filters search={search} facets={data?.facets} onChange={onChange} />

  return (
    <section id="catalogo" aria-labelledby="catalogo-titulo" className="grid scroll-mt-6 gap-12 lg:grid-cols-[310px_1fr]">
      <h2 id="catalogo-titulo" className="sr-only">
        Catálogo de NFTs
      </h2>
      <aside className="hidden flex-col gap-6 lg:flex" aria-label="Filtros">
        {filters}
        {aside}
      </aside>

      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div role="tablist" aria-label="Seções do catálogo" className="flex gap-4 overflow-x-auto md:gap-5">
            {NFT_TABS.map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => onChange({ tab: t === 'all' ? undefined : t })}
                className={cn(
                  'shrink-0 border-b-2 pb-1 text-sm leading-4 md:text-[15px]',
                  tab === t ? 'border-brand font-bold text-brand md:font-medium' : 'border-transparent text-foreground',
                )}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal data-icon="inline-start" aria-hidden />
                  Filtros{filterCount ? ` (${filterCount})` : ''}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                  <SheetDescription>Os resultados atualizam ao escolher cada filtro.</SheetDescription>
                </SheetHeader>
                {filters}
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
            <label htmlFor={sortId} className="text-sm whitespace-nowrap md:text-[15px]">
              Ordenar por:
            </label>
            <div className="relative">
              <select
                id={sortId}
                value={search.sort ?? 'recent'}
                onChange={(e) => onChange({ sort: e.target.value === 'recent' ? undefined : (e.target.value as CatalogSearch['sort']) })}
                className="h-9 appearance-none rounded-md bg-transparent pr-7 pl-1 text-sm md:text-[15px] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {NFT_SORTS.map((s) => (
                  <option key={s} value={s} className="bg-card">
                    {SORT_LABEL[s]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-1 size-4 -translate-y-1/2" aria-hidden />
            </div>
            </div>
          </div>
        </div>

        {search.q && (
          <p className="text-sm text-muted-foreground">
            Resultados para <strong className="text-foreground">“{search.q}”</strong>{' '}
            <button type="button" className="ml-2 text-brand underline" onClick={() => onChange({ q: undefined })}>
              limpar busca
            </button>
          </p>
        )}

        {/* Âncora de rolagem/foco ao trocar de página (abaixo do cabeçalho fixo da lista). */}
        <h3 ref={resultsRef} tabIndex={-1} className="sr-only scroll-mt-24 focus:outline-none">
          Resultados
        </h3>
        {/* Anúncio para leitores de tela quando a lista muda. */}
        <p className="sr-only" aria-live="polite">
          {isPending ? 'Carregando NFTs' : data ? `${data.total} NFTs encontrados, página ${data.page} de ${data.totalPages}` : ''}
        </p>

        {error && !data ? (
          <div role="alert" className="flex flex-col items-start gap-4 rounded-md bg-card p-6">
            <p className="font-bold">Não foi possível carregar o catálogo.</p>
            <p className="text-sm text-muted-foreground">{error instanceof ApiError ? error.message : 'Erro inesperado.'}</p>
            <Button onClick={() => void refetch()}>Tentar novamente</Button>
          </div>
        ) : isPending ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-[72px]" aria-busy="true">
            {Array.from({ length: PAGE_SIZE }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))}
          </ul>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-md bg-card p-6">
            <p className="font-bold">Nenhum NFT encontrado.</p>
            <p className="text-sm text-muted-foreground">Tente remover filtros ou buscar por outro termo.</p>
            <Button
              variant="outline"
              onClick={() => onChange({ q: undefined, category: undefined, network: undefined, minPrice: undefined, maxPrice: undefined, tab: undefined, favorites: undefined })}
            >
              Limpar busca e filtros
            </Button>
          </div>
        ) : (
          <ul
            className={cn(
              'grid grid-cols-2 gap-x-4 gap-y-6 pb-8 transition-opacity md:grid-cols-3 md:gap-x-6 md:gap-y-[72px] md:pb-0',
              // Mobile: colunas desencontradas como no Figma.
              '[&>li:nth-child(even)]:translate-y-8 md:[&>li:nth-child(even)]:translate-y-0',
              isFetching && isPlaceholderData && 'opacity-60',
            )}
            aria-busy={isFetching}
          >
            {data.items.map((nft, i) => (
              <li key={nft.id}>
                <NftCard nft={nft} favorite={favorites.has(nft.id)} onToggleFavorite={onFavorite} priority={i < 3} />
              </li>
            ))}
          </ul>
        )}

        {data && error && <p role="alert" className="text-sm text-destructive">Falha ao atualizar a lista. Exibindo os últimos resultados.</p>}
        {data && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPage={(page) => {
              onChange({ page: page > 1 ? page : undefined }, { keepPage: true })
              // Sem isso a tela fica na paginação (fim da lista) e só o último card da página nova aparece.
              const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
              resultsRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
              resultsRef.current?.focus({ preventScroll: true })
            }}
          />
        )}
      </div>
    </section>
  )
}
