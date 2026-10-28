// Tarjeta «Conexión con SENHUB» del panel de facturación (solo superadmin).
// Muestra si el timbrado está vivo y cuántos timbres quedan, y permite RECONECTAR
// cuando el token caduca: SENHUB manda un código al correo de la cuenta y aquí se
// verifica. El token nunca pasa por el navegador: lo guarda facturacion-admin.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Loader2, PlugZap, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react'

type Estado = { conectado: boolean; error: string | null; balance: any; entorno: any } | null

/** El saldo llega con la forma que devuelva SENHUB; se toma el primer número útil. */
function timbres(balance: any): number | null {
  if (typeof balance === 'number') return balance
  if (!balance || typeof balance !== 'object') return null
  for (const k of ['creditos', 'credits', 'balance', 'disponibles', 'available', 'saldo']) {
    const v = balance[k]
    if (typeof v === 'number') return v
    if (v && typeof v === 'object') { const n = timbres(v); if (n !== null) return n }
  }
  return null
}

export default function ConexionSenhub() {
  const [estado, setEstado] = useState<Estado>(null)
  const [cargando, setCargando] = useState(true)
  const [paso, setPaso] = useState<'nada' | 'codigo'>('nada')
  const [codigo, setCodigo] = useState('')
  const [busy, setBusy] = useState(false)

  const llamar = async (accion: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('facturacion-admin', { body: { accion, ...extra } })
    if (error || data?.error) throw new Error(data?.error || error?.message || 'Error')
    return data
  }

  const revisar = async () => {
    setCargando(true)
    try { setEstado(await llamar('senhub_estado')) }
    catch (e: any) { setEstado({ conectado: false, error: e.message, balance: null, entorno: null }) }
    finally { setCargando(false) }
  }
  useEffect(() => { revisar() }, [])

  const pedirCodigo = async () => {
    setBusy(true)
    try { const d = await llamar('senhub_otp_solicitar'); toast.success(`Te enviamos un código a ${d.email}`); setPaso('codigo') }
    catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }
  const verificar = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try { await llamar('senhub_otp_verificar', { code: codigo.trim() }); toast.success('SENHUB reconectado'); setPaso('nada'); setCodigo(''); await revisar() }
    catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  const n = timbres(estado?.balance)
  const entorno = estado?.entorno?.effective_environment || estado?.entorno?.entorno || null

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-navy-900 flex items-center gap-2">
          <PlugZap className="w-4 h-4 text-primary-700" aria-hidden="true" /> Conexión con SENHUB (timbrado)
        </p>
        <button onClick={revisar} disabled={cargando} className="btn-secondary text-xs">
          {cargando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />} Revisar
        </button>
      </div>

      {cargando ? (
        <p role="status" className="text-sm text-slate-500 mt-3">Revisando conexión…</p>
      ) : estado?.conectado ? (
        <div className="mt-3 flex items-start gap-2 text-sm text-success-700">
          <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>
            <b>Conectado.</b>{n !== null && <> Quedan <b>{n}</b> timbres.</>}{entorno && <> Entorno: <b>{entorno === 'production' ? 'producción (facturas reales)' : entorno}</b>.</>}
            {n !== null && n <= 5 && <span className="block text-amber-700 mt-1">Quedan pocos timbres: compra más en factura.senhub.me antes de que se acaben.</span>}
          </span>
        </div>
      ) : (
        <div className="mt-3">
          <div role="alert" className="flex items-start gap-2 text-sm text-red-700">
            <ShieldAlert className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span><b>Desconectado:</b> nadie puede facturar hasta reconectar. <span className="text-slate-500 break-all">({estado?.error})</span></span>
          </div>
          {paso === 'nada' ? (
            <button onClick={pedirCodigo} disabled={busy} className="btn-primary text-xs mt-3">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <PlugZap className="w-4 h-4" aria-hidden="true" />} Reconectar (te enviamos un código al correo)
            </button>
          ) : (
            <form onSubmit={verificar} className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="senhub-codigo" className="label">Código del correo (vence en 5 min)</label>
                <input id="senhub-codigo" className="input w-40 text-base sm:text-sm tracking-widest" inputMode="numeric" autoComplete="one-time-code"
                  value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="123456" required />
              </div>
              <button type="submit" disabled={busy || !codigo.trim()} className="btn-primary text-xs">
                {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Verificar
              </button>
              <button type="button" onClick={pedirCodigo} disabled={busy} className="btn-secondary text-xs">Reenviar código</button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
