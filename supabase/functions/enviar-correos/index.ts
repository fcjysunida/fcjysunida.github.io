// Drena la cola de correo. La invoca `app.drenar_correo()` por pg_cron cada
// quince minutos, con la clave de servicio en el encabezado.
//
// Proveedor: Resend. Es el único de plan gratuito que no mete su marca en el
// pie del mensaje, cosa impensable en un certificado institucional.
// Tope del plan: 3.000 envíos por mes, 100 por día. El tope diario lo respeta
// `correos_pendientes()` en la base, no esta función.
//
// Cambiar de proveedor es cambiar `enviar()`: el resto no se entera.
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface Pendiente {
  id: string
  destino: string
  nombre_destino: string | null
  asunto: string
  cuerpo_html: string
  cuerpo_texto: string | null
}

const RESEND = 'https://api.resend.com/emails'

Deno.serve(async (req: Request) => {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    return json({ ok: false, error: 'Falta RESEND_API_KEY en los secretos de la función.' }, 500)
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  let tope = 100
  try {
    const cuerpo = await req.json()
    if (typeof cuerpo?.tope === 'number') tope = cuerpo.tope
  } catch { /* sin cuerpo: se usa el tope por defecto */ }

  // Remitente y respuesta salen de la tabla de configuración, no del código.
  const { data: cfg } = await db.from('configuracion').select('clave, valor')
  const conf = Object.fromEntries((cfg ?? []).map((c) => [c.clave, c.valor]))
  const remitente = `${conf.correo_remitente_nombre ?? 'FCJYS UNIDA'} <${conf.correo_remitente}>`
  const responderA = conf.correo_responder_a ?? undefined

  const { data: lote, error } = await db.rpc('correos_pendientes', {
    p_tope_diario: tope,
    p_lote: 20,
  })
  if (error) return json({ ok: false, error: error.message }, 500)

  const pendientes = (lote ?? []) as Pendiente[]
  let enviados = 0
  let fallidos = 0

  for (const c of pendientes) {
    try {
      const r = await fetch(RESEND, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: remitente,
          to: [c.destino],
          subject: c.asunto,
          html: c.cuerpo_html,
          text: c.cuerpo_texto ?? undefined,
          reply_to: responderA,
        }),
      })
      const cuerpo = await r.json().catch(() => ({}))
      if (r.ok) {
        enviados++
        await db.rpc('correo_resultado', {
          p_id: c.id, p_ok: true, p_proveedor_id: cuerpo?.id ?? null, p_error: null,
        })
      } else {
        fallidos++
        await db.rpc('correo_resultado', {
          p_id: c.id, p_ok: false, p_proveedor_id: null,
          p_error: `${r.status} ${JSON.stringify(cuerpo).slice(0, 300)}`,
        })
      }
    } catch (e) {
      fallidos++
      await db.rpc('correo_resultado', {
        p_id: c.id, p_ok: false, p_proveedor_id: null,
        p_error: String(e).slice(0, 300),
      })
    }
  }

  return json({ ok: true, tomados: pendientes.length, enviados, fallidos })
})

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
