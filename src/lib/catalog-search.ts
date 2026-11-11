import { CATEGORIES, NETWORKS, NFT_SORTS, NFT_TABS, type Category, type Network, type NftSort, type NftTab } from '@/api/contracts'
import { isEth } from './eth'

/** Estado do catálogo na URL (sobrevive a refresh e ao histórico). */
export interface CatalogSearch {
  q?: string
  category?: Category[]
  network?: Network[]
  minPrice?: string
  maxPrice?: string
  tab?: NftTab
  sort?: NftSort
  page?: number
  favorites?: boolean
}

const list = <T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const valid = [...new Set(raw.filter((v): v is T => allowed.includes(v as T)))]
  return valid.length ? valid : undefined
}

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined

/** Valores inválidos na URL são descartados em vez de quebrar a página. */
export function parseCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const page = Number(raw.page)
  const price = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && isEth(String(v)) ? String(v) : undefined
  const minPrice = price(raw.minPrice)
  let maxPrice = price(raw.maxPrice)
  if (minPrice && maxPrice && Number(maxPrice) < Number(minPrice)) maxPrice = undefined // faixa invertida
  return {
    q: typeof raw.q === 'string' && raw.q.trim() ? raw.q.trim().slice(0, 80) : undefined,
    category: list(raw.category, CATEGORIES),
    network: list(raw.network, NETWORKS),
    minPrice,
    maxPrice,
    tab: pick(raw.tab, NFT_TABS),
    sort: pick(raw.sort, NFT_SORTS),
    page: Number.isInteger(page) && page > 1 ? page : undefined,
    favorites: raw.favorites === true || raw.favorites === 'true' ? true : undefined,
  }
}
