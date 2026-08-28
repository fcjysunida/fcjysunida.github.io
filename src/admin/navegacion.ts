/** Estructura del menú del panel, agrupada por tipo de contenido.
 *
 *  Antes eran dieciséis pestañas sueltas en una fila que se desbordaba en dos.
 *  Ahora hay seis entradas de primer nivel y el segundo nivel aparece solo para
 *  el grupo en el que uno está: se ve menos y se encuentra antes. */

export type Entrada = { a: string; label: string; nota?: string; icono: string }
export type Grupo = { id: string; label: string; icono: string; items: Entrada[] }

export const GRUPOS: Grupo[] = [
  {
    id: 'actividades', label: 'Actividades', icono: 'actividad',
    items: [
      { a: '/admin/nueva',         label: 'Nueva actividad', icono: 'mas',        nota: 'Constructor del formulario' },
      { a: '/admin/inscripciones', label: 'Inscripciones',   icono: 'personas',   nota: 'Ver y editar inscriptos' },
      { a: '/admin/asistencia',    label: 'Asistencia',      icono: 'ok',         nota: 'Registrar por jornada' },
      { a: '/admin/certificados',  label: 'Constancias',     icono: 'constancia', nota: 'Emitir e imprimir' },
    ],
  },
  {
    id: 'extension', label: 'Extensión', icono: 'extension',
    items: [
      { a: '/admin/proyectos', label: 'Proyectos', icono: 'libro',      nota: 'Formatos oficiales 9 y 10' },
      { a: '/admin/eventos',   label: 'Registros',  icono: 'calendario', nota: 'Sin inscripción: se cargan después' },
    ],
  },
  {
    id: 'estudiantes', label: 'Estudiantes', icono: 'estudiantes',
    items: [
      { a: '/admin/padron',    label: 'Padrón',             icono: 'personas', nota: 'Nómina por período' },
      { a: '/admin/extension', label: 'Horas de extensión', icono: 'reloj',    nota: 'Cumplimiento por persona' },
      { a: '/admin/pasantias', label: 'Pasantías',          icono: 'maletin',  nota: 'Seguimiento y plazos' },
    ],
  },
  {
    id: 'informes', label: 'Informes', icono: 'informes',
    items: [
      { a: '/admin/indicadores', label: 'Estadísticas', icono: 'informes', nota: 'Informe mensual DTC' },
      { a: '/admin/calidad',     label: 'Calidad',      icono: 'ok',       nota: 'CSAT y NPS por actividad' },
    ],
  },
  {
    id: 'institucion', label: 'Institución', icono: 'institucion',
    items: [
      { a: '/admin/normas',    label: 'Normograma',          icono: 'libro',    nota: 'Marco normativo' },
      { a: '/admin/usuarios',  label: 'Usuarios',            icono: 'personas', nota: 'Acceso y roles' },
      { a: '/admin/seguridad', label: 'Protección de datos', icono: 'escudo',   nota: 'Auditoría y derechos' },
      { a: '/admin/ajustes',   label: 'Ajustes',             icono: 'ajustes',  nota: 'Correo, IA y parámetros' },
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
