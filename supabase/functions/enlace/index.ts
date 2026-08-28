// Página puente para los enlaces que se reparten.
//
// GitHub Pages no sabe de rutas de una aplicación de una sola página: ante
// /f/:token devuelve 404.html con estado 404. Casi ningún rastreador arma vista
// previa sobre un 404, y por eso los enlaces se compartían pelados.
//
// Esta función responde 200 con las etiquetas Open Graph de la actividad
// concreta —título, fechas, lugar, portada— y manda a la persona al formulario.
// El rastreador se queda con el HTML; quien hace clic sigue de largo.

const SITIO = Deno.env.get('SITIO_PUBLICO') ?? 'https://fcjysunida.github.io'
const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ))
}

function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[(m ?? 1) - 1]} de ${a}`
}

function rango(inicio: string, dias: number): string {
  if (!inicio) return ''
  if (dias <= 1) return fechaLarga(inicio)
  const fin = new Date(`${inicio}T12:00:00Z`)
  fin.setUTCDate(fin.getUTCDate() + dias - 1)
  return `Del ${fechaLarga(inicio)} al ${fechaLarga(fin.toISOString().slice(0, 10))}`
}

const MODALIDAD: Record<string, string> = {
  presencial: 'Presencial', virtual: 'Virtual', hibrida: 'Modalidad híbrida',
}

// Las mismas portadas que ofrece el constructor. El RPC devuelve el
// identificador, no la dirección; la correspondencia se repite acá porque la
// función corre en Deno y no comparte código con el frontend.
const commons = (n: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${n}?width=1200`
const PORTADAS: Record<string, string> = {
  juridico:      commons('Palacio%20de%20Justicia%20Paraguay%20by%20Felipe%20M%C3%A9ndez.jpg'),
  institucional: commons('Palacio%20legislativo%20en%20Asunci%C3%B3n.jpg'),
  ambiental:     commons('Chaco%20Boreal%20Paraguay.jpg'),
  tecnologico:   commons('Cern%20datacenter.jpg'),
  cientifico:    commons('Scientist%20looking%20thorugh%20microscope.jpg'),
}

function pagina(o: {
  titulo: string; descripcion: string; url: string; imagen: string; destino: string
}): string {
  const t = escapar(o.titulo)
  const d = escapar(o.descripcion)
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="FCJYS UNIDA" />
<meta property="og:locale" content="es_PY" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${escapar(o.url)}" />
<meta property="og:image" content="${escapar(o.imagen)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${escapar(o.imagen)}" />
<link rel="canonical" href="${escapar(o.destino)}" />
<meta http-equiv="refresh" content="0; url=${escapar(o.destino)}" />
<style>
  body { font-family: system-ui, sans-serif; background:#fff7f4; color:#211a18;
         display:flex; min-height:100vh; align-items:center; justify-content:center;
         margin:0; padding:24px; text-align:center; }
  a { color:#ad331b; }
  @media (prefers-color-scheme: dark) { body { background:#19120f; color:#ebe0dd; } a { color:#ff9f7b; } }
</style>
</head>
<body>
  <div>
    <h1 style="font-size:22px">${t}</h1>
    <p>Le estamos llevando al formulario…</p>
    <p><a href="${escapar(o.destino)}">Continuar</a></p>
  </div>
  <script>location.replace(${JSON.stringify(o.destino)})</script>
</body>
</html>`
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  // .../enlace/f/<token>  o  .../enlace/a/<token>
  const partes = url.pathname.split('/').filter(Boolean)
  const i = partes.indexOf('enlace')
  const tipo = partes[i + 1] ?? ''
  const token = partes[i + 2] ?? ''

  const cabeceras = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' }

  if ((tipo !== 'f' && tipo !== 'a') || !/^[a-f0-9]{16,64}$/.test(token)) {
    return new Response(pagina({
      titulo: 'Inscripciones y asistencia — FCJYS UNIDA',
      descripcion: 'Actividades de extensión universitaria de la Facultad de Ciencias Jurídicas y Sociales.',
      url: `${SITIO}/`, imagen: `${SITIO}/assets/og.png`, destino: `${SITIO}/`,
    }), { status: 200, headers: cabeceras })
  }

  const destino = `${SITIO}/${tipo}/${token}`

  // La misma función pública que usa el formulario. Solo devuelve datos que ya
  // son públicos: título, fechas, lugar y portada.
  let act: Record<string, unknown> | null = null
  try {
    const r = await fetch(`${URL_SUPABASE}/rest/v1/rpc/actividad_por_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON, authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ p_token: token }),
    })
    if (r.ok) act = await r.json()
  } catch { /* si falla, se responde la ficha genérica */ }

  if (!act || typeof act.titulo !== 'string') {
    return new Response(pagina({
      titulo: 'Inscripciones y asistencia — FCJYS UNIDA',
      descripcion: 'Actividades de extensión universitaria de la Facultad de Ciencias Jurídicas y Sociales.',
      url: destino, imagen: `${SITIO}/assets/og.png`, destino,
    }), { status: 200, headers: cabeceras })
  }

  const titulo = String(act.titulo)
  const ficha = [
    rango(String(act.fecha_inicio ?? ''), Number(act.dias ?? 1)),
    MODALIDAD[String(act.modalidad ?? '')] ?? '',
    act.lugar ? String(act.lugar) : '',
  ].filter(Boolean).join(' · ')

  const propia = typeof act.descripcion === 'string' ? act.descripcion.trim() : ''
  const accion = tipo === 'a' ? 'Registro de asistencia.' : 'Inscripción abierta.'
  // La descripción de la actividad manda; la ficha de fechas y lugar la
  // complementa hasta donde entra en una vista previa.
  const descripcion = (propia ? `${ficha}. ${propia}` : `${ficha}. ${accion}`).slice(0, 300)

  return new Response(pagina({
    titulo: `${titulo} — FCJYS UNIDA`,
    descripcion,
    url: destino,
    imagen: PORTADAS[String(act.portada ?? '')] ?? `${SITIO}/assets/og.png`,
    destino,
  }), { status: 200, headers: cabeceras })
})
