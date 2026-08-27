// Tipos compartidos. Espejo del esquema de supabase/migrations.

export type Rol = 'admin' | 'coordinacion' | 'docente' | 'secretaria' | 'auditor'

export type TipoActividad =
  | 'extension' | 'publica' | 'vinculacion' | 'proyecto_extension'
  | 'capacitacion_docente' | 'actividad_estudiantil' | 'investigacion'

export type EstadoActividad = 'borrador' | 'publicada' | 'cerrada' | 'finalizada'
export type EstadoInscripcion = 'confirmada' | 'en_espera' | 'anulada'
export type Modalidad = 'presencial' | 'virtual' | 'hibrida'
export type Condicion = 'estudiante' | 'docente' | 'egresado' | 'externo'

export type TipoCampo =
  | 'texto' | 'parrafo' | 'email' | 'tel' | 'cedula' | 'numero' | 'fecha'
  | 'unica' | 'casillas' | 'lista' | 'escala' | 'archivo'

/** Columna propia a la que se vuelca la respuesta. Sin `mapa`, va a `respuestas`. */
export type MapaCampo =
  | 'nombre' | 'cedula' | 'email' | 'telefono' | 'institucion' | 'carrera'
  | 'condicion' | 'ciudad' | 'modalidad' | 'certificado' | 'accesibilidad'
  | 'origen_difusion'

export interface Campo {
  id: string
  tipo: TipoCampo
  etiqueta: string
  ayuda?: string
  obligatorio?: boolean
  /** Se guarda cifrado en columna. Minimización; no implica dato sensible. */
  cifrado?: boolean
  /** Dato sensible del art. 3.° num. 7: exige consentimiento expreso separado. */
  sensible?: boolean
  opciones?: string[]
  mapa?: MapaCampo | ''
}

export interface Actividad {
  id: string
  titulo: string
  tipo: TipoActividad
  modalidad: Modalidad
  fecha_inicio: string
  fecha_fin: string
  dias: number
  cupo: number
  lugar: string | null
  descripcion: string | null
  estado: EstadoActividad
  horas_academicas: number
  portada: string | null
  portada_credito: string | null
  token_formulario: string
  token_asistencia: string
  docente_responsable: string | null
  campos: Campo[]
  instituciones_vinculadas: number
  carreras_involucradas: number
  periodo: string
  inscriptos: number
  estudiantes: number
  asistencias: number
  evaluaciones: number
  publicaciones: number
  alcance: number
  creado_en: string
}

export interface Inscripcion {
  id: string
  actividad_id: string
  nombre: string
  cedula_mascara: string | null
  email: string
  condicion: Condicion
  institucion: string | null
  carrera: string | null
  ciudad: string | null
  modalidad: string | null
  requiere_certificado: boolean
  estado: EstadoInscripcion
  origen_difusion: string | null
  consent_imagen: boolean
  consent_comunicaciones: boolean
  consent_sensible: boolean
  declaro_sensibles: boolean
  jornadas_asistidas: number
  consentido_en: string
  anonimizada_en: string | null
  creado_en: string
}

export interface Jornada {
  id: string
  actividad_id: string
  numero: number
  fecha: string
  codigo_sala: string
  presentes: number
}

export interface Consentimiento {
  id: string
  version: string
  aviso: { rotulo: string; texto: string }[]
  tratamiento: string
  sensibles: string
  imagen: string
  comunicaciones: string
}

export interface ActividadPublica {
  error?: string
  titulo: string
  tipo: TipoActividad
  descripcion: string | null
  modalidad: Modalidad
  fecha_inicio: string
  dias: number
  lugar: string | null
  portada: string | null
  portada_credito: string | null
  campos: Campo[]
  estado: EstadoActividad
  cupo: number
  lugares_libres: number
  consentimiento: Consentimiento
}

export interface Satisfaccion {
  respuestas: number
  contenido: number | null
  expositor: number | null
  organizacion: number | null
  recursos: number | null
  aplicabilidad: number | null
  promedio: number | null
  csat: number
  nps: number
  promotores: number
  pasivos: number
  detractores: number
}

export interface BloqueIndicador {
  n: string
  titulo: string
  items: { label: string; valor: number; unidad: string; origen: string }[]
}

export interface Indicadores {
  periodo: string
  calidad: { respuestas: number; csat: number; nps: number; promedio: number }
  bloques: BloqueIndicador[]
}

export interface RegistroAuditoria {
  id: number
  rol: Rol | null
  accion: string
  entidad: string | null
  motivo: string | null
  detalle: Record<string, unknown> | null
  ocurrio_en: string
  usuarios?: { nombre: string; email: string } | null
}
