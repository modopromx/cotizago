import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Convierte a Date respetando las fechas SIN hora. `new Date('2026-10-28')` se
 * interpreta como medianoche UTC, que en México (UTC-6) es el día ANTERIOR: por
 * eso fecha_emision / fecha_vencimiento salían un día antes en pantalla, lista,
 * PDF y correo. Una fecha «AAAA-MM-DD» se toma como ese día en la hora local.
 */
export function aFecha(date: string | Date): Date {
  if (date instanceof Date) return date
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(date)
}

export function formatDate(date: string | Date) {
  if (!date) return ''
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(aFecha(date))
}

export function formatDatetime(date: string | Date) {
  if (!date) return ''
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(aFecha(date))
}

export const ESTADO_COLORS: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  enviada: 'bg-blue-100 text-blue-700',
  vista: 'bg-yellow-100 text-yellow-700',
  aceptada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
  expirada: 'bg-orange-100 text-orange-700',
}

export const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  vista: 'Vista',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  expirada: 'Expirada',
}
