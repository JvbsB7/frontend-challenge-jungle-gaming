import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { Nft, NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts'
import { SOCKET_URL } from '@/api/socket-url'
import { db, nextEventId, type OrderRecord } from './db'

// Servidor Socket.IO simulado (MSW ws + @mswjs/socket.io-binding).
// O binding não tem rooms: o isolamento por usuário é feito aqui, pelo token do handshake.

interface Connection {
  io: ReturnType<typeof toSocketIo>
  token: string | null
  close: () => void
}

const connections = new Set<Connection>()
type Sent = { name: 'nft.updated'; payload: NftUpdatedEvent } | { name: 'order.updated'; payload: OrderUpdatedEvent }
const history: Sent[] = []

const link = ws.link(`${SOCKET_URL}/*`)

export const realtimeHandler = link.addEventListener('connection', (connection) => {
  const conn: Connection = {
    io: toSocketIo(connection),
    token: connection.client.url.searchParams.get('token'),
    close: () => connection.client.close(),
  }
  connections.add(conn)
  connection.client.addEventListener('close', () => connections.delete(conn))
})

function userIdOf(token: string | null): string | null {
  const session = token ? db().sessions.find((s) => s.token === token && s.expiresAt > Date.now()) : undefined
  return session?.userId ?? null
}

function deliver(sent: Sent): void {
  for (const conn of connections) {
    if (sent.name === 'order.updated' && userIdOf(conn.token) !== sent.payload.userId) continue
    conn.io.client.emit(sent.name, sent.payload)
  }
}

function record(sent: Sent): void {
  history.push(sent)
  if (history.length > 50) history.shift()
  deliver(sent)
}

export function emitNftUpdated(nft: Nft): void {
  record({
    name: 'nft.updated',
    payload: {
      eventId: nextEventId('nft'),
      type: 'nft.updated',
      resource: { type: 'nft', id: nft.id },
      version: nft.version,
      occurredAt: new Date().toISOString(),
      data: structuredClone({ price: nft.price, available: nft.available, editions: nft.editions }),
    },
  })
}

export function emitOrderUpdated(order: OrderRecord): void {
  const { userId, idempotencyKey: _k, fingerprint: _f, settleAt: _s, outcome: _o, ...data } = order
  record({
    name: 'order.updated',
    payload: {
      eventId: nextEventId('order'),
      type: 'order.updated',
      resource: { type: 'order', id: order.id },
      version: order.version,
      occurredAt: new Date().toISOString(),
      userId,
      data: structuredClone(data),
    },
  })
}

/** Reenvia um evento já emitido (0 = último): simula duplicata ou evento antigo fora de ordem. */
export function replayEvent(fromEnd = 0): Sent | undefined {
  const sent = history.at(-1 - fromEnd)
  if (sent) deliver(sent)
  return sent
}

/** Derruba todas as conexões; o socket.io-client reconecta sozinho. */
export function dropConnections(): void {
  for (const conn of connections) conn.close()
}

export const connectionCount = () => connections.size
