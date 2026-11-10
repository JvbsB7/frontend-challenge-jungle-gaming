import { useSyncExternalStore } from 'react'
import { sessionStore } from '@/api/session-store'

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
}
