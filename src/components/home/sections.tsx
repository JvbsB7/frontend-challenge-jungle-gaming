import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'
import type { NftSummary } from '@/api/contracts'
import { q } from '@/api/queries'
import heroMobileMask from '@/assets/decor/hero-mobile-mask.svg'
import promoMask from '@/assets/decor/promo-mask.svg'
import { Button } from '@/components/ui/button'
import { nftSrcSet } from '@/lib/images'

function Dots({ count, active, onSelect, label }: { count: number; active: number; onSelect: (i: number) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Destaque ${i + 1} de ${count}`}
          aria-pressed={i === active}
          onClick={() => onSelect(i)}
          // Alvo de toque de 24px com o ponto de 8px desenhado no centro.
          className="grid size-6 place-items-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className={cn('size-2 rounded-full', i === active ? 'bg-brand' : 'bg-brand/40')} />
        </button>
      ))}
    </div>
  )
}

export function Hero() {
  const { data } = useQuery(q.featured())
  const [index, setIndex] = useState(0)
  const slides = data?.hero ?? []
  const current: NftSummary | undefined = slides[index]

  return (
    <>
      {/* Desktop/tablet */}
      <section aria-label="Destaques" className="hidden min-h-[450px] items-center justify-between gap-10 py-8 md:mt-8 md:flex lg:pl-10">
        <div className="flex max-w-[600px] flex-col items-end gap-11">
          <div className="flex w-full flex-col gap-8">
            <div className="flex flex-col gap-1">
              <p className="text-sm leading-4 font-medium tracking-[1.4px]">Bem-vindo à Kurio</p>
              <h1 className="mt-2 text-[32px] leading-[52px] font-bold lg:text-[43px] lg:leading-[70px]">
                SEJA DONO DO FUTURO
                <br />
                DA ARTE DIGITAL
              </h1>
              <p className="max-w-[557px] text-sm leading-6 text-muted-foreground">
                Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da
                cultura da internet.
              </p>
            </div>
            <Button asChild className="w-[140px]">
              <Link to="/" hash="catalogo">
                EXPLORAR
              </Link>
            </Button>
          </div>
          {slides.length > 1 && <Dots count={slides.length} active={index} onSelect={setIndex} label="Escolher destaque" />}
        </div>
        <div className="size-[300px] shrink-0 lg:size-[450px]">
          {current ? (
            <Link to="/nft/$id" params={{ id: current.id }} className="block rounded-3xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <img
                src={current.image}
                srcSet={nftSrcSet(current.image)}
                sizes="(min-width: 1024px) 450px, 300px"
                alt={`${current.name} — ver detalhes`}
                width={450}
                height={450}
                fetchPriority="high"
                className="size-full rounded-3xl object-cover"
              />
            </Link>
          ) : (
            <div className="skeleton size-full rounded-3xl" aria-hidden />
          )}
        </div>
      </section>

      {/* Mobile */}
      <section aria-label="Destaques" className="relative mt-4 overflow-hidden rounded-[30px] p-4 md:hidden">
        <img src={heroMobileMask} alt="" aria-hidden className="absolute inset-0 size-full object-cover" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="flex w-full items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-xs leading-4 font-medium">Bem-vindo à Kurio</p>
              <h1 className="text-lg leading-[29px] font-bold">
                SEJA DONO DA
                <br />
                CULTURA DIGITAL
              </h1>
              <p className="text-xs leading-[18px] text-muted-foreground">Descubra NFTs selecionados de criadores do mundo todo.</p>
              <Link to="/" hash="catalogo" className="mt-1 flex items-center gap-2 text-xs leading-[14px] font-bold text-brand">
                EXPLORAR <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="relative size-[138px] shrink-0">
              {current ? (
                <Link to="/nft/$id" params={{ id: current.id }} className="block">
                  <img src={current.image.replace('.webp', '-500.webp')} alt={`${current.name} — ver detalhes`} width={138} height={138} className="size-[138px] rounded-2xl object-cover" />
                </Link>
              ) : (
                <div className="skeleton size-[138px] rounded-2xl" aria-hidden />
              )}
              {slides[1] && (
                <img
                  src={slides[1].image.replace('.webp', '-500.webp')}
                  alt=""
                  aria-hidden
                  width={58}
                  height={58}
                  className="absolute top-[88px] left-3.5 size-[58px] rounded-2xl object-cover"
                />
              )}
            </div>
          </div>
          {slides.length > 1 && <Dots count={slides.length} active={index} onSelect={setIndex} label="Escolher destaque" />}
        </div>
      </section>
    </>
  )
}

/** "NFT em destaque — oferta limitada" (abaixo dos filtros no desktop). */
export function Spotlight() {
  const { data } = useQuery(q.featured())
  const nft = data?.spotlight
  return (
    <section aria-labelledby="destaque-titulo" className="flex flex-col gap-4 bg-gradient-to-b from-primary/10 to-primary/[0.03] pt-6 pb-1">
      <h2 id="destaque-titulo" className="flex flex-col gap-4 px-5">
        <span className="text-2xl leading-8 font-bold text-brand">NFT EM DESTAQUE</span>
        <span className="text-center text-[22px] leading-4 font-bold">OFERTA LIMITADA</span>
      </h2>
      {nft ? (
        <Link to="/nft/$id" params={{ id: nft.id }} className="block rounded-[22px] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <img src={nft.image} srcSet={nftSrcSet(nft.image)} sizes="310px" alt={`${nft.name} — ver oferta`} width={310} height={368} loading="lazy" className="h-[368px] w-full rounded-[22px] object-cover" />
        </Link>
      ) : (
        <div className="skeleton h-[368px] rounded-[22px]" aria-hidden />
      )}
    </section>
  )
}

const PROMOS = [
  {
    title: ['Lançamentos gênesis', 'de edição limitada'],
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/nfts/emerald-ape-500.webp',
    search: { tab: 'new' as const },
  },
  {
    title: ['Arte digital selecionada', 'e muito mais'],
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/nfts/ivory-baron-500.webp',
    search: { category: ['arte-digital' as const] },
  },
]

export function Promos() {
  return (
    <section aria-label="Coleções em destaque" className="mt-24 grid gap-7 md:grid-cols-2">
      {PROMOS.map((p) => (
        <article key={p.title[0]} className="relative flex h-[250px] overflow-hidden rounded-lg bg-card">
          <img src={p.image} alt="" aria-hidden width={292} height={250} loading="lazy" className="h-full w-[38%] max-w-[292px] rounded-[18px] object-cover sm:w-[45%]" />
          <img src={promoMask} alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full" />
          <div className="relative flex min-w-0 flex-1 flex-col items-end justify-center gap-3 p-4 text-right sm:gap-4 sm:p-6">
            <h3 className="text-base leading-6 font-bold sm:text-lg">
              {p.title[0]}
              <br />
              {p.title[1]}
            </h3>
            <p className="max-w-[263px] text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">{p.text}</p>
            <Button asChild className="w-[140px] text-sm font-medium">
              <Link to="/" search={p.search} hash="catalogo">
                Explorar <ArrowRight data-icon="inline-end" aria-hidden />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: '/nfts/ivory-baron-500.webp' },
  { date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: '/nfts/emerald-ape-500.webp' },
  { date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: '/nfts/sage-nomad-500.webp' },
  { date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: '/nfts/golden-beat-500.webp' },
]

export function Blog() {
  return (
    <section aria-labelledby="blog-titulo" className="mt-24 flex flex-col gap-10">
      <header className="flex flex-col gap-3 text-center">
        <h2 id="blog-titulo" className="text-[28px] font-bold">
          Diário da Cunhagem
        </h2>
        <p className="text-sm text-muted-foreground">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </header>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title} className="flex flex-col overflow-hidden rounded-lg bg-card">
            <img src={post.image} alt="" aria-hidden width={268} height={195} loading="lazy" className="h-[195px] w-full object-cover" />
            <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
              <p className="text-xs leading-4 font-medium whitespace-pre-wrap text-muted-foreground">
                {post.date}  |  Leitura de {post.read} min
              </p>
              <h3 className="text-base font-bold">{post.title}</h3>
              <p className="text-xs leading-4 font-medium text-muted-foreground">{post.text}</p>
              {/* Artigos editoriais estão fora do escopo: avisa em vez de navegar para lugar nenhum. */}
              <button
                type="button"
                className="mt-auto w-fit text-xs leading-[14px] font-bold text-brand hover:underline"
                onClick={() => toast.info('Os artigos do Diário da Cunhagem não fazem parte desta demonstração.')}
              >
                Ler mais <span aria-hidden>→</span>
                <span className="sr-only">: {post.title}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
