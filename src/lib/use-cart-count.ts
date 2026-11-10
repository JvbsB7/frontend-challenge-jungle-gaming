import { useQuery } from '@tanstack/react-query'
import { q } from '@/api/queries'
import { useSession } from './use-session'

export function useCartCount() {
  useSession() // o escopo do carrinho muda com a sessão
  const { data } = useQuery(q.cart())
  return data?.count ?? 0
}
