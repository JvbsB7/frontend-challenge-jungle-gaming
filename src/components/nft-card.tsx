import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import { cn } from 'cn'
import type { NftSummary } from '@/api/contracts'
import { useAddToCart } from '@/lib/cart'
import { formatEth } from '@/lib/eth'
import { nftSrcSet } from '@/lib/images'

interface Props {
  nft: NftSummary
  favorite: boolean
  onToggleFavorite: (nft: NftSummary) => void
  /** Primeiras imagens visíveis carregam com prioridade (LCP). */
  priority?: boolean
}

// Desktop: bloco 300px em bg-card com arte 250px (Figma "Product Grid").
// Mobile: card arredondado com gradiente, coração e selo RARO (Figma "Mobile / Início").
/** Ações do hover no desktop (Figma: carrinho, coração e lupa sobre a base da arte). */
function HoverActions({ nft, favorite, onToggleFavorite }: Omit<Props, 'priority'>) {
  const add = useAddToCart()
  const action =
    'grid size-[35px] place-items-center rounded-md bg-card text-foreground hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50'
  return (
    <div className="absolute bottom-[3%] left-1/2 z-10 hidden -translate-x-1/2 gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:flex">
      <button
        type="button"
        className={action}
        aria-label={`Adicionar ${nft.name} (edição 1/50) ao carrinho`}
        disabled={nft.available === 0 || add.isPending}
        // Edição de referência do card: 1/50, a do preço exibido.
        onClick={() => add.mutate({ nftId: nft.id, editionId: 'e50', quantity: 1 }, { onSuccess: () => toast.success(`${nft.name} adicionado ao carrinho.`) })}
      >
        <ShoppingCart className="size-5" aria-hidden />
      </button>
      <button type="button" className={action} aria-pressed={favorite} aria-label={`Favoritar ${nft.name}`} onClick={() => onToggleFavorite(nft)}>
        <Heart className="size-5" fill={favorite ? 'currentColor' : 'none'} aria-hidden />
      </button>
      <Link to="/nft/$id" params={{ id: nft.id }} className={action} aria-label={`Ver detalhes de ${nft.name}`}>
        <Search className="size-5" aria-hidden />
      </Link>
    </div>
  )
}

export function NftCard({ nft, favorite, onToggleFavorite, priority }: Props) {
  const soldOut = nft.available === 0
  return (
    <article className="group relative flex flex-col gap-2 md:gap-3">
      <div className="relative flex aspect-[175/200] items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-card to-[#2f1d15] px-1 md:aspect-[258/300] md:rounded-none md:bg-none md:bg-card">
        <img
          src={nft.image}
          srcSet={nftSrcSet(nft.image)}
          sizes="(min-width: 768px) 250px, 45vw"
          alt={nft.name}
          width={250}
          height={250}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={cn('aspect-square w-full rounded-2xl object-cover md:w-[96.9%] md:rounded-[15px]', soldOut && 'opacity-50 grayscale')}
        />
        {nft.rare && (
          <span className="absolute top-4 left-0 bg-primary px-2 py-2 text-[13px] leading-4 font-medium text-primary-foreground md:top-0 md:px-4 md:py-1 md:text-sm">RARO</span>
        )}
        {soldOut && (
          <span className="absolute top-4 right-4 rounded-md bg-background/90 px-2 py-1 text-xs font-bold text-foreground">Esgotado</span>
        )}
        <HoverActions nft={nft} favorite={favorite} onToggleFavorite={onToggleFavorite} />
      </div>
      <div className="flex flex-col gap-1.5 pl-2 md:pl-0">
        <h3 className="text-[15px] leading-tight md:text-base md:leading-4">
          {/* O link cobre o card inteiro (área de toque grande), mantendo um único alvo de foco. */}
          <Link to="/nft/$id" params={{ id: nft.id }} className="after:absolute after:inset-0 focus-visible:outline-none group-has-[a:focus-visible]:underline">
            {nft.name}
          </Link>
        </h3>
        <p className="flex items-center gap-3 text-base leading-4 md:text-lg">
          <span className="font-bold text-brand">{formatEth(nft.price)}</span>
          {nft.compareAtPrice && (
            <span className="text-subtle line-through">
              <span className="sr-only">Preço anterior: </span>
              {formatEth(nft.compareAtPrice)}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        aria-pressed={favorite}
        aria-label={`Favoritar ${nft.name}`}
        onClick={() => onToggleFavorite(nft)}
        className="absolute top-3 right-3 z-10 grid size-8 place-items-center rounded-lg bg-background/70 text-primary focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
      >
        <Heart className="size-5" fill={favorite ? 'currentColor' : 'none'} aria-hidden />
      </button>
      {/* Contorno de foco do card inteiro quando o link recebe foco pelo teclado. */}
      <span className="pointer-events-none absolute -inset-1 rounded-[22px] ring-ring/60 group-has-[a:focus-visible]:ring-3 md:rounded-sm" aria-hidden />
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 md:gap-3" aria-hidden>
      <div className="skeleton aspect-[175/200] rounded-[20px] md:aspect-[258/300] md:rounded-none" />
      <div className="flex flex-col gap-1.5 pl-2 md:pl-0">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/3 rounded" />
      </div>
    </div>
  )
}
