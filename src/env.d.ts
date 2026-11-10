/// <reference types="vite/client" />
/// <reference types="msw/vite/client" />

interface ImportMetaEnv {
  /** Backend simulado (MSW): ligado por padrão; "false" desliga. */
  readonly VITE_ENABLE_MOCKS?: string
  readonly VITE_SOCKET_URL?: string
}
