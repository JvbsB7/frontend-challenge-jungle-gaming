import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/require-auth'

export const Route = createFileRoute('/carteiras')({
  beforeLoad: requireAuth,
  component: () => <h1 className="py-10 text-2xl font-bold">Carteiras</h1>,
})
