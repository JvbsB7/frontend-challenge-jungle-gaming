import type { Session } from './contracts'

// Sessão persistida no localStorage (sobrevive a refresh). Só guarda token,
// validade e id do usuário; o perfil vem da API.

export interface StoredSession {
  token: string
  expiresAt: string
  userId: string
}

const SESSION_KEY = 'kurio.session'
const GUEST_KEY = 'kurio.guest'

type Listener = (session: StoredSession | null, reason: 'login' | 'logout' | 'expired') => void
const listeners = new Set<Listener>()

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    const session = raw ? (JSON.parse(raw) as StoredSession) : null
    // Sessão vencida enquanto a aba estava fechada: começa deslogado.
    return session && Date.parse(session.expiresAt) > Date.now() ? session : null
  } catch {
    return null
  }
}

let current = read()

function write(next: StoredSession | null, reason: 'login' | 'logout' | 'expired'): void {
  current = next
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // sem storage: sessão só em memória
  }
  listeners.forEach((l) => l(next, reason))
}

export const sessionStore = {
  get: () => current,
  set: (session: Session) => write({ token: session.token, expiresAt: session.expiresAt, userId: session.user.id }, 'login'),
  clear: (reason: 'logout' | 'expired' = 'logout') => {
    if (current) write(null, reason)
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function guestId(): string {
  try {
    let id = localStorage.getItem(GUEST_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(GUEST_KEY, id)
    }
    return id
  } catch {
    return 'guest-no-storage'
  }
}
