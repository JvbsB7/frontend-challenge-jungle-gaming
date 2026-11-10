import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Loader2, X, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import { ApiError } from '@/api/client'
import type { Order } from '@/api/contracts'
import { q } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { pendingOrder, shortAddress } from '@/lib/checkout'
import { setCoupon } from '@/lib/coupon-store'
import { NETWORK_LABEL, PROVIDER_LABEL } from '@/lib/labels'
import { requireAuth } from '@/lib/require-auth'
import { useSession } from '@/lib/use-session'

export const Route = createFileRoute('/pedido/$id')({
  beforeLoad: requireAuth,
  component: OrderPage,
})

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const EXPLORER: Record<Order['network'], string> = { ethereum: 'Etherscan', polygon: 'Polygonscan', solana: 'Solscan' }

/** "29 Jul, 2026" (Figma) */
function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`
}

function ThankYouIcon() {
  return (
    <svg viewBox="0 0 68 82" width="68" height="82" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" aria-hidden className="text-primary">
      <path d="M8 34 34 14l26 20" />
      <rect x="8" y="34" width="52" height="44" rx="3" />
      <path d="m8 78 26-20 26 20M8 38l20 16M60 38 40 54" />
      <rect x="14" y="2" width="40" height="34" rx="2" className="fill-card" />
      <text x="34" y="17" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none">
        THANK
      </text>
      <text x="34" y="29" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none">
        YOU
      </text>
    </svg>
  )
}

/** Cartão sobre a página vazia, sem cabeçalho/rodapé (Figma "Confirmação de Pedido"). */
function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background px-4 py-10 md:py-[166px]">
      <section aria-labelledby="pedido-titulo" className="relative mx-auto w-full max-w-[578px] overflow-hidden bg-card pb-12 after:absolute after:inset-x-0 after:bottom-0 after:h-2.5 after:bg-primary">
        <button
          type="button"
          onClick={() => void navigate({ to: '/' })}
          aria-label="Fechar e voltar ao início"
          className="absolute top-4 right-4 grid size-8 place-items-center rounded text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-5" aria-hidden />
        </button>
        {children}
      </section>
    </div>
  )
}

function Receipt({ order }: { order: Order }) {
  const meta = [
    { label: 'ID da transação', value: order.txHash ? shortAddress(order.txHash).toUpperCase().replace('0X', '0x') : '—', strong: true },
    { label: 'Data', value: formatDate(order.updatedAt) },
    { label: 'Total', value: `${order.total} ETH` },
    { label: 'Carteira', value: PROVIDER_LABEL[order.provider], strong: true },
  ]
  return (
    <>
      <header className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center">
        <ThankYouIcon />
        <h1 id="pedido-titulo" className="text-base font-bold text-muted-foreground">
          Seus NFTs agora estão na sua carteira
        </h1>
      </header>
      <dl className="grid grid-cols-2 gap-y-3 border-y border-primary px-6 py-3 text-[13px] sm:flex sm:justify-between sm:divide-x sm:divide-primary sm:px-9">
        {meta.map((m) => (
          <div key={m.label} className="flex flex-col whitespace-nowrap sm:px-4 sm:first:pl-0 sm:last:pr-0">
            <dt className={m.strong ? 'font-bold text-muted-foreground' : 'text-muted-foreground'}>{m.label}</dt>
            <dd className="text-muted-foreground">{m.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-3 px-6 pt-6 sm:px-11">
        <h2 className="text-sm font-bold">Detalhes da transação</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-primary/60 text-left">
              <th scope="col" className="pb-2 font-bold">
                NFTs
              </th>
              <th scope="col" className="pb-2 text-center font-bold">
                Edições
              </th>
              <th scope="col" className="pb-2 text-right font-bold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={`${i.nftId}:${i.editionId}`}>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <img src={i.image.replace('.webp', '-500.webp')} alt="" width={70} height={70} className="size-[60px] rounded-md object-cover sm:size-[70px]" />
                    <div>
                      <p className="font-bold">{i.name}</p>
                      <p className="text-xs text-subtle">ID do token: {i.tokenId}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center text-muted-foreground">(x {i.quantity})</td>
                <td className="text-right font-bold whitespace-nowrap text-brand">{i.lineTotal} ETH</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto grid w-full max-w-[320px] grid-cols-[1fr_auto] gap-y-2 text-sm">
          {order.coupon && (
            <>
              <dt>Desconto ({order.coupon.code})</dt>
              <dd className="text-right">(-) {order.discount} ETH</dd>
            </>
          )}
          <dt>Taxa de rede</dt>
          <dd className="text-right text-base">{order.networkFee} ETH</dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-right text-base font-bold text-brand">{order.total} ETH</dd>
        </dl>
        <p className="border-t border-primary/60 pt-4 text-center text-[13px] leading-[22px] text-muted-foreground">
          Transação confirmada na {NETWORK_LABEL[order.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
        </p>
        {order.explorerUrl && (
          <Button asChild className="mx-auto mt-2 h-12 px-4">
            <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer">
              Ver no {EXPLORER[order.network]}
              <span className="sr-only"> (abre em nova aba; link simulado)</span>
            </a>
          </Button>
        )}
      </div>
    </>
  )
}

function OrderPage() {
  const { id } = Route.useParams()
  const session = useSession()
  // Enquanto pendente, além do socket, consulta a API periodicamente (recupera após queda de conexão).
  const { data: order, error, isPending, refetch } = useQuery({
    ...q.order(id),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 2000 : false),
  })

  // Pedido terminal: encerra o acompanhamento salvo e o cupom usado.
  const status = order?.status
  useEffect(() => {
    if (!session || !status || status === 'pending') return
    if (pendingOrder.get(session.userId) === id) pendingOrder.set(session.userId, undefined)
    if (status === 'confirmed') setCoupon(undefined)
  }, [status, id, session])

  if (isPending) {
    return (
      <Shell>
        <div className="flex flex-col gap-4 p-10" aria-busy="true" aria-label="Carregando pedido">
          <div className="skeleton mx-auto size-20 rounded" />
          <div className="skeleton h-6 rounded" />
          <div className="skeleton h-40 rounded" />
        </div>
      </Shell>
    )
  }

  if (error || !order) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <Shell>
        <div role="alert" className="flex flex-col items-center gap-4 p-10 text-center">
          <h1 id="pedido-titulo" className="text-xl font-bold">
            {notFound ? 'Pedido não encontrado' : 'Não foi possível carregar o pedido'}
          </h1>
          {!notFound && <Button onClick={() => void refetch()}>Tentar novamente</Button>}
          <Link to="/" className="text-brand underline">
            Voltar ao início
          </Link>
        </div>
      </Shell>
    )
  }

  if (order.status === 'pending') {
    return (
      <Shell>
        <div role="status" className="flex flex-col items-center gap-4 p-10 text-center">
          <Loader2 className="size-12 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
          <h1 id="pedido-titulo" className="text-xl font-bold">
            Aguardando confirmação na rede…
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Seu pedido foi registrado e o pagamento está sendo processado. Você pode fechar esta página: o status continua sendo atualizado e nenhuma compra
            nova será criada.
          </p>
          <p className="text-sm">
            Total: <strong className="text-brand">{order.total} ETH</strong>
          </p>
        </div>
      </Shell>
    )
  }

  if (order.status === 'declined') {
    return (
      <Shell>
        <div role="alert" className="flex flex-col items-center gap-4 p-10 text-center">
          <XCircle className="size-12 text-destructive" aria-hidden />
          <h1 id="pedido-titulo" className="text-xl font-bold">
            Pagamento recusado
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {order.declineReason ?? 'A carteira recusou o pagamento.'} Nenhum valor foi cobrado e seus itens continuam no carrinho.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/pagamento">Tentar novamente</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/carrinho">Ver carrinho</Link>
            </Button>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <Receipt order={order} />
    </Shell>
  )
}
