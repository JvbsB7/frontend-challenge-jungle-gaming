import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/entrar')({
  validateSearch: (raw: Record<string, unknown>): { redirect?: string } => ({
    // Só caminhos internos: evita open redirect.
    redirect: typeof raw.redirect === 'string' && raw.redirect.startsWith('/') && !raw.redirect.startsWith('//') ? raw.redirect : undefined,
  }),
  component: () => <h1 className="py-10 text-2xl font-bold">Entrar</h1>,
})
