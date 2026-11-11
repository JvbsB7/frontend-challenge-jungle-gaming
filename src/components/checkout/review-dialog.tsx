import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import type { CreateOrderInput, Order, Quote } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { keys, q } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { checkoutDraft, clearAttempt, idempotencyKeyFor, pendingOrder, shortAddress } from '@/lib/checkout'
import { NETWORK_LABEL, PROVIDER_LABEL } from '@/lib/labels'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  /** Pedido sem o quoteId (vem da cotação revisada). */
  input: Omit<CreateOrderInput, 'quoteId'>
  /** Erros de campo devolvidos pela API (fecham a revisão e voltam ao formulário). */
  onFieldErrors: (fields: Record<string, string>) => void
}

type SubmitProblem = { kind: 'outdated' | 'stock' | 'retry' | 'pending' | 'error'; message: string; orderId?: string }

export function ReviewDialog({ open, onOpenChange, userId, input, onFieldErrors }: Props) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const quoteInput = { network: input.network, couponCode: input.couponCode }
  // Cotação ao vivo: eventos nft.updated e mutations a invalidam e ela é refeita.
  const quote = useQuery({ ...q.quote(quoteInput), enabled: open, refetchOnMount: 'always' })
  // Cotação que o usuário confirmou ter revisado. Se a cotação ao vivo mudar, exige nova confirmação.
  const [acknowledged, setAcknowledged] = useState<string>()
  const [problem, setProblem] = useState<SubmitProblem>()
  // Cotação do último envio: "Tentar novamente" reenvia exatamente o mesmo pedido (mesma chave).
  const [lastSubmitted, setLastSubmitted] = useState<string>()
  // Erros de campo da API: aplicados quando o diálogo termina de fechar (o Radix devolve o foco antes).
  const pendingFieldErrors = useRef<Record<string, string>>(undefined)

  /** Único caminho de fechamento: sempre limpa o estado da revisão (Voltar, Esc, erro de campo, sucesso). */
  const close = () => {
    setAcknowledged(undefined)
    setProblem(undefined)
    setLastSubmitted(undefined)
    onOpenChange(false)
  }
  const live = quote.data
  // Ao abrir, a primeira cotação exibida vira a "revisada" (ajuste de estado durante o render).
  if (open && live && acknowledged === undefined && !problem) setAcknowledged(live.quoteId)
  const changed = !!live && !!acknowledged && live.quoteId !== acknowledged

  const submit = useMutation({
    mutationFn: (quoteId: string) => {
      const order: CreateOrderInput = { ...input, quoteId }
      return api.createOrder(order, idempotencyKeyFor(userId, order))
    },
    onSuccess: (order: Order) => {
      pendingOrder.set(userId, order.id)
      clearAttempt(userId)
      checkoutDraft.set(userId, undefined) // próximo checkout parte da carteira atual
      client.setQueryData(keys.order(userId, order.id), order)
      close()
      void navigate({ to: '/pedido/$id', params: { id: order.id } })
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return setProblem({ kind: 'error', message: 'Erro inesperado.' })
      if (error.code === 'QUOTE_OUTDATED' || error.code === 'OUT_OF_STOCK') {
        const fresh = (error.details as { quote?: Quote } | undefined)?.quote
        if (fresh) client.setQueryData(keys.quote(userId, quoteInput), fresh)
        void client.invalidateQueries({ queryKey: keys.cart(userId) })
        setAcknowledged(undefined)
        return setProblem({ kind: error.code === 'OUT_OF_STOCK' ? 'stock' : 'outdated', message: error.message })
      }
      if (error.code === 'VALIDATION' && error.fields) {
        pendingFieldErrors.current = error.fields
        return close()
      }
      // Outro pedido do usuário ainda está em processamento (ex.: enviado em outra aba).
      if (error.code === 'CONFLICT') {
        const orderId = (error.details as { orderId?: string } | undefined)?.orderId
        if (orderId) pendingOrder.set(userId, orderId)
        return setProblem({ kind: 'pending', message: error.message, orderId })
      }
      // Timeout/queda: o pedido pode ter sido criado. Reenviar usa a mesma chave e recupera o mesmo pedido.
      if (error.transient) {
        return setProblem({ kind: 'retry', message: 'Não recebemos a confirmação do servidor. Tente novamente: o pedido não será duplicado.' })
      }
      setProblem({ kind: 'error', message: error.message })
    },
  })

  const blockedByStock = !!live?.issues.length
  const retrying = problem?.kind === 'retry' && !!lastSubmitted
  const confirm = () => {
    if (retrying) {
      setProblem(undefined)
      submit.mutate(lastSubmitted)
      return
    }
    if (!live) return
    if (changed || problem?.kind === 'outdated') {
      // Nova confirmação explícita após mudança de valores.
      setAcknowledged(live.quoteId)
      setProblem(undefined)
      return
    }
    setProblem(undefined)
    setLastSubmitted(live.quoteId)
    submit.mutate(live.quoteId)
  }
  const needsReconfirm = !retrying && (changed || problem?.kind === 'outdated')

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submit.isPending) return // não fecha no meio do envio
        if (next) onOpenChange(true)
        else close()
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-[520px]"
        onCloseAutoFocus={(e) => {
          // Com erro de campo, o foco vai para o primeiro campo inválido, e não de volta ao botão.
          const fields = pendingFieldErrors.current
          if (!fields) return
          e.preventDefault()
          pendingFieldErrors.current = undefined
          onFieldErrors(fields)
        }}
      >
        <DialogTitle>Revise seu pedido</DialogTitle>
        <DialogDescription>Confira os itens, a carteira e os valores antes de confirmar.</DialogDescription>

        {(needsReconfirm || problem) && (
          <div role="alert" className="flex gap-2 rounded-md border border-brand/60 bg-brand/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <div className="flex flex-col gap-1">
              <p>{problem?.message ?? 'Os valores mudaram desde a sua revisão. Confira e confirme novamente.'}</p>
              {problem?.kind === 'pending' && problem.orderId && (
                <Link to="/pedido/$id" params={{ id: problem.orderId }} className="font-bold text-brand underline">
                  Acompanhar pedido
                </Link>
              )}
              {(problem?.kind === 'stock' || blockedByStock) && (
                <Link to="/carrinho" className="font-bold text-brand underline">
                  Ajustar carrinho
                </Link>
              )}
            </div>
          </div>
        )}

        {!live ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Revalidando valores">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton h-6 rounded" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-sm" aria-live="polite">
            <ul className="flex flex-col gap-2">
              {live.items.map((i) => (
                <li key={`${i.nftId}:${i.editionId}`} className="flex items-center justify-between gap-3">
                  <span>
                    {i.name} <span className="text-subtle">({i.editionLabel}) × {i.quantity}</span>
                  </span>
                  <span className="font-bold text-brand">{i.lineTotal} ETH</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-border pt-3">
              <dt>Subtotal</dt>
              <dd className="text-right">{live.subtotal} ETH</dd>
              <dt>Desconto{live.coupon ? ` (${live.coupon.code})` : ''}</dt>
              <dd className="text-right">(-) {live.discount}</dd>
              <dt>Taxa de rede ({NETWORK_LABEL[live.network]})</dt>
              <dd className="text-right">{live.networkFee} ETH</dd>
              <dt className="font-bold">Total</dt>
              <dd className="text-right font-bold text-brand">{live.total} ETH</dd>
            </dl>
            <p className="text-muted-foreground">
              Pagamento com {PROVIDER_LABEL[input.buyer.provider]} · {shortAddress(input.buyer.address)} · rede {NETWORK_LABEL[input.network]}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={submit.isPending} onClick={close}>
            Voltar
          </Button>
          <Button
            disabled={submit.isPending || (!retrying && (!live || quote.isFetching || blockedByStock || problem?.kind === 'stock' || problem?.kind === 'pending'))}
            onClick={confirm}
          >
            {submit.isPending ? 'Enviando pedido…' : retrying ? 'Tentar novamente' : needsReconfirm ? 'Confirmar novos valores' : 'Confirmar e pagar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
