// Sustituye las variables {{...}} de una plantilla por sus valores reales.
export interface VarsPlantilla {
  cliente?: string; folio?: string; total?: string; empresa?: string
  enlace_publico?: string; vendedor?: string; vigencia?: string; fecha?: string
}

export function llenarPlantilla(cuerpo: string, v: VarsPlantilla): string {
  return (cuerpo ?? '')
    .replace(/\{\{cliente\}\}/g, v.cliente ?? '')
    .replace(/\{\{folio\}\}/g, v.folio ?? '')
    .replace(/\{\{total\}\}/g, v.total ?? '')
    .replace(/\{\{empresa\}\}/g, v.empresa ?? '')
    .replace(/\{\{enlace_publico\}\}/g, v.enlace_publico ?? '')
    .replace(/\{\{vendedor\}\}/g, v.vendedor ?? '')
    .replace(/\{\{vigencia\}\}/g, v.vigencia ?? '')
    .replace(/\{\{fecha\}\}/g, v.fecha ?? '')
}

// Abre WhatsApp (wa.me) con el mensaje ya escrito.
// wa.me EXIGE el número en formato internacional (código de país + número, solo
// dígitos). Si el número no lo trae, abre el selector de contacto de WhatsApp
// en vez de un chat equivocado.
export function abrirWhatsApp(mensaje: string, telefono?: string) {
  const num = (telefono ?? '').replace(/\D/g, '')
  // Menos de 10 dígitos no puede incluir país + número: no lo usamos como destino.
  const destino = num.length >= 10 ? num : ''
  const base = destino ? `https://wa.me/${destino}` : 'https://wa.me/'
  window.open(`${base}?text=${encodeURIComponent(mensaje)}`, '_blank')
  return { conDestino: !!destino }
}
