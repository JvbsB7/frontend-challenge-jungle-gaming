import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LogIn, LogOut, Search, ShoppingCart, UserRound, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'
import { logout } from '@/lib/auth'
import { useCartCount } from '@/lib/use-cart-count'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/use-session'

const MARKET_PATHS = ['/nft', '/carrinho', '/pagamento', '/pedido']

function NavItem({ label, to, active }: { label: string; to?: '/'; active?: boolean }) {
  const base = 'relative pb-6 text-base after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full'
  if (!to) {
    // Seções editoriais estão fora do escopo: não navegam nem fingem sucesso.
    return (
      <button
        type="button"
        className={cn(base, 'cursor-pointer text-foreground')}
        onClick={() => toast.info(`${label} não faz parte desta demonstração.`)}
      >
        {label}
      </button>
    )
  }
  return (
    <Link to={to} aria-current={active ? 'page' : undefined} className={cn(base, active ? 'font-bold text-brand after:bg-brand' : 'text-foreground')}>
      {label}
    </Link>
  )
}

function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Ao fechar, o campo some: o foco volta para a lupa.
  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }
  const navigate = useNavigate()
  const id = useId()

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        aria-label="Buscar NFTs"
        className="grid size-9 place-items-center rounded-md hover:bg-surface"
        onClick={() => {
          setOpen(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
      >
        <Search className="size-5" aria-hidden />
      </button>
    )
  }
  return (
    <form
      role="search"
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        const value = inputRef.current?.value.trim() ?? ''
        void navigate({ to: '/', search: (prev: Record<string, unknown>) => ({ ...prev, q: value || undefined, page: undefined }) })
        close()
      }}
    >
      <label htmlFor={id} className="sr-only">
        Buscar NFTs
      </label>
      <input
        id={id}
        ref={inputRef}
        type="search"
        placeholder="Buscar NFTs..."
        className="h-9 w-48 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onKeyDown={(e) => e.key === 'Escape' && close()}
      />
      <button type="button" aria-label="Fechar busca" className="grid size-9 place-items-center" onClick={close}>
        <X className="size-4" aria-hidden />
      </button>
    </form>
  )
}

export function Header() {
  const { pathname, href } = useLocation()
  const session = useSession()
  const count = useCartCount()
  const market = MARKET_PATHS.some((p) => pathname.startsWith(p))

  return (
    // Figma: a divisória só aparece fora do fluxo de Mercado.
    <header className={cn('hidden md:block', !market && 'border-b border-foreground/20')}>
      <div className="flex items-start justify-between gap-4">
        <Link to="/" className="pt-2 text-sm font-bold tracking-[1.4px] lg:w-40" aria-label="KURIO — página inicial">
          KURIO
        </Link>
        <nav aria-label="Principal" className="flex gap-5 lg:gap-10">
          <NavItem label="Início" to="/" active={!market} />
          <Link
            to="/"
            hash="catalogo"
            aria-current={market ? 'page' : undefined}
            className={cn(
              'relative pb-6 text-base after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full',
              market ? 'font-bold text-brand after:bg-brand' : 'text-foreground',
            )}
          >
            Mercado
          </Link>
          <NavItem label="Criadores" />
          <NavItem label="Aprenda" />
        </nav>
        <div className="flex items-center gap-2 lg:gap-7">
          <HeaderSearch />
          <Link to="/carrinho" className="relative grid size-9 place-items-center rounded-md hover:bg-surface" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <ShoppingCart className="size-6" aria-hidden />
            {count > 0 && (
              <span className="absolute top-0 right-0 grid size-4 place-items-center rounded-full bg-brand text-[10px] font-medium text-primary-foreground" aria-hidden>
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>
          {session ? (
            <div className="flex items-center gap-2">
              {/* Tablet: só ícones (rótulo para leitores de tela), para caber em 768px. */}
              <Button asChild size="sm" variant="ghost" className="max-lg:px-2">
                <Link to="/perfil" aria-label="Perfil">
                  <UserRound data-icon="inline-start" aria-hidden />
                  <span className="max-lg:hidden">Perfil</span>
                </Link>
              </Button>
              <Button size="sm" variant="outline" className="max-lg:px-2" aria-label="Sair" onClick={() => void logout()}>
                <LogOut data-icon="inline-start" aria-hidden />
                <span className="max-lg:hidden">Sair</span>
              </Button>
            </div>
          ) : (
            <Button asChild size="sm" className="w-[100px] font-medium">
              <Link to="/entrar" search={{ redirect: href }}>
                <LogIn data-icon="inline-start" aria-hidden />
                Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
