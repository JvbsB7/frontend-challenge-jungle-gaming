import { createFileRoute } from '@tanstack/react-router'
import { q } from '@/api/queries'
import { PaymentPage } from '@/components/checkout/payment-page'
import { requireAuth } from '@/lib/require-auth'
import { useSession } from '@/lib/use-session'

export const Route = createFileRoute('/pagamento')({
  beforeLoad: requireAuth,
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(q.cart())
    void context.queryClient.prefetchQuery(q.wallets())
    void context.queryClient.prefetchQuery(q.profile())
  },
  component: PaymentRoute,
})

function PaymentRoute() {
  const session = useSession()
  // Sessão expirada no meio: o __root leva ao login e volta para cá com o rascunho preservado.
  if (!session) return null
  return <PaymentPage key={session.userId} userId={session.userId} />
}
