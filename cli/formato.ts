/**
 * Lectura de los formatos oficiales de extensión universitaria.
 *
 *   Formato 9  — «Propuesta de Proyecto de Extensión Universitaria»
 *   Formato 10 — «Informe de Proyecto de Extensión Universitaria»
 *
 * Ambos son documentos de Word con tablas de dos columnas (rótulo | valor) y
 * una tabla de estudiantes con nombre, cédula, carrera, ciclo y matrícula.
 * Es el formulario que los docentes remiten por correo, así que conviene leerlo
 * tal cual en lugar de pedirles que carguen todo a mano.
 */
import { readFileSync } from 'node:fs'
import AdmZip from 'adm-zip'

export interface EstudianteFormato {
  nombre: string
  cedula?: string
  carrera?: string
  ciclo?: string
  matricula?: string
}

export interface ProyectoFormato {
  archivo: string
  formato: 9 | 10
  nombre: string
  campos: Record<string, string>
  docentes: string[]
  externos: string[]
  estudiantes: EstudianteFormato[]
  texto: string
}

const ROTULOS_TABLA = /^(docentes?|c[aá]tedra|funcionarios?|personas involucradas|nombre y apellido|otras? (organizaci|instituci)|cargo|instituciones)/i

/** Descarta rótulos de la tabla y celdas vacías. Una persona tiene dos palabras. */
function esPersona(v: string): boolean {
  const t = v.trim()
  if (t.length < 5 || t === '--' || /^[-–—.\s]*$/.test(t)) return false
  if (ROTULOS_TABLA.test(t)) return false
  const palabras = t.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter((p) => p.length > 1)
  return palabras.length >= 2
}

/**
 * El formulario suele traer «Dra. Ana Valenzuela / Comunicación Oral y Escrita»
 * en una sola celda. Se corta en el salto para quedarse con la persona.
 */
function recortarCatedra(v: string): string {
  let t = v.split(/\s{2,}|\s*[|]\s*/)[0] ?? v
  // «Dra. Ana Valenzuela Comunicación Oral. Y Esc.» → se corta en la materia.
  t = t.split(/\s+(?=(Comunicaci[oó]n|Derecho|Gesti[oó]n|C[aá]tedra|Tic|Sociolog|Polít|Planificaci)[a-záéíóúñ]*\b)/i)[0] ?? t
  // «Rosa Palau, CSJ» conserva la institución; «Nombre, Docente Experta» no.
  t = t.replace(/\s*[-–—]\s*(docente|profesor|experta?|invitad[oa]).*$/i, '')
  return t.trim().replace(/[,;:.]$/, '')
}

