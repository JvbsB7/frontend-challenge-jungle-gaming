// Os mocks são ativados ANTES de a app iniciar: nenhuma requisição pode escapar do MSW.
// (O socket.io-client só é importado ao conectar; ver api/realtime.ts.)
// Mocks ligados por padrão (checkout limpo/deploy de demonstração); desligue com VITE_ENABLE_MOCKS=false.
if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
  const { enableMocks } = await import('./mocks')
  await enableMocks()
}

const { startApp } = await import('./app')
startApp()
