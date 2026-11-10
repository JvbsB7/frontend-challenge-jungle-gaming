import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/perfil')({
  component: () => <h1 className="py-10 text-2xl font-bold">Perfil do colecionador</h1>,
})