function limpiar(s: string): string {
  return s.replace(/<\/w:p>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

const sinTildes = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Rótulo del formulario → clave interna. */
const ROTULOS: [RegExp, string][] = [
  [/^nombre del proyecto/,            'nombre'],
  [/^localizacion/,                   'localizacion'],
  [/^lugar de ejecucion/,             'localizacion'],
  [/^otras organizaciones/,           'otras_organizaciones'],
  [/^lider del proyecto/,             'lider'],
  [/^entregable final/,               'entregable'],
  [/^proyecto.? relacionado/,         'proyectos_relacionados'],
  [/^fecha estimada de inicio/,       'fecha_inicio'],
  [/^fecha de inicio/,                'fecha_inicio'],
  [/^fecha estimada de finalizacion/, 'fecha_fin'],
  [/^fecha de finalizacion/,          'fecha_fin'],
  [/^tiempo total/,                   'tiempo_total'],
  [/^carrera/,                        'carreras'],
  [/^facultad/,                       'facultad'],
  [/^beneficiarios/,                  'beneficiarios'],
  [/^elaborado por/,                  'elaborado_por'],
  [/^aprobado por/,                   'aprobado_por'],
  [/^fecha del informe/,              'fecha_informe'],
  [/^objetivo general/,               'objetivo_general'],
  [/^objetivo especifico/,            'objetivos_especificos'],
  [/^metas/,                          'metas'],
  [/^metodologia/,                    'metodologia'],
  [/^introduccion/,                   'introduccion'],
  [/^justificacion/,                  'justificacion'],
  [/^alcance/,                        'alcance'],
  [/^resumen/,                        'resumen'],
  [/^conclusion/,                     'conclusiones'],
  [/^producto/,                       'producto'],
  [/^curso/,                          'curso'],
  [/^periodo academico/,              'periodo'],
  [/^docente/,                        'docentes_texto'],
]

function claveDe(rotulo: string): string | undefined {
  const r = sinTildes(rotulo).replace(/[:(].*$/, '').trim()
  for (const [re, clave] of ROTULOS) if (re.test(r)) return clave
  return undefined
}

/** «5.861.474» → «5861474»; descarta lo que no parezca documento. */
function documento(v: string): string | undefined {
  const t = v.replace(/[^0-9A-Za-z]/g, '')
  return /^[0-9]{5,10}$/.test(t) || /^[A-Za-z]{1,3}[0-9]{5,10}$/.test(t) ? t : undefined
}

export function leerFormato(ruta: string): ProyectoFormato {
  const zip = new AdmZip(readFileSync(ruta))
  const entrada = zip.getEntry('word/document.xml')
  if (!entrada) throw new Error(`${ruta}: no parece un .docx válido.`)
  const xml = entrada.getData().toString('utf8')

  const piezas = xml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []
  const campos: Record<string, string> = {}
  const estudiantes: EstudianteFormato[] = []
  const docentes: string[] = []
  const externos: string[] = []
  const sueltos: string[] = []

  let enTablaEstudiantes = false
  let enTablaParticipantes = false

  for (const pieza of piezas) {
    if (pieza.startsWith('<w:p')) {
      const t = limpiar(pieza)
      if (!t) continue
      sueltos.push(t)
      const n = sinTildes(t)
      if (n.startsWith('estudiantes')) { enTablaEstudiantes = true; enTablaParticipantes = false }
      else if (n.startsWith('participantes del proyecto')) {
        enTablaParticipantes = true; enTablaEstudiantes = false
      } else if (n.startsWith('tutor') || n.startsWith('clasificacion')
                 || n.startsWith('resumen') || n.startsWith('analisis')) {
        enTablaEstudiantes = false; enTablaParticipantes = false
      }
      continue
    }

    const celdas = (pieza.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) ?? []).map(limpiar)
    if (celdas.length === 0) continue

    // Tabla de estudiantes: nombre | C.I. | carrera | ciclo | matrícula
    if (enTablaEstudiantes && celdas.length >= 4) {
      const nombre = (celdas[0] ?? '').replace(/^\d+[.)]?\s*/, '').trim()
      if (nombre && !/^nombre y apellido/i.test(nombre) && nombre.length > 3) {
        estudiantes.push({
          nombre,
          cedula: documento(celdas[1] ?? ''),
          carrera: celdas[2] || undefined,
          ciclo: celdas[3] || undefined,
          matricula: (celdas[4] ?? '').replace(/[^0-9]/g, '') || undefined,
        })
      }
      continue
    }

    // Tabla de participantes. Viene en dos disposiciones: tres columnas
    // (docentes | funcionarios | otras instituciones) en el formato 9, o
    // rótulo | valor en el formato 10. Se distingue por la primera celda.
    if (enTablaParticipantes && celdas.length >= 2) {
      const limpio = (v: string) => v.replace(/^\d+[.\-)]?\s*/, '').trim()
      const primera = (celdas[0] ?? '').trim()

      if (/^docentes?\s*\/?\s*c[aá]tedra/i.test(primera)) {
        for (const c of celdas.slice(1)) if (esPersona(limpio(c))) {
          docentes.push(recortarCatedra(limpio(c)))
        }
        continue
      }
      if (/^personas involucradas|^otras? (instituci|organizaci)/i.test(primera)) {
        for (const c of celdas.slice(1)) if (esPersona(limpio(c))) {
          externos.push(recortarCatedra(limpio(c)))
        }
        continue
      }
      if (/^funcionarios/i.test(primera)) continue

      const nombre = limpio(celdas[0] ?? '')
      if (esPersona(nombre)) docentes.push(recortarCatedra(nombre))
      const ext = limpio(celdas[celdas.length - 1] ?? '')
      if (esPersona(ext) && ext !== nombre) externos.push(recortarCatedra(ext))
      continue
    }

    // Tabla rótulo | valor
    if (celdas.length >= 2) {
      const clave = claveDe(celdas[0] ?? '')
      const valor = celdas.slice(1).filter(Boolean).join(' ').trim()
      if (clave && valor && !campos[clave]) campos[clave] = valor
    }
  }

  const texto = sueltos.join('\n')
  const esInforme = /informe de proyectos? de\s+extension/i.test(sinTildes(texto).slice(0, 400))
    || campos.fecha_informe !== undefined

  // El nombre puede venir del cuadro o del título del documento.
  let nombre = campos.nombre ?? ''
  if (!nombre) {
    const t = sueltos.find((l) => l.length > 12 && l.length < 160
      && !/^(portada|proyecto de extension|facultad|curso|carrera|docente)/i.test(sinTildes(l)))
    nombre = t ?? ruta.split('/').pop() ?? 'Proyecto sin título'
  }

  return {
    archivo: ruta.split('/').pop() ?? ruta,
    formato: esInforme ? 10 : 9,
    nombre: nombre.replace(/^[“"']|[”"']$/g, '').trim(),
    campos, docentes: [...new Set(docentes)], externos: [...new Set(externos)],
    estudiantes, texto,
  }
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

/** «25/04/2026», «24 de setiembre de 2025», «Marzo 2026» → ISO cuando alcanza. */
export function fechaFormato(v: string | undefined): string | undefined {
  if (!v) return undefined
  const t = sinTildes(v)
  const dmy = t.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`
  const larga = t.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/)
  if (larga && MESES[larga[2]!]) {
    return `${larga[3]}-${String(MESES[larga[2]!]).padStart(2, '0')}-${larga[1]!.padStart(2, '0')}`
  }
  return undefined
}

/** Año, aunque no haya fecha exacta: «Mayo de 2026», «2026.1». */
export function anioFormato(p: ProyectoFormato): number | undefined {
  const fuentes = [p.campos.fecha_inicio, p.campos.fecha_informe, p.campos.periodo, p.texto.slice(0, 600)]
  for (const f of fuentes) {
    const m = (f ?? '').match(/(20\d{2})/)
    if (m) return Number(m[1])
  }
  return undefined
}

/** Horas reloj declaradas en «Tiempo total a ser utilizado». */
export function horasFormato(v: string | undefined): number {
  if (!v) return 0
  const m = v.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hs|horas)/i)
  return m ? Number(m[1]!.replace(',', '.')) : 0
}
