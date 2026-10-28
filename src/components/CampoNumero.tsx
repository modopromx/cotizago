// Campo numérico del editor de conceptos (Nueva / Editar cotización).
// Un <input type="number"> con `parseFloat(...) || 0` impedía borrar el valor:
// al vaciarlo volvía a aparecer el 0. Aquí el texto vive en su propio estado
// (puede quedar vacío mientras se escribe) y hacia fuera solo sale el número.
// inputMode="decimal" abre el teclado numérico con punto en el móvil.
import { useEffect, useState, type InputHTMLAttributes } from 'react'

const aNumero = (texto: string) => parseFloat(texto.replace(',', '.')) || 0

export default function CampoNumero({
  value, onValor, ...resto
}: {
  value: number
  onValor: (n: number) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [texto, setTexto] = useState(String(value ?? 0))

  // Si el valor cambia desde fuera (p. ej. al elegir un producto del
  // catálogo), se refleja; si es el mismo número que ya se ve, no se toca.
  useEffect(() => {
    if (aNumero(texto) !== (value ?? 0)) setTexto(String(value ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input {...resto} type="text" inputMode="decimal" autoComplete="off" value={texto}
      onChange={e => {
        const v = e.target.value
        if (!/^\d*[.,]?\d*$/.test(v)) return
        setTexto(v)
        onValor(aNumero(v))
      }}
      onBlur={e => { if (texto === '' || texto === '.' || texto === ',') setTexto(String(value ?? 0)); resto.onBlur?.(e) }} />
  )
}
