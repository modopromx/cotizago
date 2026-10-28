// Logo oficial de Cotiza Go (siempre el mismo PNG, el de la landing).
//   variant="color" → PNG tal cual, para fondos claros.
//   variant="chip"  → PNG a color dentro de una placa blanca redondeada, para
//                     fondos oscuros (menú lateral, login). Así se ve con sus
//                     colores reales sin perderse contra el navy.
//   variant="white" → PNG en blanco (filtro invert). Se conserva por si se
//                     necesita, pero ya no se usa en los paneles.

interface LogoProps {
  className?: string
  variant?: 'color' | 'white' | 'chip'
}

export default function Logo({ className = 'h-12', variant = 'color' }: LogoProps) {
  const img = (
    <img
      src="/cotiza-go-logo-v2.png"
      alt="Cotiza Go"
      width={640}
      height={124}
      className={`w-auto ${className}`}
      style={variant === 'white' ? { filter: 'brightness(0) invert(1)' } : undefined}
    />
  )

  if (variant === 'chip') {
    return (
      <span className="inline-flex items-center bg-white rounded-xl px-3.5 py-2.5 shadow-md">
        {img}
      </span>
    )
  }
  return img
}
