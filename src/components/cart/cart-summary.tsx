import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'
import { ApiError } from '@/api/client'
import type { Network } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { keys, q, scope } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { setCoupon, useCoupon } from '@/lib/coupon-store'

const NETWORK: Network = 'ethereum' // taxa estimada; a rede final é escolhida no pagamento

function Row({ label, value, className }: { label: React.ReactNode; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

export function CartSummary({ blocked }: { blocked: boolean }) {
  const coupon = useCoupon()
  const client = useQueryClient()
  const inputId = useId()
  const errorId = useId()
  const [code, setCode] = useState('')
  const [couponError, setCouponError] = useState<string>()

  // Recalculada pela API quando o carrinho muda (mutations e eventos invalidam a cotação).
  const quote = useQuery(q.quote({ network: NETWORK, couponCode: coupon }))

  // Cupom salvo que deixou de valer (ex.: expirou): remove e avisa.
  useEffect(() => {
    const e = quote.error
    if (coupon && e instanceof ApiError && (e.code === 'COUPON_INVALID' || e.code === 'COUPON_EXPIRED')) {
      setCoupon(undefined)
      toast.warning(`${e.message} O cupom ${coupon} foi removido.`)
    }
  }, [quote.error, coupon])

  const apply = useMutation({
    mutationFn: (couponCode: string) => api.quote({ network: NETWORK, couponCode }),
    onSuccess: (result, couponCode) => {
      client.setQueryData(keys.quote(scope(), { network: NETWORK, couponCode: result.coupon?.code ?? couponCode }), result)
      setCoupon(result.coupon?.code)
      setCouponError(undefined)
      setCode('')
    },
    onError: (e) => setCouponError(e instanceof ApiError ? e.message : 'Não foi possível validar o cupom.'),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const value = code.trim()
    if (!value) return setCouponError('Digite um código promocional.')
    apply.mutate(value)
  }

  const data = quote.data
  return (
    <section aria-labelledby="resumo-titulo" className="flex flex-col gap-6 rounded-t-[30px] bg-card p-6 md:rounded-none md:bg-transparent md:p-0">
      <header className="hidden flex-col gap-3 md:flex">
        <h2 id="resumo-titulo" className="text-lg leading-4 font-bold">
          Resumo da carteira
        </h2>
        <hr className="border-primary" />
      </header>
      <h2 className="sr-only md:hidden">Resumo da carteira</h2>

      {coupon ? (
        <div className="flex items-center justify-between rounded-md border border-primary px-3 py-2 text-sm">
          <span>
            Cupom <strong className="text-brand">{coupon}</strong>
            {data?.coupon && ` (−${data.coupon.percentOff}%)`}
          </span>
          <button type="button" onClick={() => setCoupon(undefined)} className="grid size-7 place-items-center rounded hover:bg-surface" aria-label={`Remover cupom ${coupon}`}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
          <label htmlFor={inputId} className="hidden text-sm leading-4 font-bold md:block">
            Código promocional
          </label>
          <div className="flex h-12 overflow-hidden rounded-full border border-primary md:h-10 md:rounded-[3px]">
            <input
              id={inputId}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Digite o código promocional..."
              aria-label="Código promocional"
              aria-invalid={!!couponError}
              aria-describedby={couponError ? errorId : undefined}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-4 text-xs outline-none focus-visible:bg-surface md:px-2"
            />
            <button
              type="submit"
              disabled={apply.isPending}
              className="w-[102px] bg-gradient-to-r from-primary to-primary/80 text-[15px] font-bold text-primary-foreground disabled:opacity-60 md:bg-none md:bg-primary"
            >
              {apply.isPending ? '...' : 'Aplicar'}
            </button>
          </div>
        </form>
      )}
      {couponError && (
        <p id={errorId} role="alert" className="-mt-4 text-sm text-destructive">
          {couponError}
        </p>
      )}

      {!data ? (
        quote.error && !(quote.error instanceof ApiError && quote.error.code.startsWith('COUPON')) ? (
          <div role="alert" className="flex flex-col items-start gap-3 text-sm">
            <p>Não foi possível calcular o resumo.</p>
            <Button size="sm" onClick={() => void quote.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Calculando resumo">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton h-5 rounded" />
            ))}
          </div>
        )
      ) : (
        <dl className={cn('flex flex-col gap-3 text-[15px] transition-opacity', quote.isFetching && 'opacity-60')} aria-live="polite" aria-busy={quote.isFetching}>
          <Row label="Subtotal" value={<span className="text-lg leading-4">{data.subtotal} ETH</span>} />
          <Row label="Desconto do lançamento" value={`(-) ${data.discount}`} />
          <Row
            label="Taxa de rede"
            value={
              <span className="flex flex-col items-end gap-3">
                <span className="text-lg leading-4">{data.networkFee} ETH</span>
                <span className="text-xs leading-4 text-brand">Taxa estimada</span>
              </span>
            }
          />
          <Row
            className="mt-2 text-base font-bold"
            label="Total"
            value={<span className="text-lg leading-4 text-brand">{data.total} ETH</span>}
          />
        </dl>
      )}

      <div className="flex flex-col items-center gap-3">
        {blocked ? (
          <Button disabled className="h-[60px] w-full rounded-full md:h-10 md:rounded-[3px]">
            Conectar e finalizar
          </Button>
        ) : (
          <Button asChild className="h-[60px] w-full rounded-full bg-gradient-to-r from-primary to-primary/80 text-[15px] md:h-10 md:rounded-[3px] md:bg-none md:bg-primary">
            <Link to="/pagamento">Conectar e finalizar</Link>
          </Button>
        )}
        {blocked && <p className="text-center text-sm text-destructive">Ajuste os itens indisponíveis para continuar.</p>}
        <Link to="/" hash="catalogo" className="text-[15px] text-brand hover:underline">
          Continuar explorando
        </Link>
      </div>
    </section>
  )
}
