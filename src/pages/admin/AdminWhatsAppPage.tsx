import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import {
  Save, MessageCircle, Eye, EyeOff, RefreshCw, QrCode,
  CheckCircle, XCircle, AlertCircle, Send, Smartphone, FileText
} from 'lucide-react'

type Tab = 'config' | 'plantillas' | 'test'

const DEFAULT_TEMPLATES = {
  wa_tpl_cotizacion: `Hola {nombre_cliente} 👋

Te compartimos tu cotización *#{numero_cotizacion}* de *{empresa}*.

💰 Total: *{total}*
📅 Válida hasta: {vigencia}

Puedes revisarla y aprobarla aquí:
🔗 {link}

¿Tienes alguna pregunta? Con gusto te ayudamos.`,

  wa_tpl_recordatorio: `Hola {nombre_cliente} 👋

Te recordamos que tu cotización *#{numero_cotizacion}* de *{empresa}* sigue pendiente.

💰 Total: *{total}*

Puedes revisarla aquí:
🔗 {link}

¡Estamos a tus órdenes! 😊`,

  wa_tpl_aceptada: `¡Excelente noticia! 🎉

*{empresa}* - Tu cotización *#{numero_cotizacion}* fue aceptada.

Ya podemos proceder. En breve nos pondremos en contacto contigo.

¡Muchas gracias por tu preferencia! ✅`,

  wa_tpl_pago_exitoso: `¡Pago confirmado! ✅

Hola {nombre_cliente}, recibimos tu pago correctamente.

📦 Pack: {paquete}
🗂 Folios acreditados: {folios}
💳 Monto: {monto}

Ya puedes crear tus cotizaciones en:
🔗 {link}`,
}

const TEMPLATE_LABELS: Record<string, { labelKey: string; descKey: string; vars: string[] }> = {
  wa_tpl_cotizacion: {
    labelKey: 'adm.wa.tlCotizacion',
    descKey: 'adm.wa.tlCotizacionDesc',
    vars: ['{nombre_cliente}', '{numero_cotizacion}', '{empresa}', '{total}', '{vigencia}', '{link}'],
  },
  wa_tpl_recordatorio: {
    labelKey: 'adm.wa.tlRecordatorio',
    descKey: 'adm.wa.tlRecordatorioDesc',
    vars: ['{nombre_cliente}', '{numero_cotizacion}', '{empresa}', '{total}', '{link}'],
  },
  wa_tpl_aceptada: {
    labelKey: 'adm.wa.tlAceptada',
    descKey: 'adm.wa.tlAceptadaDesc',
    vars: ['{empresa}', '{numero_cotizacion}'],
  },
  wa_tpl_pago_exitoso: {
    labelKey: 'adm.wa.tlPago',
    descKey: 'adm.wa.tlPagoDesc',
    vars: ['{nombre_cliente}', '{paquete}', '{folios}', '{monto}', '{link}'],
  },
}

