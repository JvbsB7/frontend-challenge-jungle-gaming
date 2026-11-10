import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Wallet as WalletIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import { ApiError } from '@/api/client'
import { type BuyerInput, type User, type Wallet, type WalletProvider, type WalletSlot } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { q } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { useCoupon } from '@/lib/coupon-store'
import { checkoutDraft, pendingOrder, shortAddress } from '@/lib/checkout'
import { focusFirstInvalid, hasErrors, type FieldErrors } from '@/lib/form'
import { NETWORK_LABEL, PROVIDER_LABEL } from '@/lib/labels'
import { useCartNotices } from '@/lib/use-cart-notices'
import { validateBuyer, type BuyerValues } from '@/lib/buyer-validation'
import { BuyerForm } from './buyer-form'
import { ReviewDialog } from './review-dialog'

// Ordem do Figma: WalletConnect (faixa com as três no desktop), MetaMask, Coinbase.
const PROVIDER_ORDER: WalletProvider[] = ['walletconnect', 'metamask', 'coinbase']

const SLOT_LABEL: Record<WalletSlot, string> = { primary: 'Principal', secondary: 'Reserva' }

function walletToBuyer(wallet: Wallet | undefined, profile: User | undefined): BuyerValues {
  if (!wallet) return { username: profile?.username }
  const { slot: _s, updatedAt: _u, nickname: _n, ...fields } = wallet
  return { ...fields, username: profile?.username }
}

type Connection = { status: 'idle' | 'connecting' | 'connected' | 'refused'; address?: string; message?: string }

function Radio({ checked }: { checked: boolean }) {
  return (
    <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border border-primary', checked && 'after:size-2 after:rounded-full after:bg-primary')} aria-hidden />
  )
}

/** "Carteira e rede": provedores (radio) — igual no desktop (lista) e no mobile (cards). */
function ProviderPicker({ value, onChange }: { value?: WalletProvider; onChange: (p: WalletProvider) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-base font-bold md:w-full md:text-center">Carteira e rede</legend>
      {PROVIDER_ORDER.map((p) => (
        <label
          key={p}
          className={cn(
            'flex h-16 cursor-pointer items-center gap-3 rounded-[14px] border border-transparent bg-card px-4 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 md:h-[34px] md:rounded-[3px] md:border-border md:bg-transparent md:px-3',
            value === p && 'md:border-primary',
          )}
        >
          <input type="radio" name="provider" value={p} checked={value === p} onChange={() => onChange(p)} className="sr-only" />
          <span className="grid size-10 place-items-center rounded-full border border-border text-sm font-bold text-brand md:hidden" aria-hidden>
            {p === 'coinbase' ? <WalletIcon className="size-4" /> : PROVIDER_LABEL[p][0]}
          </span>
          <span className="max-md:order-none md:order-1 max-md:flex-1">
            {p === 'walletconnect' ? (
              <>
                <span className="md:hidden">WalletConnect</span>
                <span className="hidden rounded-md border border-border bg-surface px-2 py-1 text-[9px] font-bold text-brand md:inline">METAMASK • WALLETCONNECT • COINBASE</span>
              </>
            ) : (
              PROVIDER_LABEL[p]
            )}
          </span>
          <span className="md:order-0">
            <Radio checked={value === p} />
          </span>
        </label>
      ))}
    </fieldset>
  )
}

