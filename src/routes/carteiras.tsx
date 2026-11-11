import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Wallet, WalletInput, WalletSlot } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { keys, q, scope } from '@/api/queries'
import { AccountLayout } from '@/components/account/account-layout'
import { BuyerForm } from '@/components/checkout/buyer-form'
import { Button } from '@/components/ui/button'
import { validateWallet, type BuyerValues } from '@/lib/buyer-validation'
import { focusFirstInvalid, fromApiError, hasErrors, type FieldErrors } from '@/lib/form'
import { requireAuth } from '@/lib/require-auth'

export const Route = createFileRoute('/carteiras')({
  beforeLoad: requireAuth,
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(q.wallets())
  },
  component: WalletsPage,
})

function toValues(wallet?: Wallet): BuyerValues {
  if (!wallet) return {}
  const { slot: _s, updatedAt: _u, ...fields } = wallet
  return fields
}

function WalletForm({ slot, wallet, initial, onSaved }: { slot: WalletSlot; wallet?: Wallet; initial?: BuyerValues; onSaved?: () => void }) {
  const client = useQueryClient()
  const ref = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<BuyerValues>(initial ?? toValues(wallet))
  const [errors, setErrors] = useState<FieldErrors>({})

  const save = useMutation({
    mutationFn: () => api.saveWallet(slot, values as WalletInput),
    onSuccess: (saved) => {
      client.setQueryData<Wallet[]>(keys.wallets(scope()), (old = []) =>
        [...old.filter((w) => w.slot !== slot), saved].sort((a) => (a.slot === 'primary' ? -1 : 1)),
      )
      toast.success(slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
      onSaved?.()
    },
    onError: (error) => {
      const { fields, message } = fromApiError(error)
      setErrors(fields)
      toast.error(message)
      focusFirstInvalid(ref.current)
    },
  })

  return (
    <form
      ref={ref}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const next = validateWallet(values)
        setErrors(next)
        if (hasErrors(next)) return focusFirstInvalid(ref.current)
        save.mutate()
      }}
      className="flex flex-col gap-8 [&_label]:text-sm"
    >
      <BuyerForm
        variant="wallet"
        values={values}
        errors={errors}
        onChange={(patch) => {
          setValues((v) => ({ ...v, ...patch }))
          setErrors((x) => ({ ...x, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }))
        }}
      />
      <Button type="submit" disabled={save.isPending} className="w-fit rounded-[3px] px-1 text-sm">
        {save.isPending ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}

function WalletsPage() {
  const { data: wallets, isPending, error, refetch } = useQuery(q.wallets())
  const primary = wallets?.find((w) => w.slot === 'primary')
  const secondary = wallets?.find((w) => w.slot === 'secondary')
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  const primaryFormRef = useRef<HTMLDivElement>(null)

  return (
    <AccountLayout>
      <h1 className="sr-only">Carteiras</h1>
      {isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando carteiras">
          <div className="skeleton h-10 w-1/2 rounded" />
          <div className="skeleton h-[420px] rounded" />
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-md bg-card p-6">
          <p className="font-bold">Não foi possível carregar suas carteiras.</p>
          <Button onClick={() => void refetch()}>Tentar novamente</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <section aria-labelledby="carteira-principal" className="flex flex-col gap-8" ref={primaryFormRef}>
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 id="carteira-principal" className="text-base font-bold">
                  Carteira principal
                </h2>
                <p className="text-sm text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
              </div>
              {!primary && (
                <button
                  type="button"
                  className="shrink-0 font-bold text-brand hover:underline"
                  onClick={() => primaryFormRef.current?.querySelector<HTMLInputElement>('input')?.focus()}
                >
                  Adicionar
                </button>
              )}
            </header>
            <WalletForm slot="primary" wallet={primary} />
          </section>

          <section aria-labelledby="carteira-secundaria" className="flex flex-col gap-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="carteira-secundaria" className="text-base font-bold">
                  Carteira secundária
                </h2>
                {!secondary && !addingSecondary && <p className="text-sm text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={sameAsPrimary}
                    disabled={!primary}
                    onChange={(e) => {
                      setSameAsPrimary(e.target.checked)
                      setAddingSecondary(true)
                    }}
                  />
                  <span className="grid size-4 place-items-center rounded-full border border-primary peer-checked:after:size-2 peer-checked:after:rounded-full peer-checked:after:bg-primary" aria-hidden />
                  Igual à carteira principal
                </label>
                {!secondary && !addingSecondary && (
                  <button
                    type="button"
                    className="font-bold text-brand hover:underline disabled:opacity-50"
                    disabled={!primary}
                    title={primary ? undefined : 'Cadastre a carteira principal primeiro'}
                    onClick={() => setAddingSecondary(true)}
                  >
                    Adicionar
                  </button>
                )}
              </div>
            </header>
            {(secondary || addingSecondary) && (
              <WalletForm
                // Remonta ao marcar "Igual à principal" para copiar os dados.
                key={`secundaria-${sameAsPrimary}`}
                slot="secondary"
                wallet={secondary}
                initial={sameAsPrimary ? toValues(primary) : undefined}
                onSaved={() => setSameAsPrimary(false)}
              />
            )}
          </section>
        </div>
      )}
    </AccountLayout>
  )
}
