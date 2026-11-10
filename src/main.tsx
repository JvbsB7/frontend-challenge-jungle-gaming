// Os mocks precisam ser ativados ANTES de carregar a app: o engine.io-client guarda
// o WebSocket global ao ser importado, e o MSW só o substitui em network.enable().
if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
  const { enableMocks } = await import('./mocks')
  await enableMocks()
}

await import('./app')
