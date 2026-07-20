// Logo oficial de Cotiza Go: ícono vectorial (mismo trazo que public/logo-icon.svg,
// parte oficial de la marca) + wordmark "COTIZA GO".
// Cuando el usuario deje el PNG oficial en diseño/, se puede sustituir el
// wordmark por la imagen; el ícono ya es fiel al original.

interface LogoProps {
  className?: string
  variant?: 'color' | 'white'   // 'white' para el menú lateral oscuro
  showText?: boolean
}

export default function Logo({ className = '', variant = 'color', showText = true }: LogoProps) {
  const textColor = variant === 'white' ? '#FFFFFF' : '#06213B'
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 110 130" className="h-8 w-auto shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none">
        <defs>
          <linearGradient id="cg-logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#17C5C9" />
            <stop offset="52%" stopColor="#0B6DAD" />
            <stop offset="100%" stopColor="#06213B" />
          </linearGradient>
        </defs>
        <path d="M8 14 Q8 4 18 4 L70 4 L102 36 L102 116 Q102 126 92 126 L18 126 Q8 126 8 116 Z"
          fill="url(#cg-logo-grad)" stroke="#06213B" strokeWidth="5" strokeLinejoin="round" />
        <path d="M70 4 L70 36 L102 36" fill="none" stroke="#06213B" strokeWidth="5" strokeLinejoin="round" />
        <polyline points="22,96 37,70 52,82 68,54" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="68" y1="54" x2="86" y2="54" stroke="white" strokeWidth="7" strokeLinecap="round" />
        <polyline points="79,45 88,54 79,63" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {showText && (
        <span className="text-xl font-extrabold tracking-tight" style={{ color: textColor }}>
          COTIZA <span style={{ color: variant === 'white' ? '#17C5C9' : '#08AEB6' }}>GO</span>
        </span>
      )}
    </span>
  )
}
