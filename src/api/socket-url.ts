// Host fictício: só existe enquanto os mocks (MSW) estão ativos.
export const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.mock'
