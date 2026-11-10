import { createFileRoute } from '@tanstack/react-router'
import { AuthScreen } from '@/components/auth/auth-screen'
import { parseRedirect, redirectIfAuthenticated } from '@/lib/require-auth'

export const Route = createFileRoute('/cadastro')({
  validateSearch: parseRedirect,
  beforeLoad: redirectIfAuthenticated,
  component: RegisterPage,
})

function RegisterPage() {
  const { redirect } = Route.useSearch()
  return <AuthScreen mode="register" redirect={redirect} />
}