export default function AdminWhatsAppPage() {
  const { t: tr } = useTranslation()
  const [tab, setTab] = useState<Tab>('config')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrData, setQrData] = useState<string | null>(null)
  const [connStatus, setConnStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown')
  const [checkingConn, setCheckingConn] = useState(false)
  const [templates, setTemplates] = useState<Record<string, string>>(DEFAULT_TEMPLATES)
  const [savingTpl, setSavingTpl] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState(tr('adm.wa.testMsgDefault'))
  const [sending, setSending] = useState(false)

  useEffect(() => {
    supabase.from('config_plataforma').select('*').then(({ data }) => {
      const map: Record<string, string> = {}
      data?.forEach(d => { map[d.clave] = d.valor ?? '' })
      setConfig(map)
      // Cargar templates guardados
      const tpl: Record<string, string> = { ...DEFAULT_TEMPLATES }
      Object.keys(DEFAULT_TEMPLATES).forEach(k => {
        if (map[k]) tpl[k] = map[k]
      })
      setTemplates(tpl)
    })
  }, [])

  const saveConfig = async () => {
    setSaving(true)
    for (const key of ['mibot_access_token', 'mibot_instance_id']) {
      await supabase.from('config_plataforma')
        .upsert({ clave: key, valor: config[key] ?? '', updated_at: new Date().toISOString() }, { onConflict: 'clave' })
    }
    toast.success(tr('adm.wa.credGuardadas'))
    setSaving(false)
  }

  const saveTemplates = async () => {
    setSavingTpl(true)
    for (const [key, val] of Object.entries(templates)) {
      await supabase.from('config_plataforma')
        .upsert({ clave: key, valor: val, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
    }
    toast.success(tr('adm.wa.plantillasGuardadas'))
    setSavingTpl(false)
  }

  const getQRCode = async () => {
    const token = config['mibot_access_token']
    const instanceId = config['mibot_instance_id']
    if (!token || !instanceId) {
      toast.error(tr('adm.wa.primeroTokens'))
      return
    }
    setQrLoading(true)
    setQrData(null)
    try {
      const res = await fetch(
        `https://mibot.chat/api/get_qrcode?instance_id=${instanceId}&access_token=${token}`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (data?.qrcode) {
        setQrData(data.qrcode)
        toast.success(tr('adm.wa.qrGenerado'))
      } else if (data?.message?.toLowerCase().includes('connected') || data?.status === 'connected') {
        setConnStatus('connected')
        toast.success(tr('adm.wa.yaConectado'))
      } else {
        toast.error(data?.message ?? tr('adm.wa.noQr'))
      }
    } catch {
      toast.error(tr('adm.wa.errorMibot'))
    }
    setQrLoading(false)
  }

  const checkConnection = async () => {
    const token = config['mibot_access_token']
    const instanceId = config['mibot_instance_id']
    if (!token || !instanceId) {
      toast.error(tr('adm.wa.configPrimero'))
      return
    }
    setCheckingConn(true)
    try {
      const res = await fetch(
        `https://mibot.chat/api/reconnect?instance_id=${instanceId}&access_token=${token}`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (data?.status === 'success' || data?.message?.toLowerCase().includes('success')) {
        setConnStatus('connected')
        toast.success(tr('adm.wa.conectadoOk'))
      } else {
        setConnStatus('disconnected')
        toast.error(tr('adm.wa.noConectadoQr'))
      }
    } catch {
      setConnStatus('disconnected')
    }
    setCheckingConn(false)
  }

  const sendTest = async () => {
    const token = config['mibot_access_token']
    const instanceId = config['mibot_instance_id']
    if (!token || !instanceId) return toast.error(tr('adm.wa.configWaPrimero'))
    if (!testPhone) return toast.error(tr('adm.wa.ingresaNumero'))
    setSending(true)
    try {
      const res = await fetch('https://mibot.chat/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: testPhone.replace(/[^0-9]/g, ''),
          type: 'text',
          message: testMsg,
          instance_id: instanceId,
          access_token: token,
        }),
      })
      const data = await res.json()
      if (data?.status === 'success') {
        toast.success(tr('adm.wa.mensajeEnviado'))
      } else {
        toast.error(data?.message ?? tr('adm.wa.errorEnviando'))
      }
    } catch {
      toast.error(tr('adm.wa.errorConexion'))
    }
    setSending(false)
  }

  const tabs = [
    { id: 'config' as Tab, label: tr('adm.wa.tabConfig'), icon: Smartphone },
    { id: 'plantillas' as Tab, label: tr('adm.wa.tabPlantillas'), icon: FileText },
    { id: 'test' as Tab, label: tr('adm.wa.tabTest'), icon: Send },
  ]

  const isConfigured = !!(config['mibot_access_token'] && config['mibot_instance_id'])

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{tr('adm.wa.title')}</h1>
        <p className="text-slate-500 text-sm">{tr('adm.wa.subtitle')}</p>
      </div>

      {/* Status banner */}
      <div role="status" className={`flex items-center gap-3 p-4 rounded-xl border ${
        connStatus === 'connected' ? 'bg-green-50 border-green-200' :
        connStatus === 'disconnected' ? 'bg-red-50 border-red-200' :
        'bg-amber-50 border-amber-200'
      }`}>
        {connStatus === 'connected'
          ? <CheckCircle className="w-5 h-5 text-green-700 flex-shrink-0" aria-hidden="true" />
          : connStatus === 'disconnected'
          ? <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" aria-hidden="true" />
          : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" aria-hidden="true" />
        }
        <div className="flex-1">
          <p className={`text-sm font-semibold ${
            connStatus === 'connected' ? 'text-green-800' :
            connStatus === 'disconnected' ? 'text-red-800' : 'text-amber-800'
          }`}>
            {connStatus === 'connected' ? tr('adm.wa.conectado') :
             connStatus === 'disconnected' ? tr('adm.wa.desconectado') : tr('adm.wa.desconocido')}
          </p>
          <p className={`text-xs mt-0.5 ${
            connStatus === 'connected' ? 'text-green-700' :
            connStatus === 'disconnected' ? 'text-red-700' : 'text-amber-700'
          }`}>
            {connStatus === 'connected' ? tr('adm.wa.conectadoSub') :
             connStatus === 'disconnected' ? tr('adm.wa.desconectadoSub') :
             isConfigured ? tr('adm.wa.verificarSub') :
             tr('adm.wa.configurarSub')}
          </p>
        </div>
        {isConfigured && (
          <button type="button" onClick={checkConnection} disabled={checkingConn} aria-busy={checkingConn}
            className="text-xs text-slate-600 hover:text-slate-800 flex items-center gap-1 flex-shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${checkingConn ? 'animate-spin' : ''}`} aria-hidden="true" />
            {tr('adm.wa.verificar')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl" role="group" aria-label={tr('adm.wa.title')}>
        {tabs.map(tb => (
          <button key={tb.id} type="button" onClick={() => setTab(tb.id)} aria-pressed={tab === tb.id}
            className={`flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === tb.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}>
            <tb.icon className="w-4 h-4" aria-hidden="true" />
            {tb.label}
          </button>
        ))}
      </div>

      {/* Tab: Configuración */}
      {tab === 'config' && (
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-800 mb-1">{tr('adm.wa.credenciales')}</h2>
            <p className="text-xs text-slate-500">{tr('adm.wa.encuentralas')} <a href="https://mibot.chat" target="_blank" rel="noreferrer" className="underline text-primary-700">mibot.chat</a></p>
          </div>

          <div>
            <label className="label" htmlFor="wa-token">{tr('adm.wa.accessToken')}</label>
            <p className="text-xs text-slate-500 mb-1" id="wa-token-pista">{tr('adm.wa.accessTokenPista')}</p>
            <div className="relative">
              <input
                id="wa-token"
                aria-describedby="wa-token-pista"
                type={revealed ? 'text' : 'password'}
                className="input pr-11 font-mono text-xs"
                placeholder="6759e0fb0084f..."
                value={config['mibot_access_token'] ?? ''}
                onChange={e => setConfig(c => ({ ...c, mibot_access_token: e.target.value }))}
                autoComplete="off"
              />
              <button type="button" onClick={() => setRevealed(r => !r)} aria-label={revealed ? 'Ocultar token' : 'Mostrar token'} aria-pressed={revealed} aria-controls="wa-token"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700">
                {revealed ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="wa-instancia">{tr('adm.wa.instanceId')}</label>
            <p className="text-xs text-slate-500 mb-1" id="wa-instancia-pista">{tr('adm.wa.instanceIdPista')}</p>
            <input
              id="wa-instancia"
              aria-describedby="wa-instancia-pista"
              className="input font-mono text-xs"
              placeholder="6A317B10DC94A"
              value={config['mibot_instance_id'] ?? ''}
              onChange={e => setConfig(c => ({ ...c, mibot_instance_id: e.target.value }))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" onClick={saveConfig} disabled={saving} aria-busy={saving} className="btn-primary">
              {saving && <span aria-hidden="true" className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              <Save className="w-4 h-4" aria-hidden="true" /> {tr('adm.wa.guardarCredenciales')}
            </button>
            <button type="button" onClick={getQRCode} disabled={qrLoading || !isConfigured} aria-busy={qrLoading}
              className="btn-secondary flex items-center gap-2">
              {qrLoading
                ? <span aria-hidden="true" className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                : <QrCode className="w-4 h-4" aria-hidden="true" />
              }
              {tr('adm.wa.obtenerQR')}
            </button>
          </div>

          {/* QR Code display */}
          {qrData && (
            <div className="flex flex-col items-center gap-3 p-5 bg-white border-2 border-dashed border-green-300 rounded-xl">
              <p className="text-sm font-semibold text-slate-700">{tr('adm.wa.escaneaQr')}</p>
              {qrData.startsWith('data:image') || qrData.startsWith('http') ? (
                <img src={qrData} alt={tr('adm.wa.escaneaQr')} width={192} height={192} className="w-48 h-48 rounded-lg" />
              ) : (
                <div className="bg-slate-100 rounded-lg p-4 font-mono text-xs text-slate-600 max-w-full overflow-auto">
                  {qrData}
                </div>
              )}
              <p className="text-xs text-slate-500">{tr('adm.wa.abreWhatsApp')}</p>
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
            <p className="text-xs text-slate-500">
              <strong>{tr('adm.wa.comoFuncionaTitle')}</strong> {tr('adm.wa.comoFuncionaTxt')}
            </p>
          </div>
        </div>
      )}

      {/* Tab: Plantillas */}
      {tab === 'plantillas' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs text-blue-700 font-medium mb-1">{tr('adm.wa.variablesDisp')}</p>
            <p className="text-xs text-blue-700">
              {tr('adm.wa.variablesIntro')}
              <code className="ml-1 bg-blue-100 px-1 rounded">{'{'+'nombre_cliente'+'}'}</code>,
              <code className="ml-1 bg-blue-100 px-1 rounded">{'{'+'numero_cotizacion'+'}'}</code>,
              <code className="ml-1 bg-blue-100 px-1 rounded">{'{'+'empresa'+'}'}</code>,
              <code className="ml-1 bg-blue-100 px-1 rounded">{'{'+'total'+'}'}</code>,
              <code className="ml-1 bg-blue-100 px-1 rounded">{'{'+'link'+'}'}</code>
            </p>
          </div>

          {Object.entries(TEMPLATE_LABELS).map(([key, info]) => (
            <div key={key} className="card p-5 space-y-3">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm" id={`${key}-lbl`}>{tr(info.labelKey)}</h3>
                <p className="text-xs text-slate-500" id={`${key}-desc`}>{tr(info.descKey)}</p>
              </div>
              <textarea
                aria-labelledby={`${key}-lbl`}
                aria-describedby={`${key}-desc`}
                rows={6}
                className="input font-mono text-xs resize-none leading-relaxed"
                value={templates[key] ?? ''}
                onChange={e => setTemplates(t => ({ ...t, [key]: e.target.value }))}
              />
              <div className="flex flex-wrap gap-1">
                {info.vars.map(v => (
                  <span key={v} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">{v}</span>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button type="button" onClick={saveTemplates} disabled={savingTpl} aria-busy={savingTpl} className="btn-primary">
              {savingTpl && <span aria-hidden="true" className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              <Save className="w-4 h-4" aria-hidden="true" /> {tr('adm.wa.guardarPlantillas')}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Test */}
      {tab === 'test' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">{tr('adm.wa.enviarPrueba')}</h2>
          {!isConfigured && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-700">{tr('adm.wa.primeroGuarda1')}<strong>{tr('adm.wa.tabConfig')}</strong>{tr('adm.wa.primeroGuarda2')}</p>
            </div>
          )}
          <div>
            <label className="label" htmlFor="wa-prueba-tel">{tr('adm.wa.numeroTelefono')}</label>
            <input
              id="wa-prueba-tel"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              aria-describedby="wa-prueba-tel-ej"
              className="input"
              placeholder={tr('adm.wa.numeroPh')}
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1" id="wa-prueba-tel-ej">{tr('adm.wa.numeroEjemplo')}</p>
          </div>
          <div>
            <label className="label" htmlFor="wa-prueba-msg">{tr('adm.wa.mensajePrueba')}</label>
            <textarea
              id="wa-prueba-msg"
              rows={4}
              className="input resize-none"
              value={testMsg}
              onChange={e => setTestMsg(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={sendTest} disabled={sending || !isConfigured} aria-busy={sending} className="btn-primary">
              {sending
                ? <span aria-hidden="true" className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <MessageCircle className="w-4 h-4" aria-hidden="true" />
              }
              {tr('adm.wa.enviarPruebaBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
