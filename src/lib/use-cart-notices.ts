import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Cart, CartItem } from '@/api/contracts'
import { keys, scope } from '@/api/queries'
import { realtimeBus, type NftChangeDetail } from '@/api/realtime'
import { compareEth } from './eth'

export interface LineNotice {
  from?: string
  to?: string
  available?: number
}

const lineKey = (i: Pick<CartItem, 'nftId' | 'editionId'>) => `${i.nftId}:${i.editionId}`

/**
 * Mudanças recebidas pelo Socket.IO para itens do carrinho: guarda "de → para"
 * para exibir na linha e avisa por toast (aria-live). O resumo é recalculado pela API.
 */
/** `enabled=false` silencia os avisos (ex.: durante o envio do próprio pedido, que reserva estoque). */
export function useCartNotices(enabled = true) {
  const client = useQueryClient()
  const [notices, setNotices] = useState<Record<string, LineNotice>>({})
  const enabledRef = useRef(enabled)
  useEffect(() => {
    enabledRef.current = enabled
  })

  useEffect(() => {
    const onChange = (e: Event) => {
      if (!enabledRef.current) return
      const { event } = (e as CustomEvent<NftChangeDetail>).detail
      const cart = client.getQueryData<Cart>(keys.cart(scope()))
      for (const item of cart?.items ?? []) {
        if (item.nftId !== event.resource.id) continue
        const edition = event.data.editions.find((ed) => ed.id === item.editionId)
        if (!edition) continue
        const priceChanged = compareEth(edition.price, item.unitPrice) !== 0
        const short = edition.available < item.quantity
        if (!priceChanged && !short) continue
        setNotices((n) => ({
          ...n,
          [lineKey(item)]: { from: priceChanged ? item.unitPrice : n[lineKey(item)]?.from, to: priceChanged ? edition.price : n[lineKey(item)]?.to, available: short ? edition.available : undefined },
        }))
        toast.warning(
          priceChanged
            ? `${item.name}: preço alterado de ${item.unitPrice} para ${edition.price} ETH. O resumo foi atualizado.`
            : edition.available === 0
              ? `${item.name} (${item.editionLabel}) esgotou.`
              : `${item.name}: só ${edition.available} disponível(is) agora.`,
          { id: `cart-${lineKey(item)}` },
        )
      }
    }
    realtimeBus.addEventListener('nft-change', onChange)
    return () => realtimeBus.removeEventListener('nft-change', onChange)
  }, [client])

  const dismiss = (item: CartItem) =>
    setNotices((n) => Object.fromEntries(Object.entries(n).filter(([key]) => key !== lineKey(item))))
  return { notices, dismiss }
}

