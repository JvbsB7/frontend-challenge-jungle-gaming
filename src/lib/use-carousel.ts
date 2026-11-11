import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from './use-media-query'

const SWIPE_MIN_PX = 40

/**
 * Carrossel com troca automática, pausa e gesto de arrastar.
 * - Troca sozinho a cada `intervalMs`; pausa com o mouse em cima ou o foco do teclado dentro.
 * - Com `prefers-reduced-motion`, não troca sozinho.
 * - Arrastar (dedo ou mouse) para os lados troca de slide; o clique que encerra o arraste
 *   é descartado para não abrir o link da imagem.
 */
export function useCarousel(count: number, intervalMs = 6000) {
  const [rawIndex, setIndex] = useState(0)
  const [interacting, setInteracting] = useState(false)
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const canAutoplay = count > 1 && !reduceMotion
  const playing = canAutoplay && !interacting
  const index = count ? rawIndex % count : 0

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs)
    return () => clearInterval(timer)
  }, [playing, count, intervalMs])

  const go = (i: number) => setIndex(((i % count) + count) % count)

  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  const swipeHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY }
      swiped.current = false
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!start.current || count < 2) return
      const dx = e.clientX - start.current.x
      const dy = e.clientY - start.current.y
      start.current = null
      if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
        swiped.current = true
        go(index + (dx < 0 ? 1 : -1))
      }
    },
    onPointerCancel: () => {
      start.current = null
    },
    // Depois de um arraste, o clique não navega para o NFT.
    onClickCapture: (e: React.MouseEvent) => {
      if (!swiped.current) return
      e.preventDefault()
      e.stopPropagation()
      swiped.current = false
    },
    // Sem o "fantasma" de arrastar imagem/link do navegador.
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
    // Rolagem vertical continua com o dedo; o gesto horizontal fica com o carrossel.
    style: { touchAction: 'pan-y' } as React.CSSProperties,
  }

  // Pausa enquanto o usuário está com o mouse em cima ou com o foco dentro do carrossel.
  const pauseHandlers = {
    onMouseEnter: () => setInteracting(true),
    onMouseLeave: () => setInteracting(false),
    onFocus: () => setInteracting(true),
    onBlur: (e: React.FocusEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setInteracting(false)
    },
  }

  return {
    index,
    go,
    playing,
    canAutoplay,
    swipeHandlers,
    pauseHandlers,
  }
}
