/** Estructura del menú del panel, agrupada por tipo de contenido.
 *
 *  Antes eran dieciséis pestañas sueltas en una fila que se desbordaba en dos.
 *  Ahora hay seis entradas de primer nivel y el segundo nivel aparece solo para
 *  el grupo en el que uno está: se ve menos y se encuentra antes. */

export type Entrada = { a: string; label: string; nota?: string }
export type Grupo = { id: string; label: string; items: Entrada[] }

export const GRUPOS: Grupo[] = [
  {
    id: 'actividades',
    label: 'Actividades',
    items: [
      { a: '/admin/nueva',         label: 'Nueva actividad', nota: 'Constructor del formulario' },
      { a: '/admin/inscripciones', label: 'Inscripciones',   nota: 'Ver y editar inscriptos' },
      { a: '/admin/asistencia',    label: 'Asistencia',      nota: 'Registrar por jornada' },
      { a: '/admin/certificados',  label: 'Constancias',     nota: 'Emitir e imprimir' },
    ],
  },
  {
    id: 'extension',
    label: 'Extensión',
    items: [
      { a: '/admin/proyectos', label: 'Proyectos', nota: 'Formatos oficiales 9 y 10' },
      { a: '/admin/eventos',   label: 'Eventos',   nota: 'Reuniones, visitas y convenios' },
    ],
  },
  {
    id: 'estudiantes',
    label: 'Estudiantes',
    items: [
      { a: '/admin/padron',    label: 'Padrón',             nota: 'Nómina por período' },
      { a: '/admin/extension', label: 'Horas de extensión', nota: 'Cumplimiento por persona' },
      { a: '/admin/pasantias', label: 'Pasantías',          nota: 'Seguimiento y plazos' },
    ],
  },
  {
    id: 'informes',
    label: 'Informes',
    items: [
      { a: '/admin/indicadores', label: 'Estadísticas', nota: 'Informe mensual DTC' },
      { a: '/admin/calidad',     label: 'Calidad',      nota: 'CSAT y NPS por actividad' },
    ],
  },
  {
    id: 'institucion',
    label: 'Institución',
    items: [
      { a: '/admin/normas',    label: 'Normograma',         nota: 'Marco normativo' },
      { a: '/admin/usuarios',  label: 'Usuarios',           nota: 'Acceso y roles' },
      { a: '/admin/seguridad', label: 'Protección de datos', nota: 'Auditoría y derechos' },
      { a: '/admin/ajustes',   label: 'Ajustes',            nota: 'Correo, IA y parámetros' },
    ],
  },
]

/** Qué grupo corresponde a una ruta. Se compara por prefijo para que las
 *  pantallas de detalle —un proyecto, la impresión de constancias— sigan
 *  marcando su grupo. La coincidencia más larga gana: /admin/extension no debe
 *  resolverse por /admin/e… de otro grupo. */
export function grupoDe(ruta: string): Grupo | null {
  let mejor: { grupo: Grupo; largo: number } | null = null
  for (const g of GRUPOS) {
    for (const it of g.items) {
      if (ruta === it.a || ruta.startsWith(it.a + '/')) {
        if (!mejor || it.a.length > mejor.largo) mejor = { grupo: g, largo: it.a.length }
      }
    }
  }
  return mejor?.grupo ?? null
}
