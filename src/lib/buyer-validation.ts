import type { BuyerInput } from '@/api/contracts'
import { EMAIL_RE, type FieldErrors } from './form'

export type BuyerValues = Partial<BuyerInput>

const EVM = /^0x[a-fA-F0-9]{40}$/
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const ENS = /^[a-z0-9-]{3,63}$/

/** Mesmas regras do servidor (mocks/http.ts), para feedback antes do envio. */
export function validateBuyer(v: BuyerValues): FieldErrors {
  const t = (x?: string) => (x ?? '').trim()
  const address = t(v.address)
  return {
    displayName: t(v.displayName) ? undefined : 'Informe o nome de exibição',
    username: t(v.username) ? undefined : 'Informe o nome de usuário',
    network: v.network ? undefined : 'Selecione uma rede',
    profileName: t(v.profileName) ? undefined : 'Informe o nome do perfil',
    address: !address
      ? 'Informe o endereço da carteira'
      : (v.network === 'solana' ? SOLANA : EVM).test(address)
        ? undefined
        : v.network === 'solana'
          ? 'Endereço Solana inválido'
          : 'Endereço 0x inválido (42 caracteres)',
    secondaryAddress: !t(v.secondaryAddress) || EVM.test(t(v.secondaryAddress)) || ENS.test(t(v.secondaryAddress).replace(/\.eth$/, '')) ? undefined : 'Informe um ENS ou endereço válido',
    provider: v.provider ? undefined : 'Selecione uma carteira',
    referralCode: t(v.referralCode) ? undefined : 'Informe o código de indicação',
    email: EMAIL_RE.test(t(v.email)) ? undefined : 'E-mail inválido',
    ensName: ENS.test(t(v.ensName).replace(/\.eth$/, '')) ? undefined : 'Nome ENS inválido',
  }
}
