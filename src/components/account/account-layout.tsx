import { Link, useLocation } from '@tanstack/react-router'
import { Download, Heart, LifeBuoy, LogOut, MapPin, ShoppingCart, TrendingUp, UserRound, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from 'cn'
import { logout } from '@/lib/auth'

type Item =
  | { label: string; icon: LucideIcon; to: '/perfil' | '/carteiras' }
  | { label: string; icon: LucideIcon; favorites: true }
  | { label: string; icon: LucideIcon }

// Ordem e itens do Figma ("Meu perfil"). Atividade, Ofertas, Arquivos e Suporte estão fora do escopo.
const ITEMS: Item[] = [
  { label: 'Dados do perfil', icon: UserRound, to: '/perfil' },
  { label: 'Carteiras', icon: MapPin, to: '/carteiras' },
  { label: 'Atividade', icon: ShoppingCart },
  { label: 'Lista de interesse', icon: Heart, favorites: true },
  { label: 'Ofertas', icon: TrendingUp },
  { label: 'Arquivos baixados', icon: Download },
  { label: 'Suporte', icon: LifeBuoy },
]

const itemClass =
  'relative flex h-[45px] shrink-0 items-center gap-3 px-4 text-[15px] text-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none hover:bg-surface max-lg:rounded-full max-lg:border max-lg:border-border max-lg:px-4'

export function AccountLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 md:mt-8 lg:grid-cols-[310px_1fr] lg:gap-7">
      <nav aria-label="Meu perfil" className="min-w-0 self-start bg-card lg:pb-3">
        <h2 className="hidden px-2.5 pt-4 pb-2 text-lg font-bold lg:block">Meu perfil</h2>
        <ul className="flex gap-2 overflow-x-auto p-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:p-0">
          {ITEMS.map((item) => {
            const Icon = item.icon
            const content = (
              <>
                <Icon className="size-[18px] shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{item.label}</span>
              </>
            )
            if ('to' in item) {
              const active = pathname === item.to
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(itemClass, active && 'lg:before:absolute lg:before:inset-y-0 lg:before:left-0 lg:before:w-1.5 lg:before:bg-primary max-lg:bg-primary max-lg:text-primary-foreground')}
                  >
                    {content}
                  </Link>
                </li>
              )
            }
            if ('favorites' in item) {
              return (
                <li key={item.label}>
                  <Link to="/" search={{ favorites: true }} className={itemClass}>
                    {content}
                  </Link>
                </li>
              )
            }
            return (
              <li key={item.label}>
                <button type="button" className={cn(itemClass, 'w-full')} onClick={() => toast.info(`${item.label} não faz parte desta demonstração.`)}>
                  {content}
                </button>
              </li>
            )
          })}
          <li className="lg:mt-1 lg:border-t lg:border-border lg:pt-1">
            <button type="button" className={cn(itemClass, 'w-full font-bold')} onClick={() => void logout()}>
              <LogOut className="size-[18px]" aria-hidden />
              Sair
            </button>
          </li>
        </ul>
      </nav>
      <section className="min-w-0 pb-10">{children}</section>
    </div>
  )
}
