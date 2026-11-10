import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Heart, Minus, Plus, ShoppingCart, Star, ZoomIn } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'
import type { Edition, Nft } from '@/api/contracts'
import { q } from '@/api/queries'
import linkedin from '@/assets/share/linkedin.svg'
import mail from '@/assets/share/mail.svg'
import twitter from '@/assets/share/twitter.svg'
import { NftCard } from '@/components/nft-card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { maxQuantity, useAddToCart } from '@/lib/cart'
import { formatEth } from '@/lib/eth'
import { useFavoriteIds, useToggleFavorite } from '@/lib/favorites'
import { nftSrcSet } from '@/lib/images'
import { NETWORK_LABEL } from '@/lib/labels'
import { useNftChangeAnnouncer } from '@/lib/use-nft-changes'

/** Edição inicial: a pedida na URL, senão a 1/50 (referência do layout), senão a primeira disponível. */
function pickEdition(nft: Nft, requested?: string): Edition | undefined {
  return (
    nft.editions.find((e) => e.id === requested) ??
    nft.editions.find((e) => e.id === 'e50' && e.available > 0) ??
    nft.editions.find((e) => e.available > 0) ??
    nft.editions[0]
  )
}

function Rating({ nft }: { nft: Nft }) {
  return (
    <p className="flex items-center gap-1 text-[15px]">
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn('size-[15px] text-brand', i < nft.rating ? 'fill-current' : 'opacity-40')} />
        ))}
      </span>
      <span className="sr-only">Nota {nft.rating} de 5,</span>
      {nft.reviewsCount} avaliações de colecionadores
    </p>
  )
}

