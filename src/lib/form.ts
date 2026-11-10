import { ApiError } from '@/api/client'

export type FieldErrors = Record<string, string | undefined>

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const USERNAME_RE = /^[a-z0-9._]{3,24}$/i

/** Mesmas regras de senha da API, para feedback imediato. */
export function passwordError(password: string): string | undefined {
  if (password.length < 8) return 'Use pelo menos 8 caracteres'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use letras e números'
}

export const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean)

/** Separa erros da API em erros por campo + mensagem geral. */
export function fromApiError(error: unknown): { fields: FieldErrors; message: string } {
  if (error instanceof ApiError) return { fields: error.fields ?? {}, message: error.message }
  return { fields: {}, message: 'Erro inesperado. Tente novamente.' }
}

/** Leva o foco ao primeiro campo inválido (após o React aplicar aria-invalid). */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}
