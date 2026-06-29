import { useEffect, useState } from 'react'
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

const TEMPLATE_LABELS: Record<string, { label: string; desc: string; vars: string[] }> = {
  wa_tpl_cotizacion: {
    label: 'Envío de cotización',
    desc: 'Se usa al enviar una cotización a un cliente vía WhatsApp',
    vars: ['{nombre_cliente}', '{numero_cotizacion}', '{empresa}', '{total}', '{vigencia}', '{link}'],
  },
  wa_tpl_recordatorio: {
    label: 'Recordatorio',
    desc: 'Para recordar a un cliente que tiene una cotización pendiente',
    vars: ['{nombre_cliente}', '{numero_cotizacion}', '{empresa}', '{total}', '{link}'],
  },
  wa_tpl_aceptada: {
    label: 'Cotización aceptada',
    desc: 'Notificación al cliente cuando acepta una cotización',
    vars: ['{empresa}', '{numero_cotizacion}'],
  },
  wa_tpl_pago_exitoso: {
    label: 'Pago exitoso (Stripe)',
    desc: 'Confirmación de compra de folios',
    vars: ['{nombre_cliente}', '{paquete}', '{folios}', '{monto}', '{link}'],
  },
}

export default function AdminWhatsAppPage() {
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
  const [testMsg, setTestMsg] = useState('Hola, este es un mensaje de prueba desde CotizaGo ✅')
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
    toast.success('Credenciales de WhatsApp guardadas')
    setSaving(false)
  }

  const saveTemplates = async () => {
    setSavingTpl(true)
    for (const [key, val] of Object.entries(templates)) {
      await supabase.from('config_plataforma')
        .upsert({ clave: key, valor: val, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
    }
    toast.success('Plantillas de WhatsApp guardadas')
    setSavingTpl(false)
  }

  const getQRCode = async () => {
    const token = config['mibot_access_token']
    const instanceId = config['mibot_instance_id']
    if (!token || !instanceId) {
      toast.error('Primero guarda el Access Token e Instance ID')
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
        toast.success('QR generado — escanéalo con tu WhatsApp')
      } else if (data?.message?.toLowerCase().includes('connected') || data?.status === 'connected') {
        setConnStatus('connected')
        toast.success('WhatsApp ya está conectado')
      } else {
        toast.error(data?.message ?? 'No se pudo obtener el QR')
      }
    } catch {
      toast.error('Error conectando con mibot.chat. Verifica tus credenciales.')
    }
    setQrLoading(false)
  }

  const checkConnection = async () => {
    const token = config['mibot_access_token']
    const instanceId = config['mibot_instance_id']
    if (!token || !instanceId) {
      toast.error('Configura tus credenciales primero')
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
        toast.success('WhatsApp conectado correctamente')
      } else {
        setConnStatus('disconnected')
        toast.error('WhatsApp no conectado — obtén el QR para reconectar')
      }
    } catch {
      setConnStatus('disconnected')
    }
    setCheckingConn(false)
  }

  const sendTest = async () => {
    const token = config['mibot_access_token']
    const instanceId = config['mibot_instance_id']
    if (!token || !instanceId) return toast.error('Configura WhatsApp primero')
    if (!testPhone) return toast.error('Ingresa un número de teléfono')
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
        toast.success('¡Mensaje enviado correctamente!')
      } else {
        toast.error(data?.message ?? 'Error enviando mensaje')
      }
    } catch {
      toast.error('Error de conexión con mibot.chat')
    }
    setSending(false)
  }

  const tabs = [
    { id: 'config' as Tab, label: 'Configuración', icon: Smartphone },
    { id: 'plantillas' as Tab, label: 'Plantillas', icon: FileText },
    { id: 'test' as Tab, label: 'Envío de prueba', icon: Send },
  ]

  const isConfigured = !!(config['mibot_access_token'] && config['mibot_instance_id'])

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">WhatsApp — mibot.chat</h1>
        <p className="text-slate-500 text-sm">Envía cotizaciones y notificaciones por WhatsApp desde CotizaGo</p>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${
        connStatus === 'connected' ? 'bg-green-50 border-green-200' :
        connStatus === 'disconnected' ? 'bg-red-50 border-red-200' :
        'bg-amber-50 border-amber-200'
      }`}>
        {connStatus === 'connected'
          ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          : connStatus === 'disconnected'
          ? <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
        }
        <div className="flex-1">
          <p className={`text-sm font-semibold ${
            connStatus === 'connected' ? 'text-green-800' :
            connStatus === 'disconnected' ? 'text-red-800' : 'text-amber-800'
          }`}>
            {connStatus === 'connected' ? 'WhatsApp conectado ✓' :
             connStatus === 'disconnected' ? 'WhatsApp desconectado' : 'Estado desconocido'}
          </p>
          <p className={`text-xs mt-0.5 ${
            connStatus === 'connected' ? 'text-green-600' :
            connStatus === 'disconnected' ? 'text-red-600' : 'text-amber-600'
          }`}>
            {connStatus === 'connected' ? 'Los mensajes de WhatsApp están activos.' :
             connStatus === 'disconnected' ? 'Obtén el QR y escanéalo para reconectar.' :
             isConfigured ? 'Haz clic en "Verificar conexión" para comprobar el estado.' :
             'Configura tus credenciales de mibot.chat para empezar.'}
          </p>
        </div>
        {isConfigured && (
          <button onClick={checkConnection} disabled={checkingConn}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 flex-shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${checkingConn ? 'animate-spin' : ''}`} />
            Verificar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Configuración */}
      {tab === 'config' && (
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-800 mb-1">Credenciales mibot.chat</h2>
            <p className="text-xs text-slate-400">Encuéntralas en tu panel de <a href="https://mibot.chat" target="_blank" className="underline text-primary-600">mibot.chat</a></p>
          </div>

          <div>
            <label className="label">Access Token</label>
            <p className="text-xs text-slate-400 mb-1">📍 Panel mibot.chat → perfil → Access Token</p>
            <div className="relative">
              <input
                type={revealed ? 'text' : 'password'}
                className="input pr-10 font-mono text-xs"
                placeholder="6759e0fb0084f..."
                value={config['mibot_access_token'] ?? ''}
                onChange={e => setConfig(c => ({ ...c, mibot_access_token: e.target.value }))}
                autoComplete="off"
              />
              <button type="button" onClick={() => setRevealed(r => !r)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Instance ID</label>
            <p className="text-xs text-slate-400 mb-1">📍 Panel mibot.chat → Instances → tu instance</p>
            <input
              className="input font-mono text-xs"
              placeholder="6A317B10DC94A"
              value={config['mibot_instance_id'] ?? ''}
              onChange={e => setConfig(c => ({ ...c, mibot_instance_id: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={saveConfig} disabled={saving} className="btn-primary">
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Save className="w-4 h-4" /> Guardar credenciales
            </button>
            <button onClick={getQRCode} disabled={qrLoading || !isConfigured}
              className="btn-secondary flex items-center gap-2">
              {qrLoading
                ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                : <QrCode className="w-4 h-4" />
              }
              Obtener QR Code
            </button>
          </div>

          {/* QR Code display */}
          {qrData && (
            <div className="flex flex-col items-center gap-3 p-5 bg-white border-2 border-dashed border-green-300 rounded-xl">
              <p className="text-sm font-semibold text-slate-700">Escanea este QR con WhatsApp</p>
              {qrData.startsWith('data:image') || qrData.startsWith('http') ? (
                <img src={qrData} alt="QR Code" className="w-48 h-48 rounded-lg" />
              ) : (
                <div className="bg-slate-100 rounded-lg p-4 font-mono text-xs text-slate-600 max-w-full overflow-auto">
                  {qrData}
                </div>
              )}
              <p className="text-xs text-slate-400">Abre WhatsApp → tres puntos → Dispositivos vinculados → Vincular dispositivo</p>
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
            <p className="text-xs text-slate-500">
              <strong>¿Cómo funciona?</strong> mibot.chat actúa como puente entre CotizaGo y tu cuenta de WhatsApp.
              Al escanear el QR con tu teléfono, los mensajes se envían desde tu número real de WhatsApp.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Plantillas */}
      {tab === 'plantillas' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs text-blue-700 font-medium mb-1">Variables disponibles</p>
            <p className="text-xs text-blue-600">
              Usa estas variables en tus plantillas y se reemplazarán automáticamente al enviar:
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
                <h3 className="font-semibold text-slate-800 text-sm">{info.label}</h3>
                <p className="text-xs text-slate-400">{info.desc}</p>
              </div>
              <textarea
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
            <button onClick={saveTemplates} disabled={savingTpl} className="btn-primary">
              {savingTpl && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Save className="w-4 h-4" /> Guardar plantillas
            </button>
          </div>
        </div>
      )}

      {/* Tab: Test */}
      {tab === 'test' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Enviar mensaje de prueba</h2>
          {!isConfigured && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-700">Primero guarda tus credenciales en la pestaña <strong>Configuración</strong>.</p>
            </div>
          )}
          <div>
            <label className="label">Número de teléfono (con código de país)</label>
            <input
              className="input"
              placeholder="521234567890 (sin + ni espacios)"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">Ejemplo: 521234567890 para México</p>
          </div>
          <div>
            <label className="label">Mensaje de prueba</label>
            <textarea
              rows={4}
              className="input resize-none"
              value={testMsg}
              onChange={e => setTestMsg(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button onClick={sendTest} disabled={sending || !isConfigured} className="btn-primary">
              {sending
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <MessageCircle className="w-4 h-4" />
              }
              Enviar prueba
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
