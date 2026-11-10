import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/carrinho')({
  component: () => <h1 className="py-10 text-2xl font-bold">Carrinho</h1>,
})
