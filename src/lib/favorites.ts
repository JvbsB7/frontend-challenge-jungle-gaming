import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { FavoritesResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { keys, q, scope } from '@/api/queries'
import { useSession } from './use-session'

export function useFavoriteIds(): Set<string> {
  const session = useSession()
  const { data } = useQuery({ ...q.favorites(), enabled: !!session })
  return new Set(data?.nftIds ?? [])
}

/**
 * Alterna favorito com atualização otimista: a UI muda na hora e,
 * se a API falhar, volta ao estado anterior e avisa o usuário.
 */
export function useToggleFavorite() {
  const client = useQueryClient()
  const session = useSession()
  const navigate = useNavigate()
  const { href } = useLocation()

  const mutation = useMutation({
    // Em série: cliques rápidos não se cruzam (um rollback não apaga outro favorito).
    scope: { id: 'favorites' },
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? api.addFavorite(nftId) : api.removeFavorite(nftId),
    onMutate: async ({ nftId, favorite }) => {
      const key = keys.favorites(scope())
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<FavoritesResponse>(key)
      const ids = new Set(previous?.nftIds ?? [])
      if (favorite) ids.add(nftId)
      else ids.delete(nftId)
      client.setQueryData<FavoritesResponse>(key, { nftIds: [...ids] })
      return { key, previous }
    },
    onError: (_error, { name, favorite }, context) => {
      if (context) client.setQueryData(context.key, context.previous)
      toast.error(`Não foi possível ${favorite ? 'favoritar' : 'remover dos favoritos'} "${name}". Tente novamente.`)
    },
    onSuccess: (data, { name, favorite }, context) => {
      client.setQueryData(context.key, data)
      toast.success(favorite ? `"${name}" adicionado aos favoritos.` : `"${name}" removido dos favoritos.`)
    },
    onSettled: (_d, _e, _v, context) => {
      if (context) void client.invalidateQueries({ queryKey: context.key })
      void client.invalidateQueries({ queryKey: [...keys.private(scope()), 'nfts'] })
    },
  })

  return (nftId: string, name: string, favorite: boolean) => {
    if (!session) {
      toast.info('Entre para salvar favoritos.')
      void navigate({ to: '/entrar', search: { redirect: href } })
      return
    }
    mutation.mutate({ nftId, favorite, name })
  }
}
