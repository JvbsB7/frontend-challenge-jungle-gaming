import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cadastro')({
  component: () => <h1 className="py-10 text-2xl font-bold">Criar conta</h1>,
})
