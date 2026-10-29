// Gestión de llaves API del usuario (crear / revocar / eliminar).
// La llave se genera en el navegador; solo se guarda su hash SHA-256 en la base.
// El token completo se muestra una sola vez.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { enApp } from '../../lib/enApp'
import { useAuth } from '../../context/AuthContext'
import { formatDatetime } from '../../lib/utils'
import toast from 'react-hot-toast'
import Modal from '../../components/Modal'
import { Plug, Plus, Copy, Check, Trash2, Ban, KeyRound, Lock, ArrowRight, BookOpen } from 'lucide-react'

// Endpoint público con dominio propio (proxy). La función interna queda oculta.
const ENDPOINT = 'https://cotizago.com.mx/api-cotizaciones'

// Planes que pueden crear llaves API. Cambia esta lista si renombras planes.
const PLANES_CON_API = ['negocio', 'pro']

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function ApiKeysPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, isAdminUser } = useAuth()
  // La API es para planes Negocio y Pro (el admin siempre puede).
  const puedeUsar = isAdminUser || PLANES_CON_API.includes((profile?.plan ?? '').toLowerCase())
  const [keys, setKeys] = useState<any[]>([])
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [tokenNuevo, setTokenNuevo] = useState('')   // se muestra una sola vez
  const [copiado, setCopiado] = useState('')

  const load = async () => {
    if (!profile?.workspace_id) return
    const { data } = await supabase.from('api_keys').select('*').eq('workspace_id', profile.workspace_id).order('created_at', { ascending: false })
    setKeys(data ?? [])
  }
  useEffect(() => { load() }, [profile?.workspace_id])

  const generar = async () => {
    if (!user || !profile?.workspace_id) return
    setCreando(true)
    try {
      const rnd = crypto.getRandomValues(new Uint8Array(32))
      const token = 'cg_live_' + hex(rnd.buffer)
      const token_hash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
      const { error } = await supabase.from('api_keys').insert({
        workspace_id: profile.workspace_id, user_id: user.id,
        nombre: nombre.trim() || t('api.sinNombre'), prefijo: token.slice(0, 16), token_hash,
      })
      if (error) throw error
      setTokenNuevo(token)
      setNombre('')
      load()
    } catch (e: any) {
      toast.error(e.message ?? 'Error')
    } finally {
      setCreando(false)
    }
  }

  const revocar = async (k: any) => {
    if (!confirm(t('api.confirmRevocar'))) return
    await supabase.from('api_keys').update({ activo: false }).eq('id', k.id)
    load()
  }
  const eliminar = async (k: any) => {
    if (!confirm(t('api.confirmEliminar'))) return
    await supabase.from('api_keys').delete().eq('id', k.id)
    load()
  }

  const copiar = async (txt: string, id: string) => {
    try { await navigator.clipboard.writeText(txt); setCopiado(id); setTimeout(() => setCopiado(''), 1500) } catch { /* */ }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2"><Plug className="w-6 h-6 text-primary-700" aria-hidden="true" /> {t('api.title')}</h1>
        <p className="text-slate-500 text-sm">{t('api.subtitle')}</p>
      </div>

      {/* Cómo usar */}
      <div className="card p-5 space-y-3">
        <p className="text-sm font-semibold text-navy-900">{t('api.comoUsar')}</p>
        <p className="text-sm text-slate-500">{t('api.infoDesc')}</p>
        <div>
          <p className="label">Endpoint</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-fondo rounded-lg px-3 py-2 text-navy-800 break-all">POST {ENDPOINT}</code>
            <button onClick={() => copiar(ENDPOINT, 'ep')} aria-label={copiado === 'ep' ? 'Endpoint copiado' : 'Copiar endpoint'} className="btn-secondary text-xs py-2 px-3 shrink-0">
              {copiado === 'ep' ? <Check className="w-4 h-4 text-success-700" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-medium text-primary-700">{t('api.verEjemplo')}</summary>
          <pre className="mt-2 bg-navy-900 text-slate-100 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed">{`curl -X POST '${ENDPOINT}' \\
  -H 'Authorization: Bearer TU_LLAVE_API' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "cliente": { "nombre": "Juan Pérez", "email": "juan@empresa.mx" },
    "items": [
      { "nombre": "Servicio", "cantidad": 1, "precio_unitario": 2500, "iva_porcentaje": 16 }
    ]
  }'`}</pre>
        </details>
        <Link to="/api" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:underline">
          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" /> Ver documentación completa
        </Link>
      </div>

      {/* Crear (solo Negocio/Pro) o aviso de mejora de plan */}
      {puedeUsar ? (
        <div className="card p-5">
          <p className="text-sm font-semibold text-navy-900 mb-3">{t('api.crearTitulo')}</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input aria-label={t('api.nombrePh')} className="input flex-1" placeholder={t('api.nombrePh')} value={nombre} onChange={e => setNombre(e.target.value)} />
            <button onClick={generar} disabled={creando} className="btn-primary justify-center shrink-0">
              {creando ? <span role="status" aria-label="Cargando" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
              {t('api.generar')}
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-6 border border-primary-100 bg-gradient-to-br from-primary-50/60 to-white">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary-600 text-navy-900 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-navy-900">La API está disponible en los planes Negocio y Pro</p>
              <p className="text-sm text-slate-600 mt-1">
                Mejora tu plan para generar llaves y crear cotizaciones automáticamente desde tus apps o integraciones.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {!enApp() && (
                  <button onClick={() => navigate('/app/folios')} className="btn-primary text-xs">
                    Mejorar mi plan <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
                <Link to="/api" className="btn-secondary text-xs">Ver qué incluye la API</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {keys.length === 0 ? (
        <div className="card p-10 text-center">
          <KeyRound className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-600 font-medium">{t('api.sinLlaves')}</p>
          <p className="text-slate-500 text-sm">{t('api.sinLlavesSub')}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
                  <th className="px-5 py-3 font-medium">{t('api.colNombre')}</th>
                  <th className="px-4 py-3 font-medium">{t('api.colLlave')}</th>
                  <th className="px-4 py-3 font-medium">{t('api.colEstado')}</th>
                  <th className="px-4 py-3 font-medium">{t('api.colUltimoUso')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('api.colAccion')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map(k => (
                  <tr key={k.id} className={`hover:bg-slate-50 ${!k.activo ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3 font-medium text-navy-900">{k.nombre}</td>
                    <td className="px-4 py-3"><code className="text-xs text-slate-500">{k.prefijo}…</code></td>
                    <td className="px-4 py-3">
                      <span className={`badge ${k.activo ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>{k.activo ? t('api.activa') : t('api.revocada')}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{k.last_used_at ? formatDatetime(k.last_used_at) : t('api.nunca')}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {k.activo && (
                          <button onClick={() => revocar(k)} title={t('api.revocar')} aria-label={`${t('api.revocar')}: ${k.nombre}`} className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Ban className="w-4 h-4" aria-hidden="true" /></button>
                        )}
                        <button onClick={() => eliminar(k)} title={t('api.eliminar')} aria-label={`${t('api.eliminar')}: ${k.nombre}`} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: token recién creado (se muestra una sola vez) */}
      {tokenNuevo && (
        // Sin cierre por fondo ni Escape: la llave se muestra una sola vez y un
        // clic accidental la perdería. Se cierra solo con «Entendido».
        <Modal ancho="max-w-lg" sinCerrar titulo={t('api.tuLlave')}>
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <KeyRound className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> {t('api.guardala')}
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-fondo rounded-lg px-3 py-2.5 text-navy-800 break-all">{tokenNuevo}</code>
                <button onClick={() => copiar(tokenNuevo, 'tok')} aria-label={copiado === 'tok' ? 'Llave copiada' : 'Copiar llave'} className="btn-primary text-xs py-2.5 px-3 shrink-0">
                  {copiado === 'tok' ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
              <button onClick={() => setTokenNuevo('')} className="btn-secondary w-full justify-center">{t('api.entendido')}</button>
            </div>
        </Modal>
      )}
    </div>
  )
}
