import { ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { NETWORKS, WALLET_PROVIDERS, type BuyerInput } from '@/api/contracts'
import { FormField } from '@/components/form-field'
import type { BuyerValues } from '@/lib/buyer-validation'
import type { FieldErrors } from '@/lib/form'
import { NETWORK_LABEL, PROVIDER_LABEL } from '@/lib/labels'

const field =
  'h-10 w-full rounded-[3px] border border-input bg-transparent px-3 text-sm outline-none placeholder:text-subtle focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive'

function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select {...props} className={cn(field, 'appearance-none pr-9 text-subtle has-[option:checked:not([value=""])]:text-foreground', className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  )
}

interface Props {
  values: BuyerValues
  errors: FieldErrors
  onChange: (patch: BuyerValues) => void
}

export function BuyerForm({ values, errors, onChange }: Props) {
  const text = (name: keyof BuyerInput) => ({
    value: (values[name] as string | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ [name]: e.target.value }),
  })
  return (
    <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
      <FormField name="displayName" label="Nome de exibição" required error={errors.displayName}>
        {(p) => <input {...p} {...text('displayName')} autoComplete="name" className={field} />}
      </FormField>
      <FormField name="username" label="Nome de usuário" required error={errors.username}>
        {(p) => <input {...p} {...text('username')} autoComplete="username" className={field} />}
      </FormField>
      <FormField name="network" label="Rede" required error={errors.network}>
        {(p) => (
          <Select {...p} value={values.network ?? ''} onChange={(e) => onChange({ network: (e.target.value || undefined) as BuyerInput['network'] })}>
            <option value="">Selecione uma rede</option>
            {NETWORKS.map((n) => (
              <option key={n} value={n} className="bg-card text-foreground">
                {NETWORK_LABEL[n]}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField name="profileName" label="Nome do perfil" required error={errors.profileName}>
        {(p) => <input {...p} {...text('profileName')} className={field} />}
      </FormField>
      <FormField name="address" label="Endereço da carteira" required error={errors.address}>
        {(p) => <input {...p} {...text('address')} placeholder="Endereço 0x da carteira" spellCheck={false} className={cn(field, 'font-mono')} />}
      </FormField>
      <FormField name="secondaryAddress" label="ENS ou carteira secundária (opcional)" hideLabel error={errors.secondaryAddress} className="sm:mt-6">
        {(p) => <input {...p} {...text('secondaryAddress')} placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} className={field} />}
      </FormField>
      <FormField name="provider" label="Tipo de carteira" required error={errors.provider}>
        {(p) => (
          <Select {...p} value={values.provider ?? ''} onChange={(e) => onChange({ provider: (e.target.value || undefined) as BuyerInput['provider'] })}>
            <option value="">Selecione uma carteira</option>
            {WALLET_PROVIDERS.map((w) => (
              <option key={w} value={w} className="bg-card text-foreground">
                {PROVIDER_LABEL[w]}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField name="referralCode" label="Código de indicação" required error={errors.referralCode}>
        {(p) => <input {...p} {...text('referralCode')} className={field} />}
      </FormField>
      <FormField name="email" label="E-mail" required error={errors.email}>
        {(p) => <input {...p} {...text('email')} type="email" autoComplete="email" className={field} />}
      </FormField>
      <FormField name="ensName" label="Nome ENS" required error={errors.ensName}>
        {(p) => (
          <div className="flex items-center gap-2">
            <input {...p} {...text('ensName')} spellCheck={false} className={cn(field, 'max-w-[220px]')} />
            <span className="flex h-10 items-center rounded-[3px] border border-input px-3 text-sm" aria-hidden>
              .eth
            </span>
          </div>
        )}
      </FormField>
      <FormField name="note" label="Observação do colecionador (opcional)" className="sm:col-span-2 sm:max-w-[254px]">
        {(p) => <textarea {...p} {...text('note')} rows={5} maxLength={500} className={cn(field, 'h-[110px] resize-none py-2')} />}
      </FormField>
    </div>
  )
}
