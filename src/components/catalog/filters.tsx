import { useState } from 'react'
import { cn } from 'cn'
import { CATEGORIES, NETWORKS, type NftListResponse } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import type { CatalogSearch } from '@/lib/catalog-search'
import { CATEGORY_LABEL, NETWORK_LABEL } from '@/lib/labels'

type Facets = NftListResponse['facets']

interface Props {
  search: CatalogSearch
  facets?: Facets
  onChange: (patch: Partial<CatalogSearch>) => void
}

function toggle<T>(list: T[] | undefined, value: T): T[] | undefined {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value]
  return next.length ? next : undefined
}

// Formatação brasileira só para exibição; o valor enviado à API é decimal com ponto.
const br = (value: number) => value.toFixed(2).replace('.', ',')

function OptionList<T extends string>({
  title,
  options,
  labels,
  selected,
  counts,
  onToggle,
}: {
  title: string
  options: readonly T[]
  labels: Record<T, string>
  selected?: T[]
  counts?: Record<T, number>
  onToggle: (value: T) => void
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg leading-4 font-bold">{title}</legend>
      <ul className="px-3">
        {options.map((value) => {
          const active = selected?.includes(value) ?? false
          return (
            <li key={value}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(value)}
                className={cn(
                  'flex w-full items-center justify-between rounded-sm text-[15px] leading-10 hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  active ? 'text-brand' : 'text-muted-foreground',
                )}
              >
                <span className={cn(active && 'underline underline-offset-4')}>{labels[value]}</span>
                <span className="font-bold">({counts?.[value] ?? 0})</span>
              </button>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

function PriceFilter({ search, facets, onChange }: Props) {
  const min = Number(facets?.priceRange.min ?? 0)
  const max = Number(facets?.priceRange.max ?? 15)
  const applied: [number, number] = [Number(search.minPrice ?? min), Number(search.maxPrice ?? max)]
  const [draft, setDraft] = useState<[number, number] | null>(null)
  const value = draft ?? applied

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg leading-4 font-bold">Faixa de preço</legend>
      <div className="flex flex-col gap-3 pl-3">
        <Slider
          min={min}
          max={max}
          step={0.01}
          minStepsBetweenThumbs={1}
          value={value}
          onValueChange={(v) => setDraft([v[0], v[1]])}
          thumbLabels={['Preço mínimo', 'Preço máximo']}
          thumbValueTexts={[`${br(value[0])} ETH`, `${br(value[1])} ETH`]}
        />
        <p className="text-[15px]" aria-live="polite">
          Preço: {br(value[0])} - {br(value[1])} ETH
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="w-fit"
            disabled={!draft}
            onClick={() => {
              if (!draft) return
              onChange({
                minPrice: draft[0] <= min ? undefined : draft[0].toFixed(2),
                maxPrice: draft[1] >= max ? undefined : draft[1].toFixed(2),
              })
              setDraft(null)
            }}
          >
            Aplicar
          </Button>
          {(search.minPrice || search.maxPrice) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(null)
                onChange({ minPrice: undefined, maxPrice: undefined })
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>
    </fieldset>
  )
}

export function Filters({ search, facets, onChange }: Props) {
  const hasFilters = !!(search.category || search.network || search.minPrice || search.maxPrice)
  return (
    <div className="flex flex-col gap-10 bg-card p-5">
      <OptionList
        title="Coleções"
        options={CATEGORIES}
        labels={CATEGORY_LABEL}
        selected={search.category}
        counts={facets?.category}
        onToggle={(c) => onChange({ category: toggle(search.category, c) })}
      />
      <PriceFilter search={search} facets={facets} onChange={onChange} />
      <OptionList
        title="Rede"
        options={NETWORKS}
        labels={NETWORK_LABEL}
        selected={search.network}
        counts={facets?.network}
        onToggle={(n) => onChange({ network: toggle(search.network, n) })}
      />
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={() => onChange({ category: undefined, network: undefined, minPrice: undefined, maxPrice: undefined })}>
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
