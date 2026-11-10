import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/require-auth'

export const Route = createFileRoute('/pagamento')({
  beforeLoad: requireAuth,
  component: () => <h1 className="py-10 text-2xl font-bold">Pagamento</h1>,
})
