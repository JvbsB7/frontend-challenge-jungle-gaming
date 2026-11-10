import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'
import type { Session } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { sessionStore } from '@/api/session-store'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { EMAIL_RE, focusFirstInvalid, fromApiError, hasErrors, passwordError, USERNAME_RE, type FieldErrors } from '@/lib/form'
import { FacebookIcon, GoogleIcon } from './brand-icons'
import { PasswordInput } from './password-input'

export type AuthMode = 'login' | 'register'

const COPY: Record<AuthMode, { mobileTitle: string; subtitle: string; submit: string; mobileSubmit: string; pending: string }> = {
  login: {
    mobileTitle: 'Entrar',
    subtitle: 'Entre para gerenciar sua carteira, coleção e perfil de criador.',
    submit: 'Entrar',
    mobileSubmit: 'Entrar',
    pending: 'Entrando…',
  },
  register: {
    mobileTitle: 'Criar perfil de colecionador',
    subtitle: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
    submit: 'Criar conta',
    mobileSubmit: 'Criar perfil',
    pending: 'Criando…',
  },
}

// Figma: campos sem rótulo visível (só placeholder). O rótulo existe para leitores de tela.
const fieldClass =
  'h-10 w-full rounded-[3px] border border-input bg-transparent px-4 text-sm outline-none placeholder:text-subtle focus-visible:border-primary aria-invalid:border-destructive max-md:h-[50px] max-md:rounded-[10px] max-md:border-transparent max-md:bg-card max-md:focus-visible:border-primary max-md:aria-invalid:border-destructive'

function validate(mode: AuthMode, values: Record<string, string>): FieldErrors {
  const errors: FieldErrors = {
    email: !values.email ? 'Informe seu e-mail' : EMAIL_RE.test(values.email) ? undefined : 'E-mail inválido',
    password: !values.password ? 'Informe sua senha' : mode === 'register' ? passwordError(values.password) : undefined,
  }
  if (mode === 'register') {
    errors.username = !values.username ? 'Informe um nome de usuário' : USERNAME_RE.test(values.username) ? undefined : 'Use 3 a 24 letras, números, ponto ou _'
    errors.confirm = values.confirm !== values.password ? 'As senhas não conferem' : undefined
  }
  return errors
}

function SocialButtons() {
  // Login social está fora do escopo: avisa em vez de simular sucesso.
  const unavailable = (name: string) => toast.info(`Login com ${name} não está disponível nesta demonstração. Use e-mail e senha.`)
  const providers = [
    { name: 'Google', icon: <GoogleIcon /> },
    { name: 'Facebook', icon: <FacebookIcon /> },
  ]
  return (
    <div className="flex flex-col gap-3">
      {providers.map((p) => (
        <button
          key={p.name}
          type="button"
          onClick={() => unavailable(p.name)}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-[3px] border border-input text-[13px] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none hover:bg-surface max-md:h-[50px] max-md:rounded-[10px] max-md:border-transparent max-md:bg-card"
        >
          {p.icon}
          Continuar com {p.name}
        </button>
      ))}
    </div>
  )
}

