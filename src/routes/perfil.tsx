import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ImageIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { User } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { keys, q, scope } from '@/api/queries'
import { AccountLayout } from '@/components/account/account-layout'
import { PasswordInput } from '@/components/auth/password-input'
import { EnsInput, fieldClass } from '@/components/checkout/buyer-form'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { EMAIL_RE, focusFirstInvalid, fromApiError, hasErrors, passwordError, USERNAME_RE, type FieldErrors } from '@/lib/form'
import { requireAuth } from '@/lib/require-auth'

export const Route = createFileRoute('/perfil')({
  beforeLoad: requireAuth,
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(q.profile())
  },
  component: ProfilePage,
})

const MAX_AVATAR_BYTES = 500 * 1024

type ProfileValues = { displayName: string; username: string; email: string; ensName: string; walletNickname: string }
type PasswordValues = { currentPassword: string; newPassword: string; confirm: string }

function validate(p: ProfileValues, pw: PasswordValues): FieldErrors {
  const changingPassword = !!(pw.currentPassword || pw.newPassword || pw.confirm)
  return {
    displayName: p.displayName.trim() ? undefined : 'Informe o nome de exibição',
    username: USERNAME_RE.test(p.username.trim()) ? undefined : 'Use 3 a 24 letras, números, ponto ou _',
    email: EMAIL_RE.test(p.email.trim()) ? undefined : 'E-mail inválido',
    ensName: /^[a-z0-9-]{3,63}$/.test(p.ensName.trim().replace(/\.eth$/, '')) ? undefined : 'Nome ENS inválido',
    walletNickname: p.walletNickname.trim() ? undefined : 'Informe o apelido da carteira',
    currentPassword: changingPassword && !pw.currentPassword ? 'Informe a senha atual' : undefined,
    newPassword: changingPassword ? passwordError(pw.newPassword) : undefined,
    confirm: changingPassword && pw.confirm !== pw.newPassword ? 'As senhas não conferem' : undefined,
  }
}

