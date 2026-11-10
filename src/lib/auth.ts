import { api } from '@/api/endpoints'
import { sessionStore } from '@/api/session-store'

/** Encerra a sessão na API e localmente (o app.tsx limpa cache e socket). */
export async function logout() {
  try {
    await api.logout()
  } finally {
    sessionStore.clear('logout')
  }
}
