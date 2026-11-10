/// <reference types="vite/client" />
/// <reference types="msw/vite/client" />

interface ImportMetaEnv {
  /** "true" liga o backend simulado (MSW) — padrão em dev e no build de demonstração. */
  readonly VITE_ENABLE_MOCKS?: string
  readonly VITE_SOCKET_URL?: string
}
