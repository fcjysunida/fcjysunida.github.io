// Borrador del informe de proyecto de extension, redactado con IA.
// El proveedor se elige en Ajustes: anthropic, google, openai o xai. Cada uno se
// factura por separado. La clave sale de los secretos de la funcion o, si no
// esta ahi, de la boveda de la base. La forma del pedido y del resultado es la
// misma en los cuatro: cambia el adaptador.
// No inventa cifras: si el proyecto esta vinculado a una actividad recibe
// inscriptos, asistencias y encuesta reales, y tiene prohibido estimar lo que no
// tiene. Lo que falta lo devuelve senalado en una lista aparte.
import { createClient } from 'jsr:@supabase/supabase-js@2'

type Proveedor = 'anthropic' | 'google' | 'openai' | 'xai'

const CLAVES: Record<Proveedor, string> = {
  anthropic: 'ANTHROPIC_API_KEY', google: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY', xai: 'XAI_API_KEY',
}
const POR_DEFECTO: Record<Proveedor, string> = {
  anthropic: 'claude-opus-5', google: 'gemini-3-pro',
  openai: 'gpt-5', xai: 'grok-4',
}

const campoTexto = (d: string) => ({ type: 'string', description: d })
const fila = (props: string[]) => ({
  type: 'array',
  items: {
    type: 'object', additionalProperties: false, required: props,
    properties: Object.fromEntries(props.map((p) => [p, { type: 'string' }])),
  },
})

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['resumen','metodologia','conclusiones','analisis','plan','metas','faltantes'],
  properties: {
    resumen: campoTexto('Resumen del proyecto, 2 a 4 parrafos, registro institucional formal.'),
    metodologia: campoTexto('Como se desarrollo el trabajo: fases, procedimientos, modalidad.'),
    conclusiones: campoTexto('Conclusiones y acciones de mejora, 1 a 3 parrafos.'),
    analisis: fila(['fila','planteado','alcanzado']),
    plan: fila(['actividad','responsables','cronograma']),
    metas: fila(['meta','indicadores','recursos']),
    faltantes: { type: 'array', items: { type: 'string' } },
  },
}

const SISTEMA = [
  'Redactas borradores del "Informe de Proyecto de Extension Universitaria"',
  '(formato oficial 10) de la Facultad de Ciencias Juridicas y Sociales de la',
  'Universidad de la Integracion de las Americas, Paraguay.',
  '',
  'Reglas que no se negocian:',
  '1. NO INVENTES CIFRAS. Usa unicamente los numeros que aparecen en los datos.',
  '   Si falta un dato, escribi "a completar" y agregalo a la lista faltantes.',
  '2. No atribuyas dichos ni resultados a personas que no figuren en los datos.',
  '3. Escribi en espanol, registro institucional formal, tercera persona, pasado.',
  '   Sin adjetivos publicitarios ni relleno.',
  '4. Si hay actividad vinculada, apoya el analisis en las cifras reales de',
  '   inscripcion, asistencia y satisfaccion, y nombralas explicitamente.',
  '5. El cuadro de analisis lleva una fila por concepto, cuando haya informacion:',
  '   "Objetivo general", "Objetivos especificos", "Metas", "Producto (entregable)".',
  '6. Es un borrador para que un docente revise. No afirmes lo que los datos no',
  '   respalden. Responde unicamente con el JSON del esquema pedido.',
].join('\n')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({}, 200)
  if (req.method !== 'POST') return json({ error: 'Metodo no admitido.' }, 405)

  const autorizacion = req.headers.get('Authorization') ?? ''
  if (!autorizacion) return json({ error: 'Sin sesion.' }, 401)

  let proyectoId = ''
  try {
    const c = await req.json()
    proyectoId = String(c?.proyecto_id ?? '')
  } catch { /* se valida abajo */ }
  if (!proyectoId) return json({ error: 'Falta el identificador del proyecto.' }, 400)

  // Cliente con la sesion del docente: la base decide que proyecto puede ver.
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: autorizacion } }, auth: { persistSession: false } },
  )

  const { data: cfgFilas } = await db.from('configuracion').select('clave, valor')
  const cfg = Object.fromEntries((cfgFilas ?? []).map((c) => [c.clave, c.valor]))
  if ((cfg.ia_activa ?? 'true') !== 'true') {
    return json({ error: 'La redaccion asistida esta desactivada en Ajustes.' }, 503)
  }

  const proveedor = (cfg.ia_proveedor ?? 'google') as Proveedor
  if (!CLAVES[proveedor]) return json({ error: `Proveedor no reconocido: ${proveedor}` }, 400)
  const modelo = cfg.ia_modelo || POR_DEFECTO[proveedor]

  // La clave sale del secreto de la funcion; si no esta, de la boveda de la base,
  // que solo `service_role` puede leer.
  let apiKey = Deno.env.get(CLAVES[proveedor]) ?? ''
  if (!apiKey) {
    const servicio = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )
    const { data } = await servicio.rpc('clave_ia', { p_proveedor: proveedor })
    apiKey = (data as string | null) ?? ''
  }
  if (!apiKey) {
    return json({ error: `Falta la clave de ${proveedor}. Cargala como secreto ` +
      `${CLAVES[proveedor]} de la funcion, o en la boveda de la base.` }, 503)
  }

  const { data: contexto, error } = await db.rpc('proyecto_contexto', { p_proyecto: proyectoId })
  if (error) return json({ error: error.message }, 403)

  const pedido = 'Datos del proyecto:\n\n```json\n' +
    JSON.stringify(contexto, null, 2) + '\n```\n\nRedacta el borrador del informe.'

  try {
    const r = proveedor === 'anthropic' ? await conAnthropic(apiKey, modelo, pedido)
            : proveedor === 'google'    ? await conGoogle(apiKey, modelo, pedido)
            : await conOpenAI(apiKey, modelo, pedido,
                proveedor === 'xai' ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1')

    await db.rpc('registrar_redaccion_ia', {
      p_proyecto: proyectoId, p_modelo: modelo, p_proveedor: proveedor,
      p_entrada: r.entrada, p_salida: r.salida,
    })
    return json({ ok: true, borrador: r.borrador, proveedor, modelo })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e).slice(0, 400) }, 502)
  }
})

