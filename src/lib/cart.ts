import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import type { Cart, CartLineInput } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { keys, scope } from '@/api/queries'

/** Mensagem de erro de carrinho pronta para exibir (estoque, quantidade, rede). */
export function cartErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível atualizar o carrinho.'
}

function useCartMutation<TVars>(fn: (vars: TVars) => Promise<Cart>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    // A API devolve o carrinho inteiro: grava direto no cache e recalcula a cotação.
    onSuccess: (cart) => {
      const s = scope()
      client.setQueryData(keys.cart(s), cart)
      void client.invalidateQueries({ queryKey: [...keys.private(s), 'quote'] })
    },
    onError: (error) => {
      toast.error(cartErrorMessage(error))
      // Estoque pode ter mudado: traz o estado real.
      void client.invalidateQueries({ queryKey: keys.cart(scope()) })
    },
  })
}

export const useAddToCart = () => useCartMutation((line: CartLineInput) => api.addToCart(line))
export const useSetCartQuantity = () =>
  useCartMutation(({ nftId, editionId, quantity }: CartLineInput) => api.setCartQuantity(nftId, editionId, quantity))
export const useRemoveFromCart = () =>
  useCartMutation(({ nftId, editionId }: Pick<CartLineInput, 'nftId' | 'editionId'>) => api.removeFromCart(nftId, editionId))

/** Limite por linha (regra da API: até 10 e nunca acima do estoque). */
export const maxQuantity = (available: number) => Math.min(available, 10)