function Gallery({ nft }: { nft: Nft }) {
  const [index, setIndex] = useState(0)
  const image = nft.images[index] ?? nft.image
  return (
    <div className="flex gap-7 md:h-[448px]">
      <ul className="hidden flex-col gap-4 md:flex" aria-label="Imagens do NFT">
        {nft.images.map((src, i) => (
          <li key={src + i}>
            <button
              type="button"
              aria-label={`Ver imagem ${i + 1} de ${nft.images.length}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn('block size-[100px] overflow-hidden rounded-lg border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none', i === index ? 'border-primary' : 'border-transparent')}
            >
              <img src={src.replace('.webp', '-500.webp')} alt="" width={100} height={100} loading="lazy" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative w-full max-w-[444px] rounded-md bg-card p-4">
        <img
          src={image}
          srcSet={nftSrcSet(image)}
          sizes="(min-width: 768px) 404px, 90vw"
          alt={nft.name}
          width={404}
          height={404}
          fetchPriority="high"
          className="aspect-square w-full rounded-3xl object-cover"
        />
        {/* DialogTrigger: ao fechar, o Radix devolve o foco a este botão. */}
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Ampliar imagem"
              className="absolute top-4 right-4 grid size-[30px] place-items-center rounded-full bg-background/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ZoomIn className="size-4" aria-hidden />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(90vw,900px)] bg-card p-4 sm:max-w-[min(90vw,900px)]">
          <DialogTitle>{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada</DialogDescription>
            <img src={image} alt={nft.name} width={1000} height={1000} className="max-h-[80vh] w-full rounded-2xl object-contain" />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function EditionPicker({ nft, value, onChange }: { nft: Nft; value?: Edition; onChange: (e: Edition) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-[15px] leading-4 font-bold">Edição:</legend>
      <div role="radiogroup" aria-label="Edição" className="flex flex-wrap gap-1.5">
        {nft.editions.map((e) => {
          const selected = e.id === value?.id
          const soldOut = e.available === 0
          return (
            <button
              key={e.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={soldOut}
              onClick={() => onChange(e)}
              className={cn(
                'h-7 rounded-full border px-2 text-sm leading-4 uppercase focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                selected ? 'border-brand font-medium text-brand' : 'border-border text-muted-foreground',
                soldOut && 'cursor-not-allowed line-through opacity-50',
              )}
            >
              {e.label}
              {soldOut && <span className="sr-only"> (esgotada)</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function QuantityStepper({ value, max, onChange, compact }: { value: number; max: number; onChange: (n: number) => void; compact?: boolean }) {
  const id = useId()
  const btn = cn(
    'grid place-items-center rounded-full border border-background bg-primary text-primary-foreground shadow-[0_6.6px_9.9px_rgba(20,13,10,0.15)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40',
    compact ? 'h-7 w-[18px]' : 'h-[49px] w-[33px]',
  )
  return (
    <div className="flex items-center gap-3" role="group" aria-labelledby={id}>
      <span id={id} className={compact ? 'text-sm' : 'sr-only'}>
        Qtd.
      </span>
      <button type="button" className={btn} aria-label="Diminuir quantidade" disabled={value <= 1} onClick={() => onChange(value - 1)}>
        <Minus className={compact ? 'size-3.5' : 'size-5'} aria-hidden />
      </button>
      <output aria-live="polite" className="min-w-5 text-center text-xl leading-7">
        {value}
      </output>
      <button type="button" className={btn} aria-label="Aumentar quantidade" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus className={compact ? 'size-3.5' : 'size-5'} aria-hidden />
      </button>
    </div>
  )
}

function Share({ nft }: { nft: Nft }) {
  const url = encodeURIComponent(location.href)
  const text = encodeURIComponent(`${nft.name} na Kurio`)
  const links = [
    { name: 'LinkedIn', icon: linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
    { name: 'e-mail', icon: mail, href: `mailto:?subject=${text}&body=${url}` },
    { name: 'X (Twitter)', icon: twitter, href: `https://x.com/intent/post?url=${url}&text=${text}` },
  ]
  return (
    <div className="flex items-center gap-2">
      <p className="text-[15px] leading-4 font-bold">Compartilhar este NFT:</p>
      {links.map((l) => (
        <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer" className="grid size-6 place-items-center rounded focus-visible:ring-3 focus-visible:ring-ring/50">
          <img src={l.icon} alt={`Compartilhar por ${l.name} (abre em nova aba)`} width={16} height={16} className="size-4 object-contain" />
        </a>
      ))}
    </div>
  )
}

function DetailsTabs({ nft }: { nft: Nft }) {
  const [tab, setTab] = useState<'details' | 'reviews'>('details')
  const tabs = [
    { id: 'details' as const, label: 'Detalhes do NFT' },
    { id: 'reviews' as const, label: `Avaliações de colecionadores (${nft.reviewsCount})` },
  ]
  return (
    <section className="mt-16 md:mt-24">
      <div role="tablist" aria-label="Informações do NFT" className="flex gap-5 border-b border-primary">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`painel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn('-mb-px border-b-2 pb-2 text-sm md:text-base', tab === t.id ? 'border-brand font-bold text-brand' : 'border-transparent')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`painel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4 pt-4 text-sm leading-6 text-muted-foreground">
        {tab === 'details' ? (
          <>
            <p>
              {nft.name} é uma obra digital da coleção {nft.collection}. Cada atributo fica armazenado nos metadados do token e verificado na{' '}
              {NETWORK_LABEL[nft.network]}.
            </p>
            <p>{nft.description}</p>
            <dl className="grid gap-3">
              <div>
                <dt className="font-bold text-foreground">Rede:</dt>
                <dd>Cunhado na {NETWORK_LABEL[nft.network]} com procedência imutável e metadados armazenados no IPFS.</dd>
              </div>
              <div>
                <dt className="font-bold text-foreground">Direitos autorais:</dt>
                <dd>Direitos do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</dd>
              </div>
              <div>
                <dt className="font-bold text-foreground">Contrato:</dt>
                <dd>{nft.contract} • Contrato inteligente ERC-721 verificado.</dd>
              </div>
            </dl>
          </>
        ) : (
          <p>As avaliações detalhadas não fazem parte desta demonstração. Nota média: {nft.rating} de 5.</p>
        )}
      </div>
    </section>
  )
}

function Related({ nft }: { nft: Nft }) {
  const { data } = useQuery(q.nftList({ category: [nft.category], page: 1, pageSize: 6 }))
  const favorites = useFavoriteIds()
  const toggle = useToggleFavorite()
  const items = (data?.items ?? []).filter((n) => n.id !== nft.id).slice(0, 5)
  if (!items.length) return null
  return (
    <section aria-labelledby="relacionados" className="mt-16 flex flex-col gap-8 md:mt-24">
      <h2 id="relacionados" className="border-b border-primary pb-2 text-base font-bold text-brand">
        Mais desta coleção
      </h2>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-5 md:px-0">
        {items.map((n) => (
          <li key={n.id} className="w-[45%] shrink-0 snap-start md:w-auto">
            <NftCard nft={n} favorite={favorites.has(n.id)} onToggleFavorite={(x) => toggle(x.id, x.name, !favorites.has(x.id))} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function NftDetail({ nft, editionId, onEdition }: { nft: Nft; editionId?: string; onEdition: (id: string) => void }) {
  const edition = pickEdition(nft, editionId)
  const [quantity, setQuantity] = useState(1)
  const max = edition ? maxQuantity(edition.available) : 0
  const qty = Math.min(Math.max(quantity, 1), Math.max(max, 1))
  const soldOut = !edition || edition.available === 0
  const favorites = useFavoriteIds()
  const toggleFavorite = useToggleFavorite()
  const favorite = favorites.has(nft.id)
  const add = useAddToCart()
  const navigate = useNavigate()
  const router = useRouter()
  useNftChangeAnnouncer([nft.id], { [nft.id]: nft.name })

  const addToCart = (goToCart: boolean) => {
    if (!edition || soldOut) return
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: qty },
      {
        onSuccess: () => {
          if (goToCart) void navigate({ to: '/carrinho' })
          else toast.success(`${qty}× ${nft.name} (${edition.label}) adicionado ao carrinho.`)
        },
      },
    )
  }

  const favButton = (
    <Button variant="outline" className="w-[130px] text-sm font-medium" aria-pressed={favorite} onClick={() => toggleFavorite(nft.id, nft.name, !favorite)}>
      <Heart data-icon="inline-start" fill={favorite ? 'currentColor' : 'none'} aria-hidden />
      Favoritar
    </Button>
  )

  return (
    <article className="pb-44 md:pb-0">
      <nav aria-label="Trilha" className="mt-7 hidden text-[15px] leading-4 font-bold md:block">
        <Link to="/">Início</Link> / <Link to="/" hash="catalogo">Mercado</Link>
      </nav>

      {/* Barra superior mobile: voltar + favoritar */}
      <div className="flex items-center justify-between md:hidden">
        <button type="button" aria-label="Voltar" onClick={() => router.history.back()} className="grid size-9 place-items-center rounded-full border border-border">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={`Favoritar ${nft.name}`}
          onClick={() => toggleFavorite(nft.id, nft.name, !favorite)}
          className="grid size-9 place-items-center rounded-full border border-border text-primary"
        >
          <Heart className="size-5" fill={favorite ? 'currentColor' : 'none'} aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid gap-8 md:grid-cols-[minmax(0,573px)_1fr]">
        <Gallery nft={nft} />
        <div className="-mx-4 flex flex-col gap-4 rounded-t-[30px] bg-card px-6 pt-8 md:mx-0 md:justify-between md:rounded-none md:bg-transparent md:p-0">
          <header className="flex flex-col gap-3 md:border-b md:border-foreground/20 md:pb-3">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-bold md:text-[28px]">{nft.name}</h1>
              {/* Mobile: selo compacto da nota (Figma). */}
              <p className="flex shrink-0 items-center gap-1 rounded-full border border-brand px-2 py-0.5 text-sm md:hidden">
                <Star className="size-4 fill-current text-brand" aria-hidden />
                <span className="font-bold">{nft.rating.toFixed(1)}</span>
                <span>({nft.reviewsCount})</span>
                <span className="sr-only">avaliações de colecionadores</span>
              </p>
            </div>
            <div className="hidden flex-wrap items-center justify-between gap-2 md:flex">
              <p className="text-[22px] leading-4 font-bold text-brand">{edition && formatEth(edition.price)}</p>
              <Rating nft={nft} />
            </div>
          </header>
          <div className="flex flex-col gap-3">
            <h2 className="hidden text-[15px] leading-4 font-bold md:block">Sobre este NFT:</h2>
            <p className="text-sm leading-6 text-muted-foreground">{nft.description}</p>
          </div>
          <EditionPicker nft={nft} value={edition} onChange={(e) => onEdition(e.id)} />
          <p className={cn('text-sm', soldOut ? 'font-bold text-destructive' : 'text-muted-foreground')} aria-live="polite">
            {soldOut ? 'Edição esgotada. Escolha outra edição.' : `${edition.available} disponível(is) nesta edição · máximo ${max} por pedido`}
          </p>
          <div className="hidden items-center justify-between md:flex">
            <QuantityStepper value={qty} max={max} onChange={setQuantity} />
            <div className="flex gap-2">
              <Button className="w-[130px] text-sm" disabled={soldOut || add.isPending} onClick={() => addToCart(true)}>
                {add.isPending ? 'Adicionando…' : 'COMPRAR'}
              </Button>
              {favButton}
            </div>
          </div>
          <div className="flex flex-col gap-3 text-[15px] text-subtle">
            <p>ID do token: {nft.tokenId}</p>
            <p>Coleção: {nft.collection}</p>
            <p>Atributos: {nft.attributes.join(', ')}</p>
            <div className="hidden md:block">
              <Share nft={nft} />
            </div>
          </div>
        </div>
      </div>

      <DetailsTabs nft={nft} />
      <Related nft={nft} />

      {/* Barra de compra fixa (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-4 rounded-t-[30px] bg-card px-6 pt-5 pb-6 shadow-[0_-8px_24px_rgba(10,6,4,0.5)] md:hidden">
        <div className="flex items-center justify-between">
          <QuantityStepper value={qty} max={max} onChange={setQuantity} compact />
          <p className="text-xl font-bold text-brand">{edition && formatEth(edition.price)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="lg" className="h-[60px] flex-1 rounded-full bg-gradient-to-r from-primary to-primary/80" disabled={soldOut || add.isPending} onClick={() => addToCart(true)}>
            Comprar NFT
          </Button>
          <Button
            size="icon"
            variant="secondary"
            aria-label="Adicionar ao carrinho"
            className="size-[60px] rounded-full text-primary"
            disabled={soldOut || add.isPending}
            onClick={() => addToCart(false)}
          >
            <ShoppingCart className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
    </article>
  )
}

/** Mesmo esqueleto do layout real (trilha, galeria 448px, colunas) para não deslocar a página (CLS). */
export function NftDetailSkeleton() {
  return (
    <div className="pb-44 md:pb-0" aria-busy="true" aria-label="Carregando NFT">
      <div className="mt-7 hidden h-4 md:block" />
      <div className="h-9 md:hidden" />
      <div className="mt-3 grid gap-8 md:grid-cols-[minmax(0,573px)_1fr]">
        <div className="flex gap-7 md:h-[448px]">
          <div className="hidden flex-col gap-4 md:flex">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton size-[100px] rounded-lg" />
            ))}
          </div>
          <div className="skeleton aspect-square w-full max-w-[444px] rounded-md" />
        </div>
        <div className="flex flex-col gap-5 md:h-[448px]">
          <div className="skeleton h-8 w-2/3 rounded" />
          <div className="skeleton h-6 w-1/4 rounded" />
          <div className="skeleton h-20 w-full rounded" />
          <div className="skeleton h-7 w-1/2 rounded" />
          <div className="skeleton h-12 w-full rounded" />
        </div>
      </div>
    </div>
  )
}