function Avatar({ user }: { user: User }) {
  const client = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string>()
  const update = useMutation({
    mutationFn: (dataUrl: string | null) => api.updateAvatar({ dataUrl }),
    onSuccess: (updated, dataUrl) => {
      client.setQueryData(keys.profile(scope()), updated)
      setError(undefined)
      toast.success(dataUrl ? 'Avatar atualizado.' : 'Avatar removido.')
    },
    onError: (e) => setError(fromApiError(e).fields.avatar ?? fromApiError(e).message),
  })

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('Use uma imagem PNG, JPEG ou WebP')
    if (file.size > MAX_AVATAR_BYTES) return setError('A imagem deve ter no máximo 500 KB')
    const reader = new FileReader()
    reader.onload = () => update.mutate(String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm" id="avatar-label">
        Avatar
      </span>
      <div className="flex items-center gap-6">
        <span className="grid size-[50px] place-items-center overflow-hidden rounded-full border border-border bg-card">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="Seu avatar" className="size-full object-cover" /> : <ImageIcon className="size-6 text-primary" aria-label="Sem avatar" />}
        </span>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-labelledby="avatar-label" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button type="button" size="sm" className="w-[98px] rounded-[3px] text-sm" disabled={update.isPending} onClick={() => input.current?.click()}>
          {update.isPending ? '…' : 'Alterar'}
        </Button>
        <button type="button" className="text-sm hover:text-brand disabled:opacity-50" disabled={!user.avatarUrl || update.isPending} onClick={() => update.mutate(null)}>
          Remover
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function ProfileForm({ user }: { user: User }) {
  const client = useQueryClient()
  const ref = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<ProfileValues>({
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    ensName: user.ensName ?? '',
    walletNickname: user.walletNickname ?? '',
  })
  const [pw, setPw] = useState<PasswordValues>({ currentPassword: '', newPassword: '', confirm: '' })
  const [errors, setErrors] = useState<FieldErrors>({})

  const save = useMutation({
    mutationFn: async () => {
      const updated = await api.updateProfile(values)
      client.setQueryData(keys.profile(scope()), updated)
      if (pw.newPassword) await api.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword })
      return !!pw.newPassword
    },
    onSuccess: (passwordChanged) => {
      setPw({ currentPassword: '', newPassword: '', confirm: '' })
      toast.success(passwordChanged ? 'Perfil e senha atualizados.' : 'Perfil atualizado.')
    },
    onError: (e) => {
      const { fields, message } = fromApiError(e)
      setErrors(fields)
      toast.error(message)
      focusFirstInvalid(ref.current)
    },
  })

  const bind = (name: keyof ProfileValues) => ({
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [name]: e.target.value }))
      setErrors((x) => ({ ...x, [name]: undefined }))
    },
  })
  const bindPw = (name: keyof PasswordValues) => ({
    value: pw[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setPw((v) => ({ ...v, [name]: e.target.value }))
      setErrors((x) => ({ ...x, [name]: undefined }))
    },
  })

  return (
    <form
      ref={ref}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const next = validate(values, pw)
        setErrors(next)
        if (hasErrors(next)) return focusFirstInvalid(ref.current)
        save.mutate()
      }}
      className="flex flex-col gap-8 [&_label]:text-sm"
    >
      <div className="grid gap-x-7 gap-y-6 sm:grid-cols-2 sm:gap-y-9 [&>div]:sm:gap-4">
        <FormField name="displayName" label="Nome de exibição" required error={errors.displayName}>
          {(p) => <input {...p} {...bind('displayName')} autoComplete="name" className={fieldClass} />}
        </FormField>
        <FormField name="username" label="Nome de usuário" required error={errors.username}>
          {(p) => <input {...p} {...bind('username')} autoComplete="username" className={fieldClass} />}
        </FormField>
        <FormField name="email" label="E-mail" required error={errors.email}>
          {(p) => <input {...p} {...bind('email')} type="email" autoComplete="email" className={fieldClass} />}
        </FormField>
        <FormField name="ensName" label="Nome ENS" required error={errors.ensName}>
          {(p) => <EnsInput {...p} {...bind('ensName')} suffixFirst />}
        </FormField>
        <FormField name="walletNickname" label="Apelido da carteira" required error={errors.walletNickname}>
          {(p) => <input {...p} {...bind('walletNickname')} className={fieldClass} />}
        </FormField>
        <Avatar user={user} />
      </div>

      <fieldset className="flex flex-col gap-4 sm:max-w-[calc(50%-14px)]">
        <legend className="mb-4 text-base font-bold">Alterar senha</legend>
        <FormField name="currentPassword" label="Senha atual" error={errors.currentPassword}>
          {(p) => <PasswordInput {...p} {...bindPw('currentPassword')} autoComplete="current-password" className={fieldClass} />}
        </FormField>
        <FormField name="newPassword" label="Nova senha" error={errors.newPassword}>
          {(p) => <PasswordInput {...p} {...bindPw('newPassword')} autoComplete="new-password" className={fieldClass} />}
        </FormField>
        <FormField name="confirm" label="Confirmar nova senha" error={errors.confirm}>
          {(p) => <PasswordInput {...p} {...bindPw('confirm')} autoComplete="new-password" className={fieldClass} />}
        </FormField>
      </fieldset>

      <Button type="submit" disabled={save.isPending} className="w-[131px] rounded-[3px] text-sm">
        {save.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function ProfilePage() {
  const { data: user, isPending, error, refetch } = useQuery(q.profile())
  return (
    <AccountLayout>
      <h1 className="mb-8 text-base font-bold">Perfil do colecionador</h1>
      {isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando perfil">
          <div className="skeleton h-[300px] rounded" />
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-md bg-card p-6">
          <p className="font-bold">Não foi possível carregar seu perfil.</p>
          <Button onClick={() => void refetch()}>Tentar novamente</Button>
        </div>
      ) : (
        <ProfileForm key={user.id} user={user} />
      )}
    </AccountLayout>
  )
}
