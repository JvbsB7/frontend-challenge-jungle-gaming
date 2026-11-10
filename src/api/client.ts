import axios, { isAxiosError } from 'axios'
import { API_BASE, GUEST_HEADER, type ApiErrorBody, type ApiErrorCode } from './contracts'
import { guestId, sessionStore } from './session-store'

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | 'NETWORK' | 'TIMEOUT' | 'CANCELED'
  readonly fields?: Record<string, string>
  readonly details?: unknown

  constructor(status: number, body: Omit<ApiErrorBody, 'code'> & { code: ApiError['code'] }) {
    super(body.message)
    this.status = status
    this.code = body.code
    this.fields = body.fields
    this.details = body.details
  }

  /** Falhas que valem nova tentativa automática (rede, timeout, 5xx). */
  get transient(): boolean {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.status >= 500
  }
}

export const http = axios.create({ baseURL: API_BASE, timeout: 10_000 })

http.interceptors.request.use((config) => {
  const session = sessionStore.get()
  if (session) config.headers.Authorization = `Bearer ${session.token}`
  // Sempre enviado: identifica o carrinho do visitante e permite a fusão no login.
  config.headers[GUEST_HEADER] = guestId()
  return config
})

http.interceptors.response.use(undefined, (error: unknown) => {
  if (!isAxiosError(error)) throw error
  if (error.code === 'ERR_CANCELED') throw new ApiError(0, { code: 'CANCELED', message: 'Requisição cancelada.' })
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    throw new ApiError(0, { code: 'TIMEOUT', message: 'O servidor demorou para responder.' })
  }
  if (!error.response) throw new ApiError(0, { code: 'NETWORK', message: 'Sem conexão com o servidor.' })
  const body = error.response.data as Partial<ApiErrorBody> | undefined
  const apiError = new ApiError(error.response.status, {
    code: body?.code ?? 'TRANSIENT',
    message: body?.message ?? 'Erro inesperado.',
    fields: body?.fields,
    details: body?.details,
  })
  // Token recusado: encerra a sessão local; a UI redireciona preservando o contexto.
  if (apiError.status === 401 && error.config?.headers?.Authorization) sessionStore.clear('expired')
  throw apiError
})
