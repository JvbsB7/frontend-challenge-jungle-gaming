// As artes locais têm duas larguras: <nome>.webp (1000px) e <nome>-500.webp.
// shortcut: convenção só das fixtures; com CDN real, gerar srcset a partir da URL da API.
export function nftSrcSet(image: string): string | undefined {
  if (!image.endsWith('.webp')) return undefined
  return `${image.replace(/\.webp$/, '-500.webp')} 500w, ${image} 1000w`
}
