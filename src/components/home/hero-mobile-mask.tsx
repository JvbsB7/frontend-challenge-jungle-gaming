/** Máscara decorativa do hero mobile (Figma "Mask Group"), inline para não virar o LCP. */
export function HeroMobileMask() {
  return (
    <svg viewBox="0 0 366 190" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden focusable="false">
      <defs>
        <linearGradient id="hm-bg" x1="5" y1="0" x2="366" y2="183" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D28A4C" stopOpacity="0.2" />
          <stop offset="1" stopColor="#D28A4C" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="hm-c1" x1="69" y1="-10" x2="139" y2="185" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DD9A5F" stopOpacity="0.43" />
          <stop offset="1" stopColor="#D28A4C" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="hm-c2" x1="222" y1="11" x2="292" y2="206" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DD9A5F" stopOpacity="0.37" />
          <stop offset="1" stopColor="#D28A4C" stopOpacity="0" />
        </linearGradient>
        <clipPath id="hm-clip">
          <rect width="366" height="190" rx="30" />
        </clipPath>
      </defs>
      <rect width="366" height="190" rx="30" fill="url(#hm-bg)" />
      <g clipPath="url(#hm-clip)">
        <circle cx="44" cy="93" r="124" fill="url(#hm-c1)" />
        <circle cx="197" cy="114" r="124" fill="url(#hm-c2)" />
      </g>
    </svg>
  )
}
