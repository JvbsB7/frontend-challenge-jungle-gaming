import { Link, useLocation } from '@tanstack/react-router'
import { Heart, House, ScanLine, ShoppingCart, UserRound } from 'lucide-react'
import { useCartCount } from '@/lib/use-cart-count'
import { useSession } from '@/lib/use-session'

const item = 'grid size-12 place-items-center rounded-full text-primary aria-[current=page]:text-brand focus-visible:ring-3 focus-visible:ring-ring/50'

/** Barra inferior do layout mobile (Figma "Mobile / Início"). */
export function MobileNav() {
  const count = useCartCount()
  const session = useSession()
  const { pathname } = useLocation()
  // Detalhe, carrinho e pagamento têm barras/resumos próprios no lugar da navegação (Figma).
  if (['/nft/', '/carrinho', '/pagamento'].some((p) => pathname.startsWith(p))) return null
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto flex h-[72px] max-w-[480px] items-center justify-between rounded-t-[28px] bg-card px-6 shadow-[0_-8px_24px_rgba(10,6,4,0.5)]">
        <Link to="/" className={item} aria-label="Início" activeOptions={{ exact: true, includeSearch: false }} activeProps={{ 'aria-current': 'page' }}>
          <House className="size-6" aria-hidden />
        </Link>
        <Link to="/" search={{ favorites: true }} className={item} aria-label="Favoritos">
          <Heart className="size-6" aria-hidden fill="currentColor" />
        </Link>
        <Link
          to="/"
          hash="catalogo"
          aria-label="Explorar catálogo"
          className="-mt-12 grid size-16 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-foreground shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ScanLine className="size-7" aria-hidden />
        </Link>
        <Link to="/carrinho" className={`${item} relative`} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} activeProps={{ 'aria-current': 'page' }}>
          <ShoppingCart className="size-6" aria-hidden />
          {count > 0 && (
            <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-brand text-[10px] font-medium text-primary-foreground" aria-hidden>
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Link>
        <Link to={session ? '/perfil' : '/entrar'} className={item} aria-label={session ? 'Perfil' : 'Entrar'} activeProps={{ 'aria-current': 'page' }}>
          <UserRound className="size-6" aria-hidden fill="currentColor" />
        </Link>
      </div>
    </nav>
  )
}
