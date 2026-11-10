import type { Category, Edition, Eth, Network, Nft } from '@/api/contracts'
import { CATEGORIES, NETWORKS } from '@/api/contracts'
import { percentOf } from '@/lib/eth'

// Fixtures determinísticas: mesmo conteúdo a cada reset.

const ART = {
  emerald: 'emerald-ape',
  sage: 'sage-nomad',
  ivory: 'ivory-baron',
  golden: 'golden-beat',
} as const
type Art = (typeof ART)[keyof typeof ART]

const image = (art: Art) => `/nfts/${art}.webp`

// As 9 peças desenhadas no Figma, na ordem da grade de "Início".
const DESIGNED: Array<{ name: string; art: Art; price: Eth; compareAtPrice?: Eth; rare?: boolean }> = [
  { name: 'Emerald Ape #042', art: ART.emerald, price: '1.19' },
  { name: 'Sage Nomad #009', art: ART.sage, price: '1.69' },
  { name: 'Neon Vessel #552', art: ART.ivory, price: '1.99', compareAtPrice: '2.29' },
  { name: 'Cosmic Bloom #118', art: ART.sage, price: '1.29' },
  { name: 'Violet Nomad #314', art: ART.sage, price: '1.39' },
  { name: 'Ivory Baron #088', art: ART.ivory, price: '1.79', rare: true },
  { name: 'Golden Beat #207', art: ART.golden, price: '0.99' },
  { name: 'Golden Rhythm #233', art: ART.golden, price: '2.49' },
  { name: 'Golden Signal #160', art: ART.golden, price: '0.39' },
]

const ADJECTIVES = ['Amber', 'Rust', 'Copper', 'Velvet', 'Lunar', 'Solar', 'Quiet', 'Wild', 'Royal']
const NOUNS = ['Ape', 'Nomad', 'Baron', 'Beat', 'Signal', 'Vessel', 'Bloom']
const ARTS: Art[] = [ART.emerald, ART.sage, ART.ivory, ART.golden]
const PRICES: Eth[] = ['0.02', '0.15', '0.42', '0.75', '1.05', '2.10', '3.33', '5.80', '8.40', '12.30']
const COLLECTIONS = ['Kurio Editions', 'Kurio Apes', 'Nomad Club', 'Golden Sessions']
const ATTRIBUTES = ['Óculos', 'Esmeralda', 'Raro', 'Chapéu', 'Moletom', 'Fones', 'Terno', 'Dourado']

function editionsFor(base: Eth, seed: number): Edition[] {
  const soldOut = seed % 11 === 5 // algumas peças totalmente esgotadas
  const oneOfOneSold = seed % 4 === 1
  return [
    { id: 'e1', label: '1/1', supply: 1, available: soldOut || oneOfOneSold ? 0 : 1, price: percentOf(base, 300) },
    { id: 'e10', label: '1/10', supply: 10, available: soldOut ? 0 : 3 + (seed % 7), price: percentOf(base, 150) },
    { id: 'e50', label: '1/50', supply: 50, available: soldOut ? 0 : 12 + (seed % 30), price: base },
    { id: 'open', label: 'Aberta', supply: null, available: soldOut ? 0 : 999, price: percentOf(base, 60) },
  ]
}

function buildNft(index: number, spec: { name: string; art: Art; price: Eth; compareAtPrice?: Eth; rare?: boolean }): Nft {
  const id = `nft-${String(index + 1).padStart(3, '0')}`
  const category: Category = CATEGORIES[index % CATEGORIES.length]
  const network: Network = index % 5 === 3 ? 'polygon' : index % 7 === 4 ? 'solana' : NETWORKS[0]
  const editions = editionsFor(spec.price, index)
  const tokenNumber = spec.name.match(/#(\d+)/)?.[1] ?? String(index)
  const others = ARTS.filter((a) => a !== spec.art)
  return {
    id,
    name: spec.name,
    image: image(spec.art),
    images: [image(spec.art), image(others[0]), image(others[1]), image(others[2])],
    price: spec.price,
    compareAtPrice: spec.compareAtPrice,
    category,
    network,
    rare: spec.rare ?? index % 9 === 8,
    available: editions.reduce((n, e) => n + e.available, 0),
    version: 1,
    collection: COLLECTIONS[index % COLLECTIONS.length],
    description: `Um colecionável digital finalizado à mão da coleção ${COLLECTIONS[index % COLLECTIONS.length]}, verificado na ${network === 'ethereum' ? 'Ethereum' : network === 'polygon' ? 'Polygon' : 'Solana'}, com arte desbloqueável e acesso para colecionadores.`,
    tokenId: `#${tokenNumber.padStart(4, '0')}`,
    contract: `0x7A42${String(index).padStart(4, '0')}19E8`,
    royaltyPercent: 5,
    attributes: [ATTRIBUTES[index % ATTRIBUTES.length], ATTRIBUTES[(index + 3) % ATTRIBUTES.length]],
    editions,
    rating: 3 + (index % 3),
    reviewsCount: 4 + ((index * 7) % 30),
    // Mais recente primeiro: índice 0 é o mais novo.
    createdAt: new Date(Date.UTC(2026, 9, 30) - index * 86_400_000).toISOString(),
  }
}

export function createNftFixtures(): Nft[] {
  const generated = Array.from({ length: 39 }, (_, i) => ({
    name: `${ADJECTIVES[i % ADJECTIVES.length]} ${NOUNS[(i * 2) % NOUNS.length]} #${String(400 + i * 13).padStart(3, '0')}`,
    art: ARTS[i % ARTS.length],
    price: PRICES[(i * 3) % PRICES.length],
  }))
  return [...DESIGNED, ...generated].map((spec, i) => buildNft(i, spec))
}

export const FIXTURE_USERS = [
  {
    id: 'user-ana',
    username: 'ana.colecionadora',
    displayName: 'Ana Souza',
    email: 'ana@kurio.test',
    password: 'Kurio@123',
    ensName: 'anasouza',
    walletNickname: 'Cofre da Ana',
  },
  {
    id: 'user-bruno',
    username: 'bruno.nft',
    displayName: 'Bruno Lima',
    email: 'bruno@kurio.test',
    password: 'Kurio@123',
  },
] as const

export const COUPONS: Record<string, { percentOff: number; expiresAt: string }> = {
  KURIO10: { percentOff: 10, expiresAt: '2099-12-31T23:59:59Z' },
  GENESIS25: { percentOff: 25, expiresAt: '2099-12-31T23:59:59Z' },
  VERAO2025: { percentOff: 15, expiresAt: '2025-03-20T00:00:00Z' },
}

export const NETWORK_FEES: Record<Network, Eth> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

export const EXPLORERS: Record<Network, string> = {
  ethereum: 'https://etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  solana: 'https://solscan.io/tx/',
}
