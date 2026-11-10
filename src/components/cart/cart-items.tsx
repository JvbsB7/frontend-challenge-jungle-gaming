import { Link } from '@tanstack/react-router'
import { AlertTriangle, Minus, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from 'cn'
import type { CartItem } from '@/api/contracts'
import { maxQuantity, useAddToCart, useRemoveFromCart, useSetCartQuantity } from '@/lib/cart'
import type { LineNotice } from '@/lib/use-cart-notices'

function Stepper({ item }: { item: CartItem }) {
  const setQty = useSetCartQuantity()
  const max = maxQuantity(item.available)
  const btn =
    'grid h-[30px] w-5 place-items-center rounded-full border border-background bg-primary text-primary-foreground shadow-[0_4px_6px_rgba(20,13,10,0.15)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40 max-md:size-6 max-md:bg-surface max-md:text-foreground'
  const change = (quantity: number) => setQty.mutate({ nftId: item.nftId, editionId: item.editionId, quantity })
  return (
    <div className="flex items-center gap-3" role="group" aria-label={`Quantidade de ${item.name}`}>
      <button type="button" className={btn} aria-label={`Diminuir quantidade de ${item.name}`} disabled={item.quantity <= 1 || setQty.isPending} onClick={() => change(item.quantity - 1)}>
        <Minus className="size-3.5" aria-hidden />
      </button>
      <output className="min-w-4 text-center text-[17px] leading-6" aria-live="polite">
        {item.quantity}
      </output>
      <button
        type="button"
        className={btn}
        aria-label={`Aumentar quantidade de ${item.name}`}
        disabled={item.quantity >= max || setQty.isPending}
        onClick={() => change(item.quantity + 1)}
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}

function Issue({ item, notice, onDismiss }: { item: CartItem; notice?: LineNotice; onDismiss: () => void }) {
  const setQty = useSetCartQuantity()
  const short = item.quantity > item.available
  if (!short && !notice?.from) return null
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2 text-xs text-brand md:px-0">
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      {notice?.from && notice.to && (
        <span>
          Preço alterado: <s className="text-subtle">{notice.from} ETH</s> → <strong>{notice.to} ETH</strong>
        </span>
      )}
      {short &&
        (item.available === 0 ? (
          <span className="text-destructive">Edição esgotada. Remova o item para continuar.</span>
        ) : (
          <>
            <span className="text-destructive">Só {item.available} disponível(is).</span>
            <button
              type="button"
              className="underline"
              onClick={() => setQty.mutate({ nftId: item.nftId, editionId: item.editionId, quantity: maxQuantity(item.available) })}
            >
              Ajustar para {maxQuantity(item.available)}
            </button>
          </>
        ))}
      {notice?.from && !short && (
        <button type="button" className="underline" onClick={onDismiss}>
          Entendi
        </button>
      )}
    </div>
  )
}

export function CartLine({ item, notice, onDismiss }: { item: CartItem; notice?: LineNotice; onDismiss: () => void }) {
  const remove = useRemoveFromCart()
  const add = useAddToCart()
  const onRemove = () =>
    remove.mutate(
      { nftId: item.nftId, editionId: item.editionId },
      {
        onSuccess: () =>
          toast.success(`${item.name} removido do carrinho.`, {
            action: { label: 'Desfazer', onClick: () => add.mutate({ nftId: item.nftId, editionId: item.editionId, quantity: item.quantity }) },
          }),
      },
    )
  const unavailable = item.quantity > item.available

  return (
    <li className={cn('overflow-hidden rounded-2xl bg-card md:rounded-none', unavailable && 'ring-1 ring-destructive/60')}>
      <div className="grid grid-cols-[100px_1fr] items-center gap-x-3 md:min-h-[70px] md:grid-cols-[minmax(0,250px)_92px_80px_100px_24px] md:justify-between md:pr-6">
        <div className="contents md:flex md:items-center md:gap-4">
          <img
            src={item.image.replace('.webp', '-500.webp')}
            alt=""
            width={70}
            height={70}
            loading="lazy"
            className="row-span-3 size-[100px] object-cover md:size-[70px] md:rounded-md"
          />
          <div className="flex min-w-0 flex-col gap-1.5 pt-3 md:pt-0">
            <h3 className="leading-tight font-bold">
              <Link to="/nft/$id" params={{ id: item.nftId }} search={{ edicao: item.editionId }} className="hover:underline">
                {item.name}
              </Link>
            </h3>
            <p className="text-sm leading-4 text-subtle">
              <span className="md:hidden">Edição: {item.editionLabel}</span>
              <span className="hidden md:inline">
                ID do token: {item.tokenId} · {item.editionLabel}
              </span>
            </p>
          </div>
        </div>
        <p className="font-bold whitespace-nowrap text-muted-foreground max-md:hidden">
          <span className="sr-only">Preço unitário: </span>
          {item.unitPrice} ETH
        </p>
        <div className="flex items-center justify-between gap-2 pr-3 pb-3 md:contents">
          <p className="text-lg font-bold text-brand md:hidden">{item.lineTotal} ETH</p>
          <Stepper item={item} />
        </div>
        <p className="font-bold whitespace-nowrap text-brand max-md:hidden">
          <span className="sr-only">Total da linha: </span>
          {item.lineTotal} ETH
        </p>
        <button
          type="button"
          onClick={onRemove}
          disabled={remove.isPending}
          aria-label={`Remover ${item.name} (${item.editionLabel}) do carrinho`}
          className="absolute right-3 mt-3 grid size-8 place-items-center self-start rounded text-muted-foreground hover:text-destructive md:static md:mt-0 md:size-6 md:self-center"
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>
      <Issue item={item} notice={notice} onDismiss={onDismiss} />
    </li>
  )
}
