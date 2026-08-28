/**
 * Cruce del texto completo de una memoria en PDF con los proyectos ya cargados.
 *
 * La memoria compilada trae una descripción de dos o tres líneas por actividad;
 * la memoria anual en PDF trae el relato completo, con nombres de disertantes,
 * instituciones y detalles de participación. Este módulo empareja ambos por
 * similitud de título y devuelve el bloque de texto que corresponde a cada uno.
 *
 * El emparejamiento es aproximado por naturaleza, así que exige un umbral alto
 * y `--dry-run` muestra qué uniría antes de tocar nada.
 */
import { execFileSync } from 'node:child_process'

export interface Bloque { titulo: string; texto: string }
export interface Cruce {
  proyecto_id: string
  nombre: string
  titulo: string
  puntaje: number
  detalle: string
  participacion?: string
}

const VACIAS = new Set([
  'de','del','la','el','los','las','en','y','a','con','para','por','un','una','al',
  'sobre','se','su','sus','que','como','the','of','entre','ante','desde','tras','e',
  'jornada','charla','taller','conferencia','curso','actividad','proyecto','visita',
  'magistral','universitaria','universitario','facultad','unida','estudiantes',
])

function fichas(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9ñ\s]/g, ' ')
      .split(/\s+/)
      .filter((p) => p.length > 3 && !VACIAS.has(p)),
  )
}

/** Jaccard sesgado hacia el título del proyecto, que es el más corto. */
export function similitud(a: string, b: string): number {
  const fa = fichas(a), fb = fichas(b)
  if (fa.size === 0 || fb.size === 0) return 0
  let comunes = 0
  for (const f of fa) if (fb.has(f)) comunes++
  return comunes / Math.min(fa.size, fb.size)
}

export function textoDelPdf(ruta: string): string {
  try {
    return execFileSync('pdftotext', ['-layout', ruta, '-'],
                        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    throw new Error(
      'Hace falta `pdftotext` para leer el PDF.\n' +
      '  Instálelo con:  sudo apt install poppler-utils',
    )
  }
}

/**
 * Parte el texto en bloques. Se toma como título toda línea corta que no sea
 * encabezado repetido, número de página ni parte de un párrafo.
 */
export function bloques(texto: string): Bloque[] {
  const lineas = texto.split('\n').map((l) => l.replace(/\s+$/, ''))
  const salida: Bloque[] = []
  let titulo = ''
  let cuerpo: string[] = []

  const esRuido = (l: string) =>
    /MEMORIA ANUAL/i.test(l) || /^\s*\d{1,3}\s*$/.test(l) || l.trim() === ''

  const esTitulo = (l: string) => {
    const t = l.trim()
    if (t.length < 6 || t.length > 110) return false
    if (/[.;]$/.test(t)) return false
    // Un título no arranca en minúscula ni termina en coma.
    if (!/^[«"“'¡¿A-ZÁÉÍÓÚÑ0-9•]/.test(t)) return false
    if (/,$/.test(t)) return false
    // Debe tener al menos dos palabras con contenido.
    return fichas(t).size >= 2
  }

  const cerrar = () => {
    const texto = cuerpo.join(' ').replace(/\s+/g, ' ').trim()
    if (titulo && texto.length > 80) salida.push({ titulo, texto })
    cuerpo = []
  }

  for (const l of lineas) {
    if (esRuido(l)) continue
    const sangrado = /^\s{0,10}\S/.test(l)
    if (esTitulo(l) && sangrado && cuerpo.join(' ').length > 60) {
      cerrar(); titulo = l.trim(); continue
    }
    if (esTitulo(l) && !titulo) { titulo = l.trim(); continue }
    cuerpo.push(l.trim())
  }
  cerrar()
  return salida
}

/** Frases que hablan de quiénes participaron. */
export function detallesDeParticipacion(texto: string): string {
  const frases = texto.split(/(?<=[.!?])\s+/)
  const pistas = /estudiantes|alumnos|participaron|participantes|asistieron|docentes|c[aá]tedra|disertante|a cargo de|beneficiari|comunidad|concurrieron|inscript/i
  const halladas = frases.filter((f) => pistas.test(f)).map((f) => f.trim())
  return halladas.slice(0, 6).join(' ')
}

export function cruzar(
  proyectos: { id: string; nombre: string }[],
  bloquesTexto: Bloque[],
  umbral: number,
): Cruce[] {
  const salida: Cruce[] = []
  const usados = new Set<number>()

  for (const p of proyectos) {
    let mejor = -1, mejorPuntaje = 0
    bloquesTexto.forEach((b, i) => {
      if (usados.has(i)) return
      const s = Math.max(similitud(p.nombre, b.titulo),
                         similitud(p.nombre, b.titulo + ' ' + b.texto.slice(0, 300)) * 0.85)
      if (s > mejorPuntaje) { mejorPuntaje = s; mejor = i }
    })
    if (mejor >= 0 && mejorPuntaje >= umbral) {
      usados.add(mejor)
      const b = bloquesTexto[mejor]!
      salida.push({
        proyecto_id: p.id, nombre: p.nombre, titulo: b.titulo,
        puntaje: Math.round(mejorPuntaje * 100) / 100,
        detalle: b.texto.slice(0, 4000),
        participacion: detallesDeParticipacion(b.texto) || undefined,
      })
    }
  }
  return salida
}
