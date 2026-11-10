import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pedido/$id')({
  component: () => <h1 className="py-10 text-2xl font-bold">Confirmação de pedido</h1>,
})
