import { Link } from '@tanstack/react-router'
import { useId, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Category } from '@/api/contracts'
import facebook from '@/assets/social/facebook.svg'
import instagram from '@/assets/social/instagram.svg'
import linkedin from '@/assets/social/linkedin.svg'
import twitter from '@/assets/social/twitter.svg'
import youtube from '@/assets/social/youtube.svg'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const SOCIAL = [
  { name: 'Facebook', icon: facebook, href: 'https://www.facebook.com/' },
  { name: 'Instagram', icon: instagram, href: 'https://www.instagram.com/' },
  { name: 'X (Twitter)', icon: twitter, href: 'https://x.com/' },
  { name: 'LinkedIn', icon: linkedin, href: 'https://www.linkedin.com/' },
  { name: 'YouTube', icon: youtube, href: 'https://www.youtube.com/' },
]

const COLLECTIONS: Array<[string, Category]> = [
  ['Arte digital', 'arte-digital'],
  ['Fotografia', 'fotografia'],
  ['Música', 'musica'],
  ['Arte 3D', 'arte-3d'],
  ['Utilidade', 'utilidade'],
]

// Itens fora do escopo da entrega aparecem como texto, sem simular navegação.
const PROFILE_LINKS: Array<[string, '/perfil' | '/carteiras' | null]> = [
  ['Meu perfil', '/perfil'],
  ['Minha coleção', null],
  ['Atividade', null],
  ['Estúdio do criador', null],
  ['Lista de interesse', null],
]
const HELP_LINKS = ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item']

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg leading-4 font-bold">{title}</h2>
      <ul className="text-sm leading-[30px]">{children}</ul>
    </div>
  )
}

function Newsletter() {
  const id = useId()
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Informe um e-mail válido.')
      return
    }
    // Newsletter não faz parte da entrega: avisa em vez de fingir inscrição.
    toast.info('A inscrição na newsletter não está disponível nesta demonstração.')
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg leading-4 font-bold">
        <label htmlFor={id}>Antecipe-se ao próximo lançamento</label>
      </h2>
      <div className="flex h-10 items-center rounded-md bg-surface shadow-[0_0_10px_rgba(10,6,4,0.45)]">
        <input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="digite seu e-mail..."
          className="h-full min-w-0 flex-1 bg-transparent pl-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button type="submit" className="h-full w-[85px] rounded-r-md bg-primary text-lg font-bold text-primary-foreground hover:bg-primary/80">
          Enviar
        </button>
      </div>
      <p className="text-[13px] leading-[22px] text-muted-foreground">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </form>
  )
}

export function Footer() {
  return (
    <footer className="mt-16 md:mt-24">
      <div className="grid gap-8 bg-card p-6 sm:grid-cols-2 md:p-8 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-0">
        {FEATURES.map((f) => (
          <div key={f.letter} className="flex flex-col gap-3 lg:border-r lg:border-primary lg:px-4">
            <span className="grid size-[74px] place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground" aria-hidden>
              {f.letter}
            </span>
            <h2 className="text-[17px] leading-4 font-bold">{f.title}</h2>
            <p className="max-w-[204px] text-sm leading-[22px] text-muted-foreground">{f.text}</p>
          </div>
        ))}
        <div className="lg:px-4">
          <Newsletter />
        </div>
      </div>

      <div className="grid gap-4 bg-surface px-6 py-6 text-sm leading-[22px] sm:grid-cols-2 md:px-8 lg:grid-cols-4 lg:items-center">
        <span className="font-bold tracking-[1.4px]">KURIO</span>
        <p>
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        <a href="mailto:contato@email.com" className="hover:underline">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="hover:underline">
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid gap-8 bg-card p-6 sm:grid-cols-2 md:p-8 lg:grid-cols-[1fr_1fr_1fr_228px] lg:gap-[124px]">
        <Column title="Meu perfil">
          {PROFILE_LINKS.map(([label, to]) => (
            <li key={label}>{to ? <Link to={to} className="hover:text-brand">{label}</Link> : <span className="text-foreground/70">{label}</span>}</li>
          ))}
        </Column>
        <Column title="Central de ajuda">
          {HELP_LINKS.map((label) => (
            <li key={label}>
              <span className="text-foreground/70">{label}</span>
            </li>
          ))}
        </Column>
        <Column title="Coleções">
          {COLLECTIONS.map(([label, category]) => (
            <li key={category}>
              <Link to="/" search={{ category: [category] }} hash="catalogo" className="hover:text-brand">
                {label}
              </Link>
            </li>
          ))}
        </Column>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-5">
            <h2 className="text-lg leading-4 font-bold">Redes sociais</h2>
            <ul className="flex gap-2.5">
              {SOCIAL.map((s) => (
                <li key={s.name}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="block rounded-md focus-visible:ring-3 focus-visible:ring-ring/50">
                    <img src={s.icon} alt={`${s.name} (abre em nova aba)`} width={32} height={32} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-lg leading-4 font-bold">Carteiras compatíveis</h2>
            <p className="rounded-md border border-border bg-surface px-2 py-1.5 text-center text-[9px] font-bold tracking-[0.1px] whitespace-pre text-brand">
              {'METAMASK  •  WALLETCONNECT  •  COINBASE'}
            </p>
          </div>
        </div>
      </div>
      <p className="py-1 text-center text-sm leading-[30px]">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
