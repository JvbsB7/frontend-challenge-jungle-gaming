import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { realtimeBus, type NftChangeDetail } from '@/api/realtime'
import { compareEth, formatEth } from './eth'

/**
 * Avisa (toast com aria-live) quando um NFT acompanhado muda de preço ou
 * disponibilidade via Socket.IO. `ids` vazio = nenhum; undefined = todos.
 */
export function useNftChangeAnnouncer(ids: string[] | undefined, names: Record<string, string>) {
  const ref = useRef({ ids, names })
  useEffect(() => {
    ref.current = { ids, names }
  })

  useEffect(() => {
    const onChange = (e: Event) => {
      const { event, previous } = (e as CustomEvent<NftChangeDetail>).detail
      const { ids, names } = ref.current
      const id = event.resource.id
      if (ids && !ids.includes(id)) return
      const name = names[id] ?? 'Um NFT'
      if (previous && compareEth(previous.price, event.data.price) !== 0) {
        toast.warning(`${name}: preço alterado de ${formatEth(previous.price)} para ${formatEth(event.data.price)}.`, { id: `nft-${id}` })
      } else if (previous && previous.available !== event.data.available) {
        toast.warning(event.data.available === 0 ? `${name} esgotou.` : `${name}: disponibilidade atualizada (${event.data.available}).`, { id: `nft-${id}` })
      }
    }
    realtimeBus.addEventListener('nft-change', onChange)
    return () => realtimeBus.removeEventListener('nft-change', onChange)
  }, [])
}
