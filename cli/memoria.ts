/**
 * Lectura de las memorias anuales de Extensión.
 *
 * El documento organiza el contenido en secciones «MEMORIA <año>», y dentro de
 * cada una, tablas de tres columnas —Actividad, Fecha, Descripción— bajo un
 * encabezado de categoría. Se recorre el cuerpo en orden para saber, en cada
 * fila, a qué año y a qué categoría pertenece.
 */
import { readFileSync } from 'node:fs'
import { unzipSync } from 'node:zlib'
import AdmZip from 'adm-zip'

export interface ActividadMemoria {
  anio: number
  categoria: string
  nombre: string
  fechaTexto: string
  descripcion: string
  fecha?: string            // ISO, solo cuando el documento trae la fecha exacta
  clasificacion: string
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
}

/** «3 de noviembre de 2021» → 2021-11-03. Un año suelto no da fecha. */
export function fechaDe(texto: string, anio: number): string | undefined {
  const t = texto.toLowerCase()
  const m = t.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/)
  if (m) {
    const mes = MESES[m[2]!.normalize('NFD').replace(/[̀-ͯ]/g, '')]
    if (mes) return `${m[3]}-${String(mes).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`
  }
  // «noviembre de 2021», sin día: no alcanza para fechar la actividad.
  const soloAnio = t.match(/^\s*(\d{4})\s*$/)
  if (soloAnio && Number(soloAnio[1]) === anio) return undefined
  return undefined
}

/** Clasificación según la tipología del anexo oficial, a partir del título. */
export function clasificar(nombre: string, categoria: string): string {
  const t = nombre.toLowerCase()
  const tiene = (...p: string[]) => p.some((x) => t.includes(x))

  if (tiene('libro', 'publicación', 'publicacion', 'revista', 'artículo', 'articulo',
            'audiovisual', 'boletín', 'boletin')) return 'publicaciones'
  if (tiene('asesoría', 'asesoria', 'consultorio', 'asistencia', 'campaña', 'campana',
            'operativo', 'servicio')) return 'prestaciones_servicio'
  if (tiene('visita', 'recorrido', 'trabajo de campo', 'pasantía', 'pasantia',
            'viaje de estudio', 'encuesta', 'relevamiento')) return 'experiencia_conocimiento'
  if (tiene('taller', 'curso', 'capacitación', 'capacitacion', 'entrenamiento',
            'inducción', 'induccion', 'claustro', 'workshop')) return 'cursos_extracurriculares'
  if (tiene('torneo', 'campeonato', 'deportiv')) return 'deportes'
  if (tiene('concierto', 'teatro', 'danza', 'festival', 'coro', 'muestra',
            'exposición artística')) return 'actos_culturales'
  if (categoria === 'Capacitación Interna') return 'cursos_extracurriculares'
  return 'eventos_academicos'
}

function texto(frag: string): string {
  return frag
    .replace(/<\/w:p>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function leerMemoria(ruta: string): ActividadMemoria[] {
  const zip = new AdmZip(readFileSync(ruta))
  const entrada = zip.getEntry('word/document.xml')
  if (!entrada) throw new Error('El archivo no parece un .docx válido.')
  const xml = entrada.getData().toString('utf8')

  const piezas = xml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []
  const CATEGORIAS = ['Extensión Universitaria', 'Internacionalización', 'Capacitación Interna']

  let anio: number | null = null
  let categoria: string | null = null
  const salida: ActividadMemoria[] = []

  for (const pieza of piezas) {
    const t = texto(pieza)
    if (!t) continue

    if (pieza.startsWith('<w:p')) {
      const m = t.match(/^MEMORIA (\d{4})$/)
      if (m) { anio = Number(m[1]); categoria = null; continue }
      if (CATEGORIAS.includes(t)) { categoria = t; continue }
      if (t.startsWith('Imágenes destacadas')) { categoria = null; continue }
      continue
    }

    const celdas = (pieza.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) ?? []).map(texto)
    if (celdas.length < 3) continue
    if (celdas[0] === 'Actividad') continue          // encabezado de la tabla
    if (!anio || !categoria || !celdas[0]) continue

    const nombre = celdas[0]!
    salida.push({
      anio, categoria, nombre,
      fechaTexto: celdas[1] ?? '',
      descripcion: celdas[2] ?? '',
      fecha: fechaDe(celdas[1] ?? '', anio),
      clasificacion: clasificar(nombre, categoria),
    })
  }
  return salida
}
