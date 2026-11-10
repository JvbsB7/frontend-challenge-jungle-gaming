import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ApiError } from '@/api/client'
import { q } from '@/api/queries'
import { NftDetail, NftDetailSkeleton } from '@/components/nft-detail'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/nft/$id')({
  validateSearch: (raw: Record<string, unknown>): { edicao?: string } => ({
    edicao: typeof raw.edicao === 'string' ? raw.edicao : undefined,
  }),
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(q.nft(params.id))
  },
  component: NftPage,
})

function NftPage() {
  const { id } = Route.useParams()
  const { edicao } = Route.useSearch()
  const navigate = useNavigate({ from: '/nft/$id' })
  const { data, error, isPending, refetch } = useQuery(q.nft(id))

  if (isPending) return <NftDetailSkeleton />

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <section className="flex flex-col items-center gap-6 py-24 text-center" role="alert">
        <h1 className="text-2xl font-bold">{notFound ? 'NFT não encontrado' : 'Não foi possível carregar o NFT'}</h1>
        <p className="max-w-md text-muted-foreground">
          {notFound ? 'Este NFT não existe ou foi removido do mercado.' : error instanceof ApiError ? error.message : 'Erro inesperado.'}
        </p>
        <div className="flex gap-3">
          {!notFound && <Button onClick={() => void refetch()}>Tentar novamente</Button>}
          <Button asChild variant="outline">
            <Link to="/" hash="catalogo">
              Voltar ao mercado
            </Link>
          </Button>
        </div>
      </section>
    )
  }

  return (
    <NftDetail
      key={data.id}
      nft={data}
      editionId={edicao}
      onEdition={(edition) => void navigate({ search: { edicao: edition }, replace: true, resetScroll: false })}
    />
  )
}