export function AuthForm({ mode, redirect }: { mode: AuthMode; redirect?: string }) {
  const copy = COPY[mode]
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState({ username: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()

  const submit = useMutation({
    mutationFn: (): Promise<Session> =>
      mode === 'login'
        ? api.login({ email: values.email.trim(), password: values.password })
        : api.register({ username: values.username.trim(), email: values.email.trim(), password: values.password }),
    onSuccess: (session) => {
      sessionStore.set(session)
      toast.success(mode === 'login' ? `Bem-vindo de volta, ${session.user.displayName}!` : 'Conta criada com sucesso!')
      // Volta ao fluxo anterior (ex.: checkout) ou ao início.
      void navigate({ to: redirect ?? '/', replace: true })
    },
    onError: (error) => {
      const { fields, message } = fromApiError(error)
      setErrors(fields)
      setFormError(message)
      focusFirstInvalid(formRef.current)
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const next = validate(mode, values)
    setErrors(next)
    setFormError(undefined)
    if (hasErrors(next)) return focusFirstInvalid(formRef.current)
    submit.mutate()
  }

  const bind = (name: keyof typeof values) => ({
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [name]: e.target.value }))
      if (errors[name]) setErrors((x) => ({ ...x, [name]: undefined }))
    },
  })

  return (
    <div className="flex flex-col">
      {/* Mobile: logotipo + título (Figma "Mobile / Login|Cadastro") */}
      <div className="flex flex-col items-center gap-10 pt-14 pb-10 md:hidden">
        <p className="text-4xl font-bold tracking-[3px]" aria-hidden>
          KURIO
        </p>
        <h1 className="text-xl font-bold">{copy.mobileTitle}</h1>
      </div>

      {/* Desktop: abas Entrar | Criar conta + subtítulo */}
      <div className="hidden flex-col items-center gap-10 px-12 pb-6 md:flex">
        <nav aria-label="Acesso à conta" className="flex items-center gap-2 text-lg">
          <Link
            to="/entrar"
            search={{ redirect }}
            replace
            className={cn(mode === 'login' ? 'text-brand' : 'hover:text-brand')}
            aria-current={mode === 'login' ? 'page' : undefined}
          >
            Entrar
          </Link>
          <span className="h-5 w-px bg-primary" aria-hidden />
          <Link
            to="/cadastro"
            search={{ redirect }}
            replace
            className={cn(mode === 'register' ? 'text-brand' : 'hover:text-brand')}
            aria-current={mode === 'register' ? 'page' : undefined}
          >
            Criar conta
          </Link>
        </nav>
        <p className="text-center text-[13px] leading-4">{copy.subtitle}</p>
      </div>

      <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-3 md:px-20">
        {formError && (
          <p role="alert" className="rounded-[3px] border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        {mode === 'register' && (
          <FormField name="username" label="Nome de usuário" error={errors.username} hideLabel className="gap-1">
            {(p) => <input {...p} {...bind('username')} autoComplete="username" placeholder="Nome de usuário" className={fieldClass} />}
          </FormField>
        )}
        <FormField name="email" label="E-mail" error={errors.email} hideLabel className="gap-1">
          {(p) => (
            <input
              {...p}
              {...bind('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={mode === 'login' ? 'contato@email.com' : 'Digite seu e-mail'}
              className={fieldClass}
            />
          )}
        </FormField>
        <FormField name="password" label="Senha" error={errors.password} hideLabel className="gap-1">
          {(p) => (
            <PasswordInput {...p} {...bind('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Senha" className={fieldClass} />
          )}
        </FormField>
        {mode === 'register' && (
          <FormField name="confirm" label="Confirmar senha" error={errors.confirm} hideLabel className="gap-1">
            {(p) => <input {...p} {...bind('confirm')} type="password" autoComplete="new-password" placeholder="Confirmar senha" className={fieldClass} />}
          </FormField>
        )}
        {mode === 'login' && (
          <button type="button" className="self-end text-sm text-brand hover:underline" onClick={() => toast.info('Recuperação de senha não faz parte desta demonstração.')}>
            Esqueceu a senha?
          </button>
        )}
        <Button
          type="submit"
          disabled={submit.isPending}
          className="mt-4 h-[45px] w-full rounded-[3px] text-base max-md:mt-6 max-md:h-[60px] max-md:rounded-full max-md:bg-gradient-to-r max-md:from-primary max-md:to-primary/80"
        >
          <span className="max-md:hidden">{submit.isPending ? copy.pending : copy.submit}</span>
          <span className="md:hidden">{submit.isPending ? copy.pending : copy.mobileSubmit}</span>
        </Button>
      </form>

      <div className="mt-8 flex flex-col gap-5 md:mt-4 md:gap-3">
        {/* Linha de largura total com o texto por cima (Figma). */}
        <p className="relative text-center text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-input max-md:before:inset-x-4">
          <span className="relative bg-background px-2 md:bg-card">Ou continue com</span>
        </p>
        <div className="md:px-20">
          <SocialButtons />
        </div>
      </div>

      <p className="mt-10 text-center text-sm md:hidden">
        {mode === 'login' ? 'Novo na Kurio? ' : 'Já tem uma conta? '}
        <Link to={mode === 'login' ? '/cadastro' : '/entrar'} search={{ redirect }} replace className="font-bold text-brand hover:underline">
          {mode === 'login' ? 'Crie uma conta' : 'Entre'}
        </Link>
      </p>
    </div>
  )
}
