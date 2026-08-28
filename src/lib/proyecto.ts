import type { ClasificacionProyecto, EstadoProyecto, TipoParticipante } from './tipos'

export const CLASIFICACIONES: { id: ClasificacionProyecto; label: string }[] = [
  { id: 'cursos_extracurriculares', label: 'Cursos extracurriculares' },
  { id: 'prestaciones_servicio',    label: 'Prestaciones de servicio' },
  { id: 'actos_culturales',         label: 'Actos vinculados con el arte y la cultura' },
  { id: 'deportes',                 label: 'Deportes' },
  { id: 'publicaciones',            label: 'Publicaciones' },
  { id: 'eventos_academicos',       label: 'Eventos académicos' },
  { id: 'experiencia_conocimiento', label: 'Adquisición de experiencia y conocimientos' },
  { id: 'otros',                    label: 'Otros (especificar)' },
]

export const ESTADOS_PROYECTO: { id: EstadoProyecto; label: string }[] = [
  { id: 'borrador',     label: 'Borrador' },
  { id: 'presentado',   label: 'Presentado' },
  { id: 'aprobado',     label: 'Aprobado' },
  { id: 'en_ejecucion', label: 'En ejecución' },
  { id: 'finalizado',   label: 'Finalizado' },
  { id: 'rechazado',    label: 'Rechazado' },
]

export const TIPOS_PARTICIPANTE: { id: TipoParticipante; label: string }[] = [
  { id: 'docente',     label: 'Docente / cátedra' },
  { id: 'funcionario', label: 'Funcionario de la UNIDA' },
  { id: 'externo',     label: 'Otra institución u organización' },
  { id: 'estudiante',  label: 'Estudiante' },
]

/** Rubros y fuentes del cuadro de presupuesto del formato oficial. */
export const RUBROS = [
  ['movilidad',             'Movilidad'],
  ['omnibus',               'Ómnibus u otros medios'],
  ['pasajes',               'Pasajes'],
  ['combustible',           'Combustible'],
  ['estadia',               'Estadía'],
  ['materiales_fungibles',  'Materiales fungibles a ser utilizados'],
  ['materiales_distribuir', 'Materiales a ser distribuidos'],
  ['equipos',               'Equipos o instrumentos a ser utilizados'],
  ['honorarios',            'Honorarios'],
  ['peliculas',             'Películas, cintas, revelados, impresiones'],
  ['edicion',               'Edición de informaciones'],
] as const

export const FUENTES = [
  ['estado',     'Recursos del Estado'],
  ['unida',      'Recursos institucionales — UNIDA'],
  ['prestamos',  'Préstamos'],
  ['donaciones', 'Donaciones'],
  ['otros',      'Otros (autogestión)'],
] as const

/** Cuadro de créditos académicos del formato oficial. */
export const CREDITOS = [
  ['certificados',    'Certificados'],
  ['reconocimientos', 'Reconocimientos'],
  ['premios',         'Premios'],
  ['otros',           'Otros estímulos'],
] as const

export const DESTINATARIOS = [
  ['docentes',    'Docentes'],
  ['estudiantes', 'Estudiantes'],
  ['otros',       'Otros participantes'],
] as const

export const etiquetaClasificacion = (c: ClasificacionProyecto) =>
  CLASIFICACIONES.find((x) => x.id === c)?.label ?? c
export const etiquetaEstadoProyecto = (e: EstadoProyecto) =>
  ESTADOS_PROYECTO.find((x) => x.id === e)?.label ?? e
export const etiquetaTipoParticipante = (t: TipoParticipante) =>
  TIPOS_PARTICIPANTE.find((x) => x.id === t)?.label ?? t
