import type { Nft, Order, User, Wallet } from '@/api/contracts'
import { createNftFixtures, FIXTURE_USERS } from './fixtures'

// "Banco" do backend simulado. Vive no localStorage para sobreviver a refresh;
// resetDb() restaura o cenário conhecido das fixtures.

export interface UserRecord extends User {
  salt: string
  passwordHash: string
}

export interface SessionRecord {
  token: string
  userId: string
  expiresAt: number
}

export interface CartLineRecord {
  nftId: string
  editionId: string
  quantity: number
}

export interface OrderRecord extends Order {
  userId: string
  idempotencyKey: string
  /** Impressão digital do corpo; mesma chave + corpo diferente = conflito. */
  fingerprint: string
  /** Momento em que a simulação liquida o pedido (sobrevive a refresh). */
  settleAt: number
  outcome: 'confirmed' | 'declined'
}

export interface DbState {
  nfts: Nft[]
  users: UserRecord[]
  sessions: SessionRecord[]
  favorites: Record<string, string[]>
  /** Chave: "user:<id>" ou "guest:<id>". */
  carts: Record<string, CartLineRecord[]>
  cartVersions: Record<string, number>
  wallets: Record<string, Wallet[]>
  orders: OrderRecord[]
  eventSeq: number
}

const STORAGE_KEY = 'kurio.mock.db.v1'

let state: DbState | undefined

export async function hashPassword(password: string, salt: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function newSalt(): string {
  return crypto.randomUUID()
}

async function seed(): Promise<DbState> {
  const users = await Promise.all(
    FIXTURE_USERS.map(async ({ password, ...user }) => {
      const salt = `seed-${user.id}`
      return { ...user, salt, passwordHash: await hashPassword(password, salt) }
    }),
  )
  return {
    nfts: createNftFixtures(),
    users,
    sessions: [],
    favorites: { 'user-ana': ['nft-001', 'nft-006'] },
    carts: {},
    cartVersions: {},
    wallets: {
      'user-ana': [
        {
          slot: 'primary',
          displayName: 'Ana Souza',
          nickname: 'Cofre da Ana',
          network: 'ethereum',
          profileName: 'ana.colecionadora',
          address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
          provider: 'metamask',
          referralCode: 'KURIO-ANA',
          email: 'ana@kurio.test',
          ensName: 'anasouza',
          updatedAt: '2026-10-01T12:00:00.000Z',
        },
      ],
    },
    orders: [],
    eventSeq: 0,
  }
}

export async function initDb(): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      state = JSON.parse(raw) as DbState
      return
    }
  } catch {
    // dados corrompidos → reseed
  }
  await resetDb()
}

export async function resetDb(): Promise<void> {
  state = await seed()
  commit()
}

export function db(): DbState {
  if (!state) throw new Error('Mock DB não inicializado (chame initDb)')
  return state
}

export function commit(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage cheio/bloqueado: mantém só em memória
  }
}

export function nextEventId(prefix: string): string {
  const s = db()
  s.eventSeq += 1
  return `${prefix}-${s.eventSeq}`
}
