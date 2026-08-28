// Lee un proyecto o un informe de extensión desde el archivo que remitió la
// cátedra —Word, ODT o PDF— y devuelve los campos del formato oficial para
// precargar el formulario.
//
// Lo que llega no siempre es el formato oficial: a veces es una memoria en
// prosa. Por eso la extracción devuelve, además de los campos, la lista de lo
// que no encontró. Nada se guarda: la persona revisa y confirma.
//
// Formatos: el PDF va tal cual al modelo, que los lee de forma nativa. Word y
// ODT no los lee ninguno, así que se les extrae el texto acá: los dos son un
// ZIP con XML adentro y Deno trae DecompressionStream.
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

const TOPE_BYTES = 12 * 1024 * 1024

// ── ZIP mínimo ──────────────────────────────────────────────────────────────
// Solo hace falta sacar una entrada concreta. Se recorre el directorio central
// desde el final y se infla la entrada buscada.
async function entradaZip(datos: Uint8Array, nombre: string): Promise<string | null> {
  const dv = new DataView(datos.buffer, datos.byteOffset, datos.byteLength)
  // Fin del directorio central: firma 0x06054b50, buscada desde atrás.
  let fin = -1
  for (let i = datos.length - 22; i >= 0 && i > datos.length - 65558; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break }
  }
  if (fin < 0) return null

  const cantidad = dv.getUint16(fin + 10, true)
  let p = dv.getUint32(fin + 16, true)

  for (let n = 0; n < cantidad; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) return null
    const metodo    = dv.getUint16(p + 10, true)
    const compLen   = dv.getUint32(p + 20, true)
    const nomLen    = dv.getUint16(p + 28, true)
    const extraLen  = dv.getUint16(p + 30, true)
    const comLen    = dv.getUint16(p + 32, true)
    const desplaza  = dv.getUint32(p + 42, true)
    const nom = new TextDecoder().decode(datos.subarray(p + 46, p + 46 + nomLen))

    if (nom === nombre) {
      // Cabecera local: los campos de nombre y extra tienen otro largo.
      const lv = new DataView(datos.buffer, datos.byteOffset + desplaza, 30)
      if (lv.getUint32(0, true) !== 0x04034b50) return null
      const inicio = desplaza + 30 + lv.getUint16(26, true) + lv.getUint16(28, true)
      const crudo = datos.subarray(inicio, inicio + compLen)
      if (metodo === 0) return new TextDecoder().decode(crudo)
      if (metodo !== 8) return null
      const flujo = new Blob([crudo]).stream()
        .pipeThrough(new DecompressionStream('deflate-raw'))
      return await new Response(flujo).text()
    }
    p += 46 + nomLen + extraLen + comLen
  }
  return null
}

/** Texto plano de un XML de ofimática, conservando los saltos de párrafo y las
 *  separaciones de celda para que el modelo distinga las tablas. */
