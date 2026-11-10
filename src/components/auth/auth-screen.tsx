import { useNavigate, useRouter } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { HomePage } from '@/components/home/home-page'
import { isPrivatePath } from '@/lib/require-auth'
import { useMediaQuery } from '@/lib/use-media-query'
import { AuthForm, type AuthMode } from './auth-form'

const TITLE: Record<AuthMode, string> = { login: 'Entrar', register: 'Criar conta' }
const noop = () => {}

/**
 * Desktop: modal de 500px sobre a página Início (Figma "Sign In/Sign Up Modal").
 * Mobile: tela cheia (Figma "Mobile / Login|Cadastro").
 */
export function AuthScreen({ mode, redirect }: { mode: AuthMode; redirect?: string }) {
  const desktop = useMediaQuery('(min-width: 768px)')
  const navigate = useNavigate()
  const router = useRouter()

  // Fechar sem entrar: destino privado reabriria o login (ciclo). Volta para a página anterior.
  const close = () => {
    if (redirect && !isPrivatePath(redirect)) return void navigate({ to: redirect, replace: true })
    if (router.history.canGoBack()) return router.history.back()
    void navigate({ to: '/', replace: true })
  }

  if (!desktop) return <AuthForm mode={mode} redirect={redirect} />

  return (
    <>
      {/* Fundo decorativo e inerte: a Início sem interação, como no Figma. */}
      <div inert aria-hidden>
        <HomePage search={{}} onChange={noop} />
      </div>
      <DialogPrimitive.Root open onOpenChange={(open) => !open && close()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            // Foco inicial no primeiro campo (não no botão de fechar).
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              ;(e.currentTarget as HTMLElement).querySelector<HTMLInputElement>('input')?.focus()
            }}
            className="fixed top-40 left-1/2 z-50 w-[500px] -translate-x-1/2 overflow-hidden bg-card pt-12 pb-[70px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] outline-none after:absolute after:inset-x-0 after:bottom-0 after:h-2.5 after:bg-primary"
          >
            <DialogPrimitive.Title className="sr-only">{TITLE[mode]}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="absolute top-3 right-4 grid size-8 place-items-center rounded text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <X className="size-5" aria-hidden />
              <span className="sr-only">Fechar</span>
            </DialogPrimitive.Close>
            <AuthForm mode={mode} redirect={redirect} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
