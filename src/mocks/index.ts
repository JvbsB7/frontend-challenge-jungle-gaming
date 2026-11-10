import { network } from 'virtual:msw'
import { initDb, resetDb } from './db'
import { expireAllSessions, settleDueOrders, updateEdition } from './domain'
import { httpHandlers } from './http'
import { connectionCount, dropConnections, realtimeHandler, replayEvent } from './realtime'
import { activeFlags, initScenario, SCENARIO_FLAGS, setScenario } from './scenario'

/** Controles do backend simulado, usados pela demo e pelos testes Playwright. */
const controls = {
  scenarios: SCENARIO_FLAGS,
  activeScenario: activeFlags,
  setScenario,
  reset: resetDb,
  expireSessions: expireAllSessions,
  /** Muda preço/estoque no "servidor": atualiza REST e emite nft.updated pelo socket. */
  updateEdition,
  replayEvent,
  dropConnections,
  connectionCount,
  settleNow: () => settleDueOrders(Number.MAX_SAFE_INTEGER),
}

declare global {
  interface Window {
    __kurio?: typeof controls
  }
}

export async function enableMocks(): Promise<void> {
  await initDb()
  const params = new URLSearchParams(location.search)
  if (params.has('mockReset')) await resetDb()
  initScenario(location.search)
  // Parâmetros de controle valem uma vez: limpa a URL para um refresh/redirect não resetar de novo.
  if (params.has('mockReset') || params.has('scenario')) {
    params.delete('mockReset')
    params.delete('scenario')
    const query = params.toString()
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`)
  }
  network.configure({
    handlers: [...httpHandlers, realtimeHandler],
    // Em produção (demo/Lighthouse), sem log por requisição no console: custa CPU e polui o console.
    context: { quiet: !import.meta.env.DEV },
    // Imagens/fontes/assets não têm handler: seguem para a rede sem aviso.
    onUnhandledFrame: 'bypass',
  })
  await network.enable()
  // Liquida pedidos pendentes mesmo sem requisições (emite order.updated).
  setInterval(() => settleDueOrders(), 500)
  window.__kurio = controls
}
