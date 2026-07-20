// Logo oficial de Cotiza Go (siempre el mismo PNG, el de la landing).
//   variant="color"  → PNG tal cual, para fondos claros.
//   variant="white"  → mismo PNG en blanco (filtro invert), para el menú lateral
//                      oscuro, igual que hace el diseño de referencia.

interface LogoProps {
  className?: string
  variant?: 'color' | 'white'
}

export default function Logo({ className = 'h-8', variant = 'color' }: LogoProps) {
  return (
    <img
      src="/cotiza-go-logo.png"
      alt="Cotiza Go"
      className={`w-auto ${className}`}
      style={variant === 'white' ? { filter: 'brightness(0) invert(1)' } : undefined}
    />
  )
}