function textoDeXml(xml: string): string {
  return xml
    .replace(/<\/(w:p|text:p|text:h)>/g, '\n')
    .replace(/<\/(w:tc|table:table-cell)>/g, ' | ')
    .replace(/<\/(w:tr|table:table-row)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function textoDelArchivo(bytes: Uint8Array, mime: string, nombre: string) {
  const n = nombre.toLowerCase()
  if (mime === 'application/pdf' || n.endsWith('.pdf')) return { pdf: true, texto: '' }
  if (n.endsWith('.docx') || mime.includes('wordprocessingml')) {
    const xml = await entradaZip(bytes, 'word/document.xml')
    if (!xml) throw new Error('No pude abrir el .docx: ¿está dañado o es un .doc antiguo?')
    return { pdf: false, texto: textoDeXml(xml) }
  }
  if (n.endsWith('.odt') || mime.includes('opendocument.text')) {
    const xml = await entradaZip(bytes, 'content.xml')
    if (!xml) throw new Error('No pude abrir el .odt: ¿está dañado?')
    return { pdf: false, texto: textoDeXml(xml) }
  }
  if (mime.startsWith('text/')) return { pdf: false, texto: new TextDecoder().decode(bytes) }
  throw new Error(`Formato no admitido: ${mime || nombre}. Use Word, ODT o PDF.`)
}

// ── Qué se le pide al modelo ────────────────────────────────────────────────
const persona = {
  type: 'object',
  required: ['nombre', 'cedula', 'carrera', 'ciclo', 'matricula'],
  properties: {
    nombre: { type: 'string' }, cedula: { type: 'string' },
    carrera: { type: 'string' }, ciclo: { type: 'string' },
    matricula: { type: 'string' },
  },
}

const ESQUEMA_PROYECTO = {
  type: 'object',
  additionalProperties: false,
  required: ['nombre', 'clasificacion', 'carreras', 'curso', 'localizacion',
             'otras_organizaciones', 'lider', 'tutor', 'entregable', 'fecha_inicio',
             'fecha_fin', 'horas_reloj', 'introduccion', 'justificacion',
             'objetivo_general', 'metodologia', 'detalle', 'docentes', 'estudiantes',
             'externos', 'faltantes'],
  properties: {
    nombre: { type: 'string', description: 'Nombre del proyecto, tal como figura.' },
    clasificacion: {
      type: 'string',
      description: 'Una de: cursos_extracurriculares, prestaciones_servicio, ' +
        'actos_culturales, deportes, publicaciones, eventos_academicos, ' +
        'experiencia_conocimiento, otros. Es la casilla marcada en el cuadro ' +
        'CLASIFICACION DEL PROYECTO. Cadena vacía si no está marcada.',
    },
    carreras: {
      type: 'array', items: { type: 'string' },
      description: 'Solo de esta lista: "Derecho", "Ciencias Políticas", ' +
        '"Relaciones Internacionales y Negocios Globales". Vacío si no consta.',
    },
    curso: { type: 'string', description: 'Curso o cátedra. No es la carrera.' },
    localizacion: { type: 'string' },
    otras_organizaciones: { type: 'string', description: 'Vacío si dice N/A.' },
    lider: { type: 'string' },
    tutor: { type: 'string' },
    entregable: { type: 'string' },
    fecha_inicio: { type: 'string', description: 'AAAA-MM-DD. Vacío si no consta.' },
    fecha_fin: { type: 'string', description: 'AAAA-MM-DD. Vacío si no consta.' },
    horas_reloj: { type: 'string', description: 'Solo el número. Vacío si no consta.' },
    introduccion: { type: 'string' },
    justificacion: { type: 'string' },
    objetivo_general: { type: 'string' },
    metodologia: { type: 'string' },
    detalle: { type: 'string', description: 'Alcance, resultados esperados y metas.' },
    docentes: { type: 'array', items: { type: 'string' } },
    estudiantes: { type: 'array', items: persona },
    externos: { type: 'array', items: { type: 'string' } },
    faltantes: { type: 'array', items: { type: 'string' } },
  },
}

const ESQUEMA_INFORME = {
  type: 'object',
  additionalProperties: false,
  required: ['nombre', 'fecha_informe', 'resumen', 'resultados', 'conclusiones',
             'analisis', 'beneficiarios', 'docentes', 'estudiantes', 'faltantes'],
  properties: {
    nombre: { type: 'string', description: 'Nombre del proyecto al que informa.' },
    fecha_informe: { type: 'string', description: 'AAAA-MM-DD. Vacío si no consta.' },
    resumen: { type: 'string' },
    resultados: { type: 'string' },
    conclusiones: { type: 'string' },
    analisis: {
      type: 'array',
      items: {
        type: 'object', required: ['fila', 'planteado', 'alcanzado'],
        properties: {
          fila: { type: 'string' }, planteado: { type: 'string' },
          alcanzado: { type: 'string' },
        },
      },
    },
    beneficiarios: { type: 'string', description: 'Solo el número, si consta.' },
    docentes: { type: 'array', items: { type: 'string' } },
    estudiantes: { type: 'array', items: persona },
    faltantes: { type: 'array', items: { type: 'string' } },
  },
}

const SISTEMA = [
  'Extraes datos de documentos de Extensión Universitaria de la Facultad de',
  'Ciencias Jurídicas y Sociales de la UNIDA, Paraguay: el formato oficial 9',
  '"Proyecto de Extensión" y el 10 "Informe de Proyecto de Extensión".',
  '',
  'Reglas que no se negocian:',
  '1. TRANSCRIBÍS, NO REDACTÁS. Copiá lo que dice el documento. No completes,',
  '   no mejores la redacción, no resumas salvo que se te pida un resumen.',
  '2. NO INVENTES NADA. Si un campo no está en el documento, devolvelo vacío y',
  '   agregá su nombre a "faltantes". Es preferible un campo vacío a uno inventado.',
  '3. Las tablas del formato suelen venir con filas de ejemplo o en blanco.',
  '   Una fila con "1.", guiones, "N/A" o solo el rótulo NO es una persona.',
  '   Tampoco lo es un texto como "40 Alumnos": eso es un recuento, no un nombre.',
  '4. En la nómina de estudiantes, cada fila lleva nombre y apellido, cédula,',
  '   carrera, curso o ciclo y matrícula. Si una celda está vacía, dejala vacía.',
  '5. Las fechas van en AAAA-MM-DD. El documento puede usar 10.04.2025 o',
  '   "10 de abril de 2025": convertilas. Si el año no consta, dejá vacío.',
  '6. Respondé únicamente con el JSON del esquema pedido.',
].join('\n')

// ── Adaptadores ─────────────────────────────────────────────────────────────
interface Resultado { datos: unknown; entrada: number; salida: number }

const limpiarEsquema = (n: unknown): unknown => {
  if (Array.isArray(n)) return n.map(limpiarEsquema)
  if (n && typeof n === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
      if (k === 'additionalProperties') continue
      o[k] = limpiarEsquema(v)
    }
    return o
  }
  return n
}

async function conGoogle(key: string, modelo: string, esquema: unknown,
                         pedido: string, pdf?: string): Promise<Resultado> {
  const partes: unknown[] = [{ text: pedido }]
  if (pdf) partes.push({ inline_data: { mime_type: 'application/pdf', data: pdf } })
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SISTEMA }] },
      contents: [{ role: 'user', parts: partes }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: limpiarEsquema(esquema),
        maxOutputTokens: 16000,
      },
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${j?.error?.message ?? ''}`)
  const texto = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('')
  if (!texto) throw new Error('Gemini no devolvió contenido.')
  return { datos: JSON.parse(texto),
           entrada: j.usageMetadata?.promptTokenCount ?? 0,
           salida: j.usageMetadata?.candidatesTokenCount ?? 0 }
}

async function conAnthropic(key: string, modelo: string, esquema: unknown,
                            pedido: string, pdf?: string): Promise<Resultado> {
  const contenido: unknown[] = []
  if (pdf) {
    contenido.push({ type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdf } })
  }
  contenido.push({ type: 'text', text: pedido })
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key,
               'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: modelo, max_tokens: 16000, system: SISTEMA,
      thinking: { type: 'adaptive' },
      tools: [{ name: 'extraer', description: 'Devuelve los campos del documento.',
                input_schema: esquema, strict: true }],
      tool_choice: { type: 'tool', name: 'extraer' },
      messages: [{ role: 'user', content: contenido }],
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${j?.error?.message ?? ''}`)
  const bloque = (j.content ?? []).find((b: { type: string }) => b.type === 'tool_use')
  if (!bloque) throw new Error('Anthropic no devolvió datos utilizables.')
  return { datos: bloque.input, entrada: j.usage?.input_tokens ?? 0,
           salida: j.usage?.output_tokens ?? 0 }
}

