import type { Eth } from '@/api/contracts'

// Aritmética de ETH em wei (BigInt) para não perder precisão com number.
const DECIMALS = 18
const UNIT = 10n ** BigInt(DECIMALS)
const ETH_RE = /^\d+(\.\d{1,18})?$/

export function isEth(value: string): boolean {
  return ETH_RE.test(value)
}

export function toWei(eth: Eth): bigint {
  if (!isEth(eth)) throw new Error(`Valor ETH inválido: ${eth}`)
  const [int, frac = ''] = eth.split('.')
  return BigInt(int) * UNIT + BigInt(frac.padEnd(DECIMALS, '0'))
}

/** Converte wei em string decimal sem zeros à direita, com pelo menos `minDecimals` casas. */
export function fromWei(wei: bigint, minDecimals = 2): Eth {
  if (wei < 0n) throw new Error('Valor ETH negativo')
  const int = wei / UNIT
  let frac = (wei % UNIT).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, '0')
  return frac ? `${int}.${frac}` : int.toString()
}

export function sumEth(values: Eth[]): Eth {
  return fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
}

export function mulEth(eth: Eth, quantity: number): Eth {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error(`Quantidade inválida: ${quantity}`)
  return fromWei(toWei(eth) * BigInt(quantity))
}

/** Percentual inteiro de um valor, arredondado para baixo no wei. */
export function percentOf(eth: Eth, percent: number): Eth {
  return fromWei((toWei(eth) * BigInt(percent)) / 100n)
}

export function subEth(a: Eth, b: Eth): Eth {
  const diff = toWei(a) - toWei(b)
  return fromWei(diff < 0n ? 0n : diff)
}

export function compareEth(a: Eth, b: Eth): number {
  const d = toWei(a) - toWei(b)
  return d === 0n ? 0 : d > 0n ? 1 : -1
}

export function formatEth(eth: Eth): string {
  return `${eth} ETH`
}