interface Resultado { borrador: unknown; entrada: number; salida: number }

async function conAnthropic(key: string, modelo: string, pedido: string): Promise<Resultado> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key,
               'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: modelo, max_tokens: 8000, system: SISTEMA,
      thinking: { type: 'adaptive' }, output_config: { effort: 'medium' },
      tools: [{ name: 'informe', description: 'Devuelve el borrador del informe.',
                input_schema: ESQUEMA, strict: true }],
      tool_choice: { type: 'tool', name: 'informe' },
      messages: [{ role: 'user', content: pedido }],
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${j?.error?.message ?? ''}`)
  const bloque = (j.content ?? []).find((b: { type: string }) => b.type === 'tool_use')
  if (!bloque) throw new Error('Anthropic no devolvio un informe utilizable.')
  return { borrador: bloque.input, entrada: j.usage?.input_tokens ?? 0,
           salida: j.usage?.output_tokens ?? 0 }
}

async function conGoogle(key: string, modelo: string, pedido: string): Promise<Resultado> {
  // Gemini no admite additionalProperties en responseSchema: se quita.
  const limpiar = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(limpiar)
    if (n && typeof n === 'object') {
      const o: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
        if (k === 'additionalProperties') continue
        o[k] = limpiar(v)
      }
      return o
    }
    return n
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SISTEMA }] },
      contents: [{ role: 'user', parts: [{ text: pedido }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: limpiar(ESQUEMA),
        maxOutputTokens: 8000,
      },
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${j?.error?.message ?? ''}`)
  const texto = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('')
  if (!texto) throw new Error('Gemini no devolvio contenido.')
  return { borrador: JSON.parse(texto),
           entrada: j.usageMetadata?.promptTokenCount ?? 0,
           salida: j.usageMetadata?.candidatesTokenCount ?? 0 }
}

async function conOpenAI(key: string, modelo: string, pedido: string,
                         base: string): Promise<Resultado> {
  // xAI expone la misma interfaz que OpenAI: cambia la URL, no el cuerpo.
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelo,
      messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: pedido }],
      response_format: { type: 'json_schema',
        json_schema: { name: 'informe', strict: true, schema: ESQUEMA } },
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`${base.includes('x.ai') ? 'xAI' : 'OpenAI'} ${r.status}: ` +
                             `${j?.error?.message ?? ''}`)
  const texto = j?.choices?.[0]?.message?.content
  if (!texto) throw new Error('El proveedor no devolvio contenido.')
  return { borrador: JSON.parse(texto), entrada: j.usage?.prompt_tokens ?? 0,
           salida: j.usage?.completion_tokens ?? 0 }
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json',
               'Access-Control-Allow-Origin': '*',
               'Access-Control-Allow-Headers': 'authorization, content-type, apikey' },
  })
}
