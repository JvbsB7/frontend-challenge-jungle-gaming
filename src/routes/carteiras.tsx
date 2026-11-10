import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/carteiras')({
  component: () => <h1 className="py-10 text-2xl font-bold">Carteiras</h1>,
})
