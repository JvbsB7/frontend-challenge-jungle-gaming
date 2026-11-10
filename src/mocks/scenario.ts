import { delay, HttpResponse } from 'msw'
import type { ApiErrorBody } from '@/api/contracts'

// Cenários de rede/falha determinísticos. Selecionados por ?scenario=a,b na URL
// (persistem no localStorage até ?scenario=default) ou por window.__kurio.setScenario().

export const SCENARIO_FLAGS = {
  slow: 'Latência fixa de 2,5 s em todas as chamadas',
  jitter: 'Latência variável (100–1800 ms, semente fixa) → respostas fora de ordem',
  'empty-catalog': 'Catálogo sempre vazio',
  offline: 'Falha de conexão em toda a API',
  'catalog-error': 'GET /api/nfts responde 500',
  flaky: 'Primeira chamada de cada rota responde 503; a seguinte funciona',
  'favorite-fail': 'Incluir/remover favorito responde 500',
  'price-change-on-order': 'Preço sobe ao criar o pedido → 409 QUOTE_OUTDATED',
  'sold-out-on-order': 'Edição esgota ao criar o pedido → 409 OUT_OF_STOCK',
  'order-timeout': 'Pedido é criado, mas a resposta só chega após o timeout do cliente',
  'payment-declined': 'Pagamento recusado na liquidação',
  'wallet-refused': 'A carteira recusa a conexão',
  'short-session': 'Sessões expiram em 30 s',
} as const
export type ScenarioFlag = keyof typeof SCENARIO_FLAGS

const STORAGE_KEY = 'kurio.mock.scenario'
const DEFAULT_LATENCY_MS = 150
const ORDER_TIMEOUT_DELAY_MS = 12_000

let flags = new Set<ScenarioFlag>()
let jitterSeed = 1
const flakySeen = new Set<string>()

function parse(value: string | null): Set<ScenarioFlag> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((f) => f.trim())
      .filter((f): f is ScenarioFlag => f in SCENARIO_FLAGS),
  )
}

export function initScenario(search: string): void {
  const fromUrl = new URLSearchParams(search).get('scenario')
  if (fromUrl !== null) setScenario(fromUrl)
  else {
    try {
      flags = parse(localStorage.getItem(STORAGE_KEY))
    } catch {
      flags = new Set()
    }
  }
}

export function setScenario(value: string): void {
  flags = parse(value)
  jitterSeed = 1
  flakySeen.clear()
  consumed.clear()
  try {
    if (flags.size) localStorage.setItem(STORAGE_KEY, [...flags].join(','))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // sem storage: vale só para esta página
  }
}

export const has = (flag: ScenarioFlag) => flags.has(flag)

const consumed = new Set<ScenarioFlag>()
/** true só na primeira vez após ativar o cenário (ex.: preço muda uma única vez). */
export function once(flag: ScenarioFlag): boolean {
  if (!flags.has(flag) || consumed.has(flag)) return false
  consumed.add(flag)
  return true
}
export const activeFlags = () => [...flags]
export const orderTimeoutDelay = () => ORDER_TIMEOUT_DELAY_MS

// mulberry32: sequência pseudoaleatória reproduzível.
function nextJitter(): number {
  let t = (jitterSeed += 0x6d2b79f5)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return Math.round(100 + r * 1700)
}

export function errorResponse(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status })
}

/**
 * Aplica latência e falhas do cenário. Retorna uma resposta para encerrar
 * a requisição, ou undefined para seguir para o handler.
 */
export async function applyNetwork(request: Request, routeKey: string) {
  await delay(has('slow') ? 2500 : has('jitter') ? nextJitter() : DEFAULT_LATENCY_MS)
  if (has('offline')) return HttpResponse.error()
  if (has('catalog-error') && routeKey === 'GET /api/nfts') {
    return errorResponse(500, { code: 'TRANSIENT', message: 'Falha temporária ao carregar o catálogo.' })
  }
  if (has('flaky') && !flakySeen.has(routeKey)) {
    flakySeen.add(routeKey)
    return errorResponse(503, { code: 'TRANSIENT', message: 'Serviço indisponível. Tente novamente.' })
  }
  if (has('favorite-fail') && routeKey.endsWith('/api/me/favorites/:nftId') && request.method !== 'GET') {
    return errorResponse(500, { code: 'TRANSIENT', message: 'Não foi possível atualizar o favorito.' })
  }
  return undefined
}
