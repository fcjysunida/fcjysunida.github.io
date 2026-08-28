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
  condicion_declarada: Condicion | null
  condicion_origen: string | null
  matricula: string | null
  ciclo: string | null
  padron_periodo: string | null
  verificado_en_padron: boolean
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

// ── Padrón académico ─────────────────────────────────────────────────────────
export type CondicionAcademica = 'estudiante' | 'egresado'

export interface PeriodoAcademico {
  codigo: string
  anio: number
  semestre: number
  desde: string
  hasta: string
}

export interface ResumenPadron {
  periodo: string
  desde: string
  hasta: string
  estudiantes: number
  egresados: number
}

export interface FilaPadron {
  nombre: string
  cedula: string
  matricula?: string
  carrera?: string
  ciclo?: string
}

// ── Certificados ─────────────────────────────────────────────────────────────
export type RolCertificado =
  | 'participante' | 'disertante' | 'organizador' | 'tutor' | 'panelista' | 'moderador'

export interface PlantillaCertificado {
  id: string
  nombre: string
  rol: RolCertificado | null
  cuerpo_html: string
  fondo_url: string | null
  orientacion: 'horizontal' | 'vertical'
  vigente: boolean
}

export interface Certificado {
  id: string
  codigo: string
  nombre: string
  rol: RolCertificado
  horas: number
  jornadas: number
  emitido_en: string
  anulado_en: string | null
  email: string
}

export interface CertificadoPublico {
  error?: string
  codigo: string
  nombre: string
  evento: string
  fecha: string
  horas: number
  jornadas: number
  rol: RolCertificado
  emitido_en: string
  valido: boolean
  anulado_en: string | null
  modalidad: string
  lugar: string | null
  plantilla: {
    cuerpo_html: string
    fondo_url: string | null
    orientacion: 'horizontal' | 'vertical'
  } | null
}

// ── Proyectos de extensión ───────────────────────────────────────────────────
export type EstadoProyecto =
  | 'borrador' | 'presentado' | 'aprobado' | 'en_ejecucion' | 'finalizado' | 'rechazado'

export type ClasificacionProyecto =
  | 'cursos_extracurriculares' | 'prestaciones_servicio' | 'actos_culturales'
  | 'deportes' | 'publicaciones' | 'eventos_academicos'
  | 'experiencia_conocimiento' | 'otros'

export type TipoParticipante = 'docente' | 'funcionario' | 'externo' | 'estudiante'

export interface Resultado { resultado: string; indicadores: string; verificacion: string }
export interface ActividadPlan { actividad: string; inicio: string; fin: string; responsable: string }

export interface Propuesta {
  introduccion?: string
  justificacion?: string
  alcance?: {
    antecedentes?: string
    situacion_actual?: string
    situacion_deseada?: string
    poblacion_directa?: string
    poblacion_indirecta?: string
  }
  resultados?: Resultado[]
  objetivo_general?: string
  objetivos_especificos?: string[]
  metas?: string[]
  metodologia?: string
  actividades?: ActividadPlan[]
  presupuesto?: Record<string, Record<string, string>>
  creditos?: Record<string, Record<string, boolean>>
  anexos?: string[]
}

export interface Proyecto {
  id: string
  nombre: string
  clasificacion: ClasificacionProyecto
  clasificacion_otros: string | null
  estado: EstadoProyecto
  periodo_academico: string | null
  facultad: string
  carreras: string | null
  curso: string | null
  localizacion: string | null
  otras_organizaciones: string | null
  lider: string | null
  tutor: string | null
  entregable: string | null
  proyectos_relacionados: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  anio: number | null
  categoria_memoria: string | null
  fuente: string | null
  horas_reloj: number
  horas_extension: number
  beneficiarios_directos: number
  beneficiarios_indirectos: number
  actividad_id: string | null
  propuesta: Propuesta
  docente_responsable: string | null
  creado_en: string
}

export interface ProyectoResumen {
  id: string
  nombre: string
  clasificacion: ClasificacionProyecto
  estado: EstadoProyecto
  periodo_academico: string | null
  carreras: string | null
  lider: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  /** Año de la actividad. Se usa cuando solo se documentó el año. */
  anio: number | null
  categoria_memoria: string | null
  fuente: string | null
  horas_reloj: number
  horas_extension: number
  beneficiarios_directos: number
  beneficiarios_indirectos: number
  actividad_id: string | null
  estudiantes: number
  docentes: number
  informes: number
  ultimo_informe: string | null
}

export interface ParticipanteProyecto {
  id: string
  proyecto_id: string
  tipo: TipoParticipante
  nombre: string
  cedula_mascara: string | null
  matricula: string | null
  carrera: string | null
  ciclo: string | null
  catedra: string | null
  organizacion: string | null
  orden: number
  /** Condición verificada contra el padrón del período del proyecto. */
  condicion: Condicion | null
  condicion_origen: string | null
  periodo_verificado: string | null
  asistio: boolean
  jornadas: number
  fuente: string
}

export interface InformeProyecto {
  id: string
  proyecto_id: string
  elaborado_por: string
  aprobado_por: string | null
  fecha_informe: string
  lugar_ejecucion: string | null
  beneficiarios: string | null
  resumen: string | null
  metodologia: string | null
  conclusiones: string | null
  informe: {
    analisis?: { fila: string; planteado: string; alcanzado: string }[]
    plan?: { actividad: string; responsables: string; cronograma: string }[]
    metas?: { meta: string; indicadores: string; recursos: string }[]
    rendicion?: Record<string, Record<string, string>>
    anexos?: string[]
  }
  estado: EstadoProyecto
  creado_en: string
}

export interface EscalaExtension {
  clasificacion: ClasificacionProyecto
  etiqueta: string
  ejemplos: string
  regla: string
  max_total: number | null
  max_actividad: number | null
  factor_hora: number | null
}

// ── Correo ───────────────────────────────────────────────────────────────────
export interface EstadoCorreo {
  pendientes: number
  enviados_24h: number
  enviados_30d: number
  fallidos: number
  proximo: string | null
}
