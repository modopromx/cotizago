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

// Abre WhatsApp (wa.me) con el mensaje. Si hay número, lo dirige a ese contacto.
export function abrirWhatsApp(mensaje: string, telefono?: string) {
  const num = (telefono ?? '').replace(/\D/g, '')
  const base = num ? `https://wa.me/${num}` : 'https://wa.me/'
  window.open(`${base}?text=${encodeURIComponent(mensaje)}`, '_blank')
}
