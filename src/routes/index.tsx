import { createFileRoute } from '@tanstack/react-router'
import { parseCatalogSearch } from '@/lib/catalog-search'

export const Route = createFileRoute('/')({
  validateSearch: parseCatalogSearch,
  component: () => <h1 className="py-10 text-2xl font-bold">Início</h1>,
})
