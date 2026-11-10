import { useSyncExternalStore } from 'react'

// Cupom aplicado no carrinho: persiste no refresh e segue para o pagamento.
// A validade é sempre conferida pela API na cotação.
const KEY = 'kurio.coupon'
const listeners = new Set<() => void>()

function read(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

let current = read()

export function setCoupon(code: string | undefined): void {
  current = code
  try {
    if (code) localStorage.setItem(KEY, code)
    else localStorage.removeItem(KEY)
  } catch {
    // só em memória
  }
  listeners.forEach((l) => l())
}

export function useCoupon(): string | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
