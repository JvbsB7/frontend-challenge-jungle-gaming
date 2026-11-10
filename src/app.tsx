import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createQueryClient, keys } from './api/queries'
import { connectRealtime } from './api/realtime'
import { sessionStore, type StoredSession } from './api/session-store'
import './index.css'
import { routeTree } from './routeTree.gen'

const queryClient = createQueryClient()
const router = createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

let expiryTimer: ReturnType<typeof setTimeout> | undefined

// Expira a sessão localmente no horário informado pela API (a UI redireciona ao login).
function scheduleExpiry(session: StoredSession | null) {
  clearTimeout(expiryTimer)
  if (session) expiryTimer = setTimeout(() => sessionStore.clear('expired'), Math.max(0, Date.parse(session.expiresAt) - Date.now()))
}
/** Inicia a app. Chamado pelo main.tsx só depois que os mocks (se ligados) estão ativos. */
export function startApp() {
  // Um socket por sessão. Ao entrar, sair ou expirar: fecha o socket anterior,
  // descarta todo dado privado do cache e abre um socket novo com o token atual.
  let disconnectRealtime = connectRealtime(queryClient, sessionStore.get())
  scheduleExpiry(sessionStore.get())
  sessionStore.subscribe((session) => {
    disconnectRealtime()
    queryClient.removeQueries({ queryKey: keys.user })
    disconnectRealtime = connectRealtime(queryClient, session)
    scheduleExpiry(session)
  })

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
