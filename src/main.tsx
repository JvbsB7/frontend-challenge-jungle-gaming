// Os mocks precisam ser ativados ANTES de carregar a app: o engine.io-client guarda
// o WebSocket global ao ser importado, e o MSW só o substitui em network.enable().
// Ligado por padrão (checkout limpo/deploy de demonstração); desligue com VITE_ENABLE_MOCKS=false.
if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
  const { enableMocks } = await import('./mocks')
  await enableMocks()
}

await import('./app')
