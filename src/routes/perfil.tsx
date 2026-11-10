import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/require-auth'

export const Route = createFileRoute('/perfil')({
  beforeLoad: requireAuth,
  component: () => <h1 className="py-10 text-2xl font-bold">Perfil do colecionador</h1>,
})
