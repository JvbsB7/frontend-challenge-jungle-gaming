import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { cn } from 'cn'
import type { NftSummary } from '@/api/contracts'
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
          <span className="absolute top-4 left-0 bg-primary px-2 py-2 text-[13px] leading-4 font-medium text-primary-foreground md:hidden">RARO</span>
        )}
        {soldOut && (
          <span className="absolute top-4 right-4 rounded-md bg-background/90 px-2 py-1 text-xs font-bold text-foreground">Esgotado</span>
        )}
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
