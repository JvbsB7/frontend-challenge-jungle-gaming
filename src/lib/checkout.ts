import type { BuyerInput, CreateOrderInput, WalletSlot } from '@/api/contracts'

// Estado do checkout fora do React, para sobreviver a refresh, timeout e expiração de sessão.

function readJson<T>(storage: Storage, key: string): T | undefined {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    if (value === undefined) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(value))
  } catch {
    // storage indisponível: segue só em memória
  }
}

/**
 * Chave de idempotência por tentativa. O mesmo conteúdo reaproveita a chave
 * (reenvio após timeout recupera o mesmo pedido); conteúdo novo gera chave nova.
 */
export function idempotencyKeyFor(userId: string, input: CreateOrderInput): string {
  const storageKey = `kurio.checkout.attempt.${userId}`
  const fingerprint = JSON.stringify(input)
  const saved = readJson<{ fingerprint: string; key: string }>(sessionStorage, storageKey)
  if (saved?.fingerprint === fingerprint) return saved.key
  const key = crypto.randomUUID()
  writeJson(sessionStorage, storageKey, { fingerprint, key })
  return key
}

export function clearAttempt(userId: string): void {
  writeJson(sessionStorage, `kurio.checkout.attempt.${userId}`, undefined)
}

/** Pedido pendente do usuário: permite retomar o acompanhamento após refresh/reconexão. */
export const pendingOrder = {
  get: (userId: string) => readJson<string>(localStorage, `kurio.pendingOrder.${userId}`),
  set: (userId: string, orderId: string | undefined) => writeJson(localStorage, `kurio.pendingOrder.${userId}`, orderId),
}

export interface CheckoutDraft {
  buyer: Partial<BuyerInput>
  walletSlot: WalletSlot
}

/** Rascunho do formulário: preserva o que foi digitado se a sessão expirar no meio. */
export const checkoutDraft = {
  get: (userId: string) => readJson<CheckoutDraft>(sessionStorage, `kurio.checkout.draft.${userId}`),
  set: (userId: string, draft: CheckoutDraft | undefined) => writeJson(sessionStorage, `kurio.checkout.draft.${userId}`, draft),
}

/** 0x8ba1…BA72 */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}
