import { Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Catalog } from '@/components/catalog/catalog'
import type { CatalogSearch } from '@/lib/catalog-search'
import { Blog, Hero, Promos, Spotlight } from './sections'

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

export type CatalogChange = (patch: Partial<CatalogSearch>, options?: { keepPage?: boolean }) => void

/** Conteúdo da Início. Também aparece atrás do modal de login/cadastro no desktop (Figma). */
export function HomePage({ search, onChange }: { search: CatalogSearch; onChange: CatalogChange }) {
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
