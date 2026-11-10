import { createFileRoute } from '@tanstack/react-router'
import { AuthScreen } from '@/components/auth/auth-screen'
import { parseRedirect, redirectIfAuthenticated } from '@/lib/require-auth'

export const Route = createFileRoute('/entrar')({
  validateSearch: parseRedirect,
  beforeLoad: redirectIfAuthenticated,
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  return <AuthScreen mode="login" redirect={redirect} />
}
