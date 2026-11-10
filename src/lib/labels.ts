import type { Category, Network, NftSort, NftTab, WalletProvider } from '@/api/contracts'

export const CATEGORY_LABEL: Record<Category, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }

export const SORT_LABEL: Record<NftSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  name: 'Nome (A–Z)',
}

export const TAB_LABEL: Record<NftTab, string> = { all: 'Todos os NFTs', new: 'Novos lançamentos', trending: 'Em alta' }

export const PROVIDER_LABEL: Record<WalletProvider, string> = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' }