/** Mobile: "Carteira conectada" — carteiras cadastradas (Figma "Pagamento com carteira"). */
function WalletList({ wallets, slot, onSelect }: { wallets: Wallet[]; slot: WalletSlot; onSelect: (s: WalletSlot) => void }) {
  return (
    <fieldset className="flex flex-col gap-3 md:hidden">
      <div className="flex items-center justify-between">
        <legend className="text-base font-bold">Carteira conectada</legend>
        <Link to="/carteiras" className="text-sm font-bold text-brand">
          Trocar carteira
        </Link>
      </div>
      {wallets.map((w) => (
        <label key={w.slot} className="flex cursor-pointer items-start gap-4 rounded-[14px] bg-card p-5 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
          <input type="radio" name="wallet" checked={slot === w.slot} onChange={() => onSelect(w.slot)} className="sr-only" />
          <span className="mt-1">
            <Radio checked={slot === w.slot} />
          </span>
          <span className="flex flex-col gap-1 text-sm">
            <strong className="text-base">{SLOT_LABEL[w.slot]}</strong>
            <span className="text-muted-foreground">{w.ensName ? `${w.ensName}.eth` : shortAddress(w.address)}</span>
            <span className="text-muted-foreground">Rede {NETWORK_LABEL[w.network]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function OrderSummary({ network, coupon }: { network: BuyerInput['network']; coupon?: string }) {
  const { data: cart } = useQuery(q.cart())
  const quote = useQuery(q.quote({ network, couponCode: coupon }))
  const data = quote.data
  return (
    <section aria-labelledby="seus-nfts" className="flex flex-col gap-3">
      <h2 id="seus-nfts" className="text-base font-bold">
        Seus NFTs
      </h2>
      <div className="flex justify-between border-b border-primary pb-1 text-sm font-bold" aria-hidden>
        <span>NFTs</span>
        <span>Subtotal</span>
      </div>
      <ul className="flex flex-col gap-2">
        {(cart?.items ?? []).map((i) => (
          <li key={`${i.nftId}:${i.editionId}`} className="flex items-center gap-2 rounded-md bg-card p-1 pr-3">
            <img src={i.image.replace('.webp', '-500.webp')} alt="" width={50} height={50} className="size-[50px] rounded-md object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-4 font-bold">{i.name}</p>
              <p className="text-[11px] whitespace-nowrap text-subtle">ID do token: {i.tokenId}</p>
            </div>
            <span className="text-[11px] whitespace-nowrap text-muted-foreground">(x {i.quantity})</span>
            <span className="text-sm font-bold whitespace-nowrap text-brand">{i.lineTotal} ETH</span>
          </li>
        ))}
      </ul>
      <p className="text-center text-sm">
        {coupon ? (
          <>
            Cupom <strong className="text-brand">{coupon}</strong> aplicado.{' '}
          </>
        ) : (
          'Tem um código promocional? '
        )}
        <Link to="/carrinho" className="text-brand hover:underline">
          {coupon ? 'Alterar' : 'Aplique aqui'}
        </Link>
      </p>
      {!data ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Calculando valores">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-5 rounded" />
          ))}
        </div>
      ) : (
        <dl className={cn('grid grid-cols-[1fr_auto] gap-x-2 gap-y-2 text-[13px] transition-opacity', quote.isFetching && 'opacity-60')} aria-live="polite">
          <dt>Subtotal</dt>
          <dd className="text-right text-base">{data.subtotal} ETH</dd>
          <dt>Desconto do lançamento</dt>
          <dd className="text-right">(-) {data.discount}</dd>
          <dt>Taxa de rede</dt>
          <dd className="text-right text-base">{data.networkFee} ETH</dd>
          <dd className="col-span-2 text-center text-xs text-brand">Taxa estimada</dd>
          <dt className="border-t border-border pt-3 pl-8 font-bold">Total</dt>
          <dd className="border-t border-border pt-3 pr-8 text-right text-base font-bold text-brand">{data.total} ETH</dd>
        </dl>
      )}
    </section>
  )
}

export function PaymentPage({ userId }: { userId: string }) {
  const router = useRouter()
  const formRef = useRef<HTMLDivElement>(null)
  const coupon = useCoupon()
  const wallets = useQuery(q.wallets())
  const profile = useQuery(q.profile())
  const cart = useQuery(q.cart())

  const draft = checkoutDraft.get(userId)
  const [slot, setSlot] = useState<WalletSlot>(draft?.walletSlot ?? 'primary')
  const [edits, setEdits] = useState<BuyerValues>(draft?.buyer ?? {})
  const [errors, setErrors] = useState<FieldErrors>({})
  const [connection, setConnection] = useState<Connection>({ status: 'idle' })
  const [reviewing, setReviewing] = useState(false)
  // Avisos de preço/estoque valem fora da revisão; durante o envio, a própria compra reserva estoque.
  useCartNotices(!reviewing)

  const wallet = wallets.data?.find((w) => w.slot === slot)
  const values: BuyerValues = { ...walletToBuyer(wallet, profile.data), ...edits }
  const network = values.network ?? 'ethereum'

  // Rascunho persiste a cada mudança (retomada após expiração de sessão).
  useEffect(() => checkoutDraft.set(userId, { buyer: edits, walletSlot: slot }), [userId, edits, slot])

  const pendingId = pendingOrder.get(userId)
  const pending = useQuery({ ...q.order(pendingId ?? ''), enabled: !!pendingId })

  const connect = useMutation({
    mutationFn: () => api.connectWallet(slot),
    onMutate: () => setConnection({ status: 'connecting' }),
    onSuccess: (r) => {
      setConnection({ status: 'connected', address: r.address })
      setReviewing(true)
    },
    onError: (e) => setConnection({ status: 'refused', message: e instanceof ApiError ? e.message : 'Não foi possível conectar a carteira.' }),
  })

  const selectSlot = (next: WalletSlot) => {
    setSlot(next)
    setEdits({}) // dados passam a vir da carteira escolhida
    setErrors({})
    setConnection({ status: 'idle' })
  }

  const onConfirm = () => {
    const next = validateBuyer(values)
    setErrors(next)
    if (hasErrors(next)) {
      focusFirstInvalid(formRef.current)
      return
    }
    if (connection.status === 'connected') setReviewing(true)
    else connect.mutate()
  }

  const back = (
    <header className="relative flex items-center justify-center md:hidden">
      <button type="button" aria-label="Voltar" onClick={() => router.history.back()} className="absolute left-0 grid size-9 place-items-center rounded-full bg-surface">
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <h1 className="text-xl font-bold">Pagamento com carteira</h1>
    </header>
  )

  const hasWallets = !!wallets.data?.length
  const secondary = wallets.data?.find((w) => w.slot === 'secondary')

  // O diálogo fica sempre na mesma posição da árvore: se o carrinho esvaziar durante o
  // envio (timeout + liquidação), ele não é remontado nem perde o estado do envio.
  const dialog =
    wallet && values.provider ? (
      <ReviewDialog
        open={reviewing}
        onOpenChange={setReviewing}
        userId={userId}
        input={{ network, couponCode: coupon, walletSlot: slot, buyer: values as BuyerInput }}
        onFieldErrors={(fields) => {
          setErrors(fields)
          focusFirstInvalid(formRef.current)
        }}
      />
    ) : null

  let body: React.ReactNode
  if (wallets.isPending || cart.isPending) {
    body = (
      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_294px]" aria-busy="true" aria-label="Carregando pagamento">
        <div className="skeleton h-[420px] rounded-md" />
        <div className="skeleton h-[420px] rounded-md" />
      </div>
    )
  } else if (!cart.data?.items.length) {
    body = (
      <div className="flex flex-col gap-6 py-10">
        {back}
        <div className="flex flex-col items-start gap-4 rounded-md bg-card p-6">
          <p className="font-bold">Seu carrinho está vazio.</p>
          <Button asChild>
            <Link to="/" hash="catalogo">
              Explorar NFTs
            </Link>
          </Button>
        </div>
      </div>
    )
  } else body = (
    <div className="pb-8">
      <nav aria-label="Trilha" className="mt-7 hidden text-[15px] leading-4 font-bold md:block">
        <Link to="/">Início</Link> / <Link to="/" hash="catalogo">Mercado</Link> / <span aria-current="page">Pagamento</span>
      </nav>
      {back}
      <h1 className="sr-only max-md:hidden">Pagamento</h1>

      {pending.data?.status === 'pending' && (
        <p role="status" className="mt-4 rounded-md border border-brand/60 bg-brand/10 p-3 text-sm">
          Você tem um pedido em processamento.{' '}
          <Link to="/pedido/$id" params={{ id: pending.data.id }} className="font-bold text-brand underline">
            Acompanhar pedido
          </Link>
        </p>
      )}

      {!hasWallets ? (
        <div className="mt-6 flex flex-col items-start gap-4 rounded-md bg-card p-6">
          <p className="font-bold">Cadastre uma carteira para pagar.</p>
          <p className="text-sm text-muted-foreground">As carteiras cadastradas ficam disponíveis no pagamento e para receber os NFTs.</p>
          <Button asChild>
            <Link to="/carteiras">Cadastrar carteira</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-8 md:grid-cols-[1fr_294px] md:gap-6 lg:gap-6">
          <section aria-labelledby="perfil-colecionador" className="flex flex-col gap-6">
            <WalletList wallets={wallets.data ?? []} slot={slot} onSelect={selectSlot} />
            <div ref={formRef} className="hidden flex-col gap-4 md:flex [&_label]:text-sm">
              <h2 id="perfil-colecionador" className="text-base font-bold">
                Perfil do colecionador
              </h2>
              <BuyerForm values={values} errors={errors} onChange={(patch) => setEdits((e) => ({ ...e, ...patch }))} />
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={slot === 'secondary'}
                  disabled={!secondary}
                  onChange={(e) => selectSlot(e.target.checked ? 'secondary' : 'primary')}
                />
                <Radio checked={slot === 'secondary'} />
                Usar outra carteira?
                {!secondary && (
                  <Link to="/carteiras" className="text-brand underline">
                    cadastre a secundária
                  </Link>
                )}
              </label>
            </div>
            {/* Mobile: dados vêm da carteira escolhida; se faltarem, orienta a completar. */}
            {hasErrors(errors) && (
              <p role="alert" className="text-sm text-destructive md:hidden">
                Os dados desta carteira estão incompletos.{' '}
                <Link to="/carteiras" className="font-bold underline">
                  Completar em Carteiras
                </Link>
              </p>
            )}
            <div className="md:hidden">
              <ProviderPicker value={values.provider} onChange={(provider) => setEdits((e) => ({ ...e, provider }))} />
            </div>
          </section>

          <aside className="flex flex-col gap-6" aria-label="Resumo e confirmação">
            <div className="hidden md:block">
              <OrderSummary network={network} coupon={coupon} />
            </div>
            <div className="hidden md:block">
              <ProviderPicker value={values.provider} onChange={(provider) => setEdits((e) => ({ ...e, provider }))} />
            </div>
            <MobileTotal network={network} coupon={coupon} />

            {connection.status === 'connected' && (
              <p role="status" className="flex items-center justify-between gap-2 text-sm text-success">
                Carteira conectada: {shortAddress(connection.address ?? '')}
                <button type="button" className="text-brand underline" onClick={() => setConnection({ status: 'idle' })}>
                  Desconectar
                </button>
              </p>
            )}
            {connection.status === 'refused' && (
              <p role="alert" className="text-sm text-destructive">
                {connection.message} Tente novamente ou escolha outra carteira.
              </p>
            )}
            <Button
              className="h-[60px] w-full rounded-full bg-gradient-to-r from-primary to-primary/80 md:h-10 md:rounded-[3px] md:bg-none md:bg-primary"
              disabled={connect.isPending}
              onClick={onConfirm}
            >
              {connect.isPending ? 'Conectando carteira…' : 'Confirmar compra'}
            </Button>
          </aside>
        </div>
      )}
    </div>
  )

  return (
    <>
      {body}
      {dialog}
    </>
  )
}

function MobileTotal({ network, coupon }: { network: BuyerInput['network']; coupon?: string }) {
  const { data } = useQuery(q.quote({ network, couponCode: coupon }))
  return (
    <p className="flex items-center justify-end gap-6 text-lg font-bold md:hidden" aria-live="polite">
      Total: <span className="text-brand">{data ? `${data.total} ETH` : '…'}</span>
    </p>
  )
}