async function conOpenAI(key: string, modelo: string, esquema: unknown,
                         pedido: string, base: string): Promise<Resultado> {
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelo,
      messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: pedido }],
      response_format: { type: 'json_schema',
        json_schema: { name: 'extraer', strict: true, schema: esquema } },
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`${base.includes('x.ai') ? 'xAI' : 'OpenAI'} ${r.status}: ${j?.error?.message ?? ''}`)
  const texto = j?.choices?.[0]?.message?.content
  if (!texto) throw new Error('El proveedor no devolvió contenido.')
  return { datos: JSON.parse(texto), entrada: j.usage?.prompt_tokens ?? 0,
           salida: j.usage?.completion_tokens ?? 0 }
}

// ── Punto de entrada ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({}, 200)
  if (req.method !== 'POST') return json({ error: 'Método no admitido.' }, 405)

  const autorizacion = req.headers.get('Authorization') ?? ''
  if (!autorizacion) return json({ error: 'Sin sesión.' }, 401)

  let cuerpo: { archivo?: string; mime?: string; nombre?: string; tipo?: string }
  try { cuerpo = await req.json() } catch { return json({ error: 'Cuerpo inválido.' }, 400) }

  const tipo = cuerpo.tipo === 'informe' ? 'informe' : 'proyecto'
  if (!cuerpo.archivo) return json({ error: 'Falta el archivo.' }, 400)

  let bytes: Uint8Array
  try {
    const limpio = cuerpo.archivo.includes(',')
      ? cuerpo.archivo.slice(cuerpo.archivo.indexOf(',') + 1) : cuerpo.archivo
    bytes = Uint8Array.from(atob(limpio), (c) => c.charCodeAt(0))
  } catch { return json({ error: 'No pude decodificar el archivo.' }, 400) }

  if (bytes.length > TOPE_BYTES) {
    return json({ error: `El archivo pesa ${(bytes.length / 1048576).toFixed(1)} MB y el ` +
      'tope es 12 MB. Si es un PDF escaneado, exporte solo las páginas del formato.' }, 413)
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: autorizacion } }, auth: { persistSession: false } },
  )

  // La sesión decide: si no puede ver la configuración, no tiene panel.
  const { data: cfgFilas, error: eCfg } = await db.from('configuracion').select('clave, valor')
  if (eCfg) return json({ error: 'Sin permiso para usar la lectura asistida.' }, 403)
  const cfg = Object.fromEntries((cfgFilas ?? []).map((c) => [c.clave, c.valor]))
  if ((cfg.ia_activa ?? 'true') !== 'true') {
    return json({ error: 'La lectura asistida está desactivada en Ajustes.' }, 503)
  }

  const proveedor = (cfg.ia_proveedor ?? 'google') as Proveedor
  if (!CLAVES[proveedor]) return json({ error: `Proveedor no reconocido: ${proveedor}` }, 400)
  const modelo = cfg.ia_modelo || POR_DEFECTO[proveedor]

  let apiKey = Deno.env.get(CLAVES[proveedor]) ?? ''
  if (!apiKey) {
    const servicio = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )
    const { data } = await servicio.rpc('clave_ia', { p_proveedor: proveedor })
    apiKey = (data as string | null) ?? ''
  }
  if (!apiKey) return json({ error: `Falta la clave de ${proveedor}.` }, 503)

  let extraido: { pdf: boolean; texto: string }
  try {
    extraido = await textoDelArchivo(bytes, cuerpo.mime ?? '', cuerpo.nombre ?? '')
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 400)
  }

  if (extraido.pdf && (proveedor === 'openai' || proveedor === 'xai')) {
    return json({ error: 'Ese proveedor no lee PDF acá. Elija Gemini o Claude en ' +
      'Ajustes, o convierta el documento a Word.' }, 400)
  }
  if (!extraido.pdf && extraido.texto.length < 120) {
    return json({ error: 'El documento no tiene texto legible. Si es un PDF escaneado, ' +
      'necesita reconocimiento óptico previo.' }, 400)
  }

  const esquema = tipo === 'informe' ? ESQUEMA_INFORME : ESQUEMA_PROYECTO
  const encabezado = tipo === 'informe'
    ? 'Extraé los datos de este INFORME de proyecto de extensión (formato 10).'
    : 'Extraé los datos de este PROYECTO de extensión (formato 9).'
  const pedido = extraido.pdf
    ? `${encabezado}\n\nEl documento va adjunto.`
    : `${encabezado}\n\nTexto del documento:\n\n---\n${extraido.texto.slice(0, 120000)}\n---`

  try {
    const r = proveedor === 'anthropic'
        ? await conAnthropic(apiKey, modelo, esquema, pedido,
                             extraido.pdf ? btoa(String.fromCharCode(...bytes)) : undefined)
      : proveedor === 'google'
        ? await conGoogle(apiKey, modelo, esquema, pedido,
                          extraido.pdf ? cuerpo.archivo!.split(',').pop() : undefined)
      : await conOpenAI(apiKey, modelo, esquema, pedido,
                        proveedor === 'xai' ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1')

    return json({ ok: true, tipo, datos: r.datos, proveedor, modelo,
                  tokens: { entrada: r.entrada, salida: r.salida } })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e).slice(0, 400) }, 502)
  }
})

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json',
               'Access-Control-Allow-Origin': '*',
               'Access-Control-Allow-Headers': 'authorization, content-type, apikey' },
  })
}
