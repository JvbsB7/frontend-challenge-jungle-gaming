import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { ApiError } from '@/api/client'
import { q } from '@/api/queries'
import { CartLine } from '@/components/cart/cart-items'
import { CartSummary } from '@/components/cart/cart-summary'
import { NftCard } from '@/components/nft-card'
import { Button } from '@/components/ui/button'
import { useFavoriteIds, useToggleFavorite } from '@/lib/favorites'
import { useCartNotices } from '@/lib/use-cart-notices'
import { useSession } from '@/lib/use-session'

export const Route = createFileRoute('/carrinho')({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(q.cart())
  },
  component: CartPage,
})

function AlsoViewed({ exclude }: { exclude: string[] }) {
  const { data } = useQuery(q.nftList({ tab: 'trending', page: 1, pageSize: 9 }))
  const favorites = useFavoriteIds()
  const toggle = useToggleFavorite()
  const items = (data?.items ?? []).filter((n) => !exclude.includes(n.id)).slice(0, 5)
  if (!items.length) return null
  return (
    <section aria-labelledby="tambem-viram" className="mt-24 hidden flex-col gap-8 md:flex">
      <h2 id="tambem-viram" className="border-b border-primary pb-2 text-base font-bold text-brand">
        Colecionadores também viram
      </h2>
      <ul className="grid grid-cols-5 gap-6">
        {items.map((n) => (
          <li key={n.id}>
            <NftCard nft={n} favorite={favorites.has(n.id)} onToggleFavorite={(x) => toggle(x.id, x.name, !favorites.has(x.id))} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function CartSkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando carrinho">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="skeleton h-[100px] rounded-2xl md:h-[70px] md:rounded-none" />
      ))}
    </ul>
  )
}

function CartPage() {
  useSession() // escopo do carrinho muda com login/logout
  const router = useRouter()
  const { data: cart, error, isPending, refetch } = useQuery(q.cart())
  const { notices, dismiss } = useCartNotices()
  const blocked = !!cart?.items.some((i) => i.quantity > i.available)

  return (
    <div className="pb-8">
      <nav aria-label="Trilha" className="mt-7 hidden text-[15px] leading-4 font-bold md:block">
        <Link to="/">Início</Link> / <Link to="/" hash="catalogo">Mercado</Link> / <span aria-current="page">Carrinho</span>
      </nav>
      <header className="relative flex items-center justify-center md:hidden">
        <button type="button" aria-label="Voltar" onClick={() => router.history.back()} className="absolute left-0 grid size-9 place-items-center rounded-full bg-surface">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h1 className="text-xl font-bold">Carrinho de NFTs</h1>
      </header>
      <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>

      <div className="mt-3 grid grid-cols-1 gap-8 md:grid-cols-[1fr_332px] md:gap-16 lg:gap-[86px]">
        <section id="itens-carrinho" tabIndex={-1} aria-label="Itens do carrinho" className="flex min-w-0 flex-col gap-3 outline-none">
          <div className="hidden grid-cols-[minmax(0,250px)_92px_80px_100px_24px] justify-between border-b border-foreground/20 pr-6 pb-3 font-bold md:grid" aria-hidden>
            <span>NFTs</span>
            <span className="font-medium">Preço</span>
            <span>Edições</span>
            <span className="font-medium">Total</span>
            <span />
          </div>
          {isPending ? (
            <CartSkeleton />
          ) : error ? (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-md bg-card p-6">
              <p className="font-bold">Não foi possível carregar o carrinho.</p>
              <p className="text-sm text-muted-foreground">{error instanceof ApiError ? error.message : 'Erro inesperado.'}</p>
              <Button onClick={() => void refetch()}>Tentar novamente</Button>
            </div>
          ) : cart.items.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-md bg-card p-6">
              <p className="font-bold">Seu carrinho está vazio.</p>
              <p className="text-sm text-muted-foreground">Explore o mercado e adicione NFTs para continuar.</p>
              <Button asChild>
                <Link to="/" hash="catalogo">
                  Explorar NFTs
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="relative flex flex-col gap-3">
              {cart.items.map((item) => (
                <CartLine key={`${item.nftId}:${item.editionId}`} item={item} notice={notices[`${item.nftId}:${item.editionId}`]} onDismiss={() => dismiss(item)} />
              ))}
            </ul>
          )}
        </section>
        {cart && cart.items.length > 0 && (
          <div className="-mx-4 min-w-0 md:mx-0">
            <CartSummary blocked={blocked} />
          </div>
        )}
      </div>
      <AlsoViewed exclude={cart?.items.map((i) => i.nftId) ?? []} />
    </div>
  )
}
