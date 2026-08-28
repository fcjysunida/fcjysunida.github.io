// Acceso del panel. Lecturas por vistas con security_invoker (respetan RLS) y
// escrituras por funciones que validan el rol y dejan traza en auditoría.
import { supabase, rpc } from '../lib/supabase'
import type {
  Actividad, Inscripcion, Jornada, Indicadores, Satisfaccion,
  RegistroAuditoria, Campo, TipoActividad, Modalidad, EstadoInscripcion,
} from '../lib/tipos'

export async function listarActividades(): Promise<Actividad[]> {
  const { data, error } = await supabase
    .from('actividades_resumen').select('*').order('fecha_inicio', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Actividad[]
}

export async function listarInscripciones(actividadId: string): Promise<Inscripcion[]> {
  const { data, error } = await supabase
    .from('inscripciones_panel').select('*')
    .eq('actividad_id', actividadId).order('nombre')
  if (error) throw new Error(error.message)
  return (data ?? []) as Inscripcion[]
}

export async function listarJornadas(actividadId: string): Promise<Jornada[]> {
  const { data, error } = await supabase
    .from('jornadas_panel').select('*').eq('actividad_id', actividadId).order('numero')
  if (error) throw new Error(error.message)
  return (data ?? []) as Jornada[]
}

export async function editarInscripcion(
  id: string, cambios: { nombre?: string; email?: string; estado?: EstadoInscripcion },
): Promise<void> {
  const { error } = await supabase.from('inscripciones').update(cambios).eq('id', id)
  if (error) throw new Error(error.message)
  await rpc('auditar', {
    p_accion: 'edicion_inscripcion', p_entidad: 'inscripciones', p_entidad_id: id,
    p_motivo: null, p_detalle: cambios,
  })
}

export interface BorradorActividad {
  titulo: string
  tipo: TipoActividad
  modalidad: Modalidad
  inicio: string
  dias: number
  cupo: number
  lugar: string
  descripcion: string
  portada: string
  portadaCredito: string
  campos: Campo[]
  horas: number
}

export const crearActividad = (b: BorradorActividad) =>
  rpc<Enlaces>('crear_actividad', {
    p_titulo: b.titulo, p_tipo: b.tipo, p_modalidad: b.modalidad, p_inicio: b.inicio,
    p_dias: b.dias, p_cupo: b.cupo, p_lugar: b.lugar || null,
    p_descripcion: b.descripcion || null, p_portada: b.portada,
    p_portada_credito: b.portadaCredito, p_campos: b.campos, p_horas: b.horas,
  })

export interface Enlaces {
  id: string
  titulo: string
  token_formulario: string
  token_asistencia: string
  jornadas: { numero: number; fecha: string; codigo: string; presentes: number }[]
}

export const enlacesDe = (id: string) => rpc<Enlaces>('enlaces_de', { p_actividad: id })
export const regenerarEnlace = (id: string) => rpc<Enlaces>('regenerar_enlace', { p_actividad: id })
export const regenerarCodigo = (id: string, jornada: number) =>
  rpc<Enlaces>('regenerar_codigo', { p_actividad: id, p_jornada: jornada })
export const cerrarActividad = (id: string, finalizada: boolean) =>
  rpc<{ ok: boolean }>('cerrar_actividad', { p_actividad: id, p_finalizada: finalizada })

export async function exportarInscripciones(
  actividadId: string, motivo: string, incluirCedula: boolean,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase.rpc('exportar_inscripciones', {
    p_actividad: actividadId, p_motivo: motivo, p_incluir_cedula: incluirCedula,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as Record<string, unknown>[]
}

export const cedulaDe = (inscripcion: string, motivo: string) =>
  rpc<string | null>('cedula_de', { p_inscripcion: inscripcion, p_motivo: motivo })

export const sensiblesDe = (inscripcion: string, motivo: string) =>
  rpc<{ accesibilidad: string | null; telefono: string | null; respuestas: Record<string, string> }>(
    'sensibles_de', { p_inscripcion: inscripcion, p_motivo: motivo },
  )

export const indicadores = (periodo: string) => rpc<Indicadores>('indicadores', { p_periodo: periodo })
export const periodos = () =>
  rpc<{ periodo: string; actividades: number; proyectos: number }[]>('periodos_disponibles')
export const satisfaccionDe = (id: string) => rpc<Satisfaccion>('satisfaccion_de', { p_actividad: id })
export const comentariosDe = (id: string) =>
  rpc<{ comentario: string }[]>('comentarios_de', { p_actividad: id })
export const aplicarRetencion = (meses: number, simulacion: boolean) =>
  rpc<{ simulacion: boolean; alcanzadas?: number; anonimizadas?: number; meses: number }>(
    'aplicar_retencion', { p_meses: meses, p_simulacion: simulacion },
  )

export async function listarAuditoria(limite = 60): Promise<RegistroAuditoria[]> {
  const { data, error } = await supabase
    .from('auditoria')
    .select('id, rol, accion, entidad, motivo, detalle, ocurrio_en, usuarios(nombre, email)')
    .order('ocurrio_en', { ascending: false }).limit(limite)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as RegistroAuditoria[]
}

export async function listarSolicitudes() {
  const { data, error } = await supabase
    .from('solicitudes_derechos').select('*').order('recibida_en', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

// ── Padrón académico ─────────────────────────────────────────────────────────
import type {
  PeriodoAcademico, ResumenPadron, FilaPadron, CondicionAcademica,
  Certificado, PlantillaCertificado, RolCertificado,
  Proyecto, ProyectoResumen, ParticipanteProyecto, InformeProyecto,
  EscalaExtension, EstadoCorreo,
} from '../lib/tipos'

export async function listarPeriodos(): Promise<PeriodoAcademico[]> {
  const { data, error } = await supabase
    .from('periodos_academicos').select('*').order('codigo', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PeriodoAcademico[]
}

export const guardarPeriodo = (codigo: string, desde: string, hasta: string) =>
  rpc<{ ok: boolean }>('periodo_academico_guardar',
    { p_codigo: codigo, p_desde: desde, p_hasta: hasta })

export const resumenPadron = () => rpc<ResumenPadron[]>('padron_resumen')

export const importarPadron = (
  periodo: string, condicion: CondicionAcademica, filas: FilaPadron[],
) =>
  rpc<{ ok: boolean; procesadas: number; omitidas: number; total_periodo: number }>(
    'padron_importar', { p_periodo: periodo, p_condicion: condicion, p_filas: filas })

export const recruzarPadron = (actividadId?: string) =>
  rpc<{ ok: boolean; revisadas: number; reclasificadas: number }>(
    'recruzar_padron', { p_actividad: actividadId ?? null })

// ── Certificados ─────────────────────────────────────────────────────────────
export const emitirCertificados = (
  actividadId: string, rol: RolCertificado, minimoJornadas: number,
  plantillaId: string | null, simulacion: boolean,
) =>
  rpc<{ ok: boolean; simulacion: boolean; a_emitir: number; ya_tenian: number; sin_plantilla: boolean }>(
    'emitir_certificados', {
      p_actividad: actividadId, p_rol: rol, p_minimo_jornadas: minimoJornadas,
      p_plantilla: plantillaId, p_solo_simulacion: simulacion,
    })

export const certificadosDe = (actividadId: string) =>
  rpc<Certificado[]>('certificados_de', { p_actividad: actividadId })

export const anularCertificado = (id: string, motivo: string) =>
  rpc<{ ok: boolean }>('anular_certificado', { p_id: id, p_motivo: motivo })

export async function listarPlantillas(): Promise<PlantillaCertificado[]> {
  const { data, error } = await supabase
    .from('certificado_plantillas').select('*').order('creado_en', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PlantillaCertificado[]
}

export async function guardarPlantilla(p: Partial<PlantillaCertificado>): Promise<void> {
  const { error } = p.id
    ? await supabase.from('certificado_plantillas').update(p).eq('id', p.id)
    : await supabase.from('certificado_plantillas').insert(p)
  if (error) throw new Error(error.message)
}

// ── Proyectos de extensión ───────────────────────────────────────────────────
export async function listarProyectos(): Promise<ProyectoResumen[]> {
  const { data, error } = await supabase
    .from('proyectos_resumen').select('*').order('fecha_inicio', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProyectoResumen[]
}

export async function traerProyecto(id: string): Promise<Proyecto> {
  const { data, error } = await supabase.from('proyectos').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data as Proyecto
}

export async function guardarProyecto(p: Partial<Proyecto>): Promise<string> {
  if (p.id) {
    const { error } = await supabase.from('proyectos')
      .update({ ...p, actualizado_en: new Date().toISOString() }).eq('id', p.id)
    if (error) throw new Error(error.message)
    await rpc('auditar', {
      p_accion: 'edicion_proyecto', p_entidad: 'proyectos', p_entidad_id: p.id,
      p_motivo: null, p_detalle: { nombre: p.nombre },
    })
    return p.id
  }
  const { data, error } = await supabase.from('proyectos').insert(p).select('id').single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await rpc('auditar', {
    p_accion: 'alta_proyecto', p_entidad: 'proyectos', p_entidad_id: id,
    p_motivo: null, p_detalle: { nombre: p.nombre },
  })
  return id
}

export async function participantesDe(proyectoId: string): Promise<ParticipanteProyecto[]> {
  const { data, error } = await supabase
    .from('proyecto_participantes')
    .select('id, proyecto_id, tipo, nombre, cedula_mascara, matricula, carrera, ciclo, catedra, organizacion, orden')
    .eq('proyecto_id', proyectoId).order('tipo').order('orden')
  if (error) throw new Error(error.message)
  return (data ?? []) as ParticipanteProyecto[]
}

export async function guardarParticipantes(
  proyectoId: string, filas: Omit<ParticipanteProyecto, 'id' | 'cedula_mascara'>[],
): Promise<void> {
  const { error: e1 } = await supabase
    .from('proyecto_participantes').delete().eq('proyecto_id', proyectoId)
  if (e1) throw new Error(e1.message)
  if (filas.length === 0) return
  const { error } = await supabase.from('proyecto_participantes').insert(filas)
  if (error) throw new Error(error.message)
}

export async function informesDe(proyectoId: string): Promise<InformeProyecto[]> {
  const { data, error } = await supabase
    .from('proyecto_informes').select('*')
    .eq('proyecto_id', proyectoId).order('fecha_informe', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as InformeProyecto[]
}

export async function guardarInforme(i: Partial<InformeProyecto>): Promise<string> {
  if (i.id) {
    const { error } = await supabase.from('proyecto_informes')
      .update({ ...i, actualizado_en: new Date().toISOString() }).eq('id', i.id)
    if (error) throw new Error(error.message)
    return i.id
  }
  const { data, error } = await supabase
    .from('proyecto_informes').insert(i).select('id').single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export async function escalaExtension(): Promise<EscalaExtension[]> {
  const { data, error } = await supabase.from('escala_extension').select('*')
  if (error) throw new Error(error.message)
  return (data ?? []) as EscalaExtension[]
}

export const horasSugeridas = (clasificacion: string, horasReloj: number, dias: number) =>
  rpc<{ horas: number; regla: string; etiqueta: string; max_total: number | null; nota: string }>(
    'horas_extension_sugeridas',
    { p_clasificacion: clasificacion, p_horas_reloj: horasReloj, p_dias: dias })

// ── Correo y configuración ───────────────────────────────────────────────────
export const estadoCorreo = () => rpc<EstadoCorreo>('correos_estado')

export async function leerConfiguracion(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('configuracion').select('clave, valor')
  if (error) throw new Error(error.message)
  return Object.fromEntries((data ?? []).map((c) => [c.clave as string, (c.valor ?? '') as string]))
}

export const guardarConfiguracion = (clave: string, valor: string) =>
  rpc<{ ok: boolean }>('configuracion_guardar', { p_clave: clave, p_valor: valor })

// ── Usuarios y roles ─────────────────────────────────────────────────────────
export interface UsuarioPendiente {
  id: string
  email: string
  nombre: string
  registrado_en: string
  correo_confirmado: boolean
}

export interface UsuarioPanel {
  id: string
  email: string
  nombre: string
  rol: import('../lib/tipos').Rol
  activo: boolean
  creado_en: string
  correo_confirmado: boolean
  es_uno_mismo: boolean
}

export const usuariosPendientes = () => rpc<UsuarioPendiente[]>('usuarios_pendientes')
export const usuariosListar = () => rpc<UsuarioPanel[]>('usuarios_listar')

export const asignarRol = (id: string, rol: string, nombre?: string) =>
  rpc<{ ok: boolean }>('usuario_asignar_rol',
    { p_id: id, p_rol: rol, p_nombre: nombre ?? null })

export const activarUsuario = (id: string, activo: boolean) =>
  rpc<{ ok: boolean }>('usuario_activar', { p_id: id, p_activo: activo })

export const confirmarCorreo = (id: string) =>
  rpc<{ ok: boolean }>('usuario_confirmar_correo', { p_id: id })

// ── Redacción asistida del informe ───────────────────────────────────────────
export interface BorradorInforme {
  resumen: string
  metodologia: string
  conclusiones: string
  analisis: { fila: string; planteado: string; alcanzado: string }[]
  plan: { actividad: string; responsables: string; cronograma: string }[]
  metas: { meta: string; indicadores: string; recursos: string }[]
  faltantes: string[]
}

/** Pide un borrador del informe. Devuelve texto para revisar, no para publicar. */
export async function redactarInforme(proyectoId: string): Promise<BorradorInforme> {
  const { data: sesion } = await supabase.auth.getSession()
  const token = sesion.session?.access_token
  if (!token) throw new Error('La sesión expiró. Vuelva a entrar.')

  const r = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redactar-informe`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ proyecto_id: proyectoId }),
    },
  )
  const cuerpo = await r.json().catch(() => ({}))
  if (!r.ok || !cuerpo?.ok) {
    throw new Error(cuerpo?.error ?? 'No pudimos redactar el borrador.')
  }
  return cuerpo.borrador as BorradorInforme
}

// ── Participantes de proyecto ────────────────────────────────────────────────
export interface ResultadoPadron {
  nombre: string
  matricula: string | null
  carrera: string | null
  ciclo: string | null
  periodo: string
  condicion: 'estudiante' | 'egresado'
  cedula_mascara: string | null
  cedula_hash: string
}

export interface Desglose {
  total: number
  asistieron: number
  estudiantes: number
  egresados: number
  docentes: number
  externos: number
  verificados: number
  sin_verificar: number
  por_carrera: Record<string, number>
  por_fuente: Record<string, number>
}

export interface FilaParticipante {
  nombre: string
  cedula?: string
  cedula_hash?: string
  matricula?: string
  organizacion?: string
  tipo?: string
  asistio?: boolean
}

export const buscarPadron = (texto: string) =>
  rpc<ResultadoPadron[]>('padron_buscar', { p_texto: texto, p_limite: 25 })

export const participantesDesdeActividad = (proyectoId: string, soloAsistentes: boolean) =>
  rpc<{ ok: boolean; agregados: number; ya_estaban: number }>(
    'proyecto_participantes_desde_actividad',
    { p_proyecto: proyectoId, p_solo_asistentes: soloAsistentes })

export const agregarParticipantes = (
  proyectoId: string, filas: FilaParticipante[], fuente: string,
) =>
  rpc<{ ok: boolean; agregados: number; ya_estaban: number; omitidos: number }>(
    'proyecto_participantes_agregar',
    { p_proyecto: proyectoId, p_filas: filas, p_fuente: fuente })

export const verificarParticipantes = (proyectoId?: string) =>
  rpc<{ ok: boolean; revisados: number; reclasificados: number }>(
    'proyecto_participantes_verificar', { p_proyecto: proyectoId ?? null })

export const desgloseDe = (proyectoId: string) =>
  rpc<Desglose>('proyecto_desglose', { p_proyecto: proyectoId })

export async function quitarParticipante(id: string): Promise<void> {
  const { error } = await supabase.from('proyecto_participantes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Constancias con todo lo necesario para imprimirlas sin volver a consultar. */
export interface CertificadoImprimible {
  codigo: string
  nombre: string
  evento: string
  fecha_texto: string
  horas: number
  jornadas: number
  rol: string
  modalidad: string
  lugar: string | null
  emitido_en: string
  cuerpo_html: string
  fondo_url: string | null
  orientacion: 'horizontal' | 'vertical'
}

export const certificadosImprimibles = (actividadId: string, soloPendientes = false) =>
  rpc<CertificadoImprimible[]>('certificados_imprimibles',
    { p_actividad: actividadId, p_solo_sin_aviso: soloPendientes })

export const avisarCertificados = (actividadId: string, simulacion: boolean) =>
  rpc<{ ok: boolean; simulacion: boolean; a_enviar: number; ya_avisados: number;
        sin_correo_valido: number }>(
    'avisar_certificados', { p_actividad: actividadId, p_solo_simulacion: simulacion })

// ── Horas de Extensión Universitaria ─────────────────────────────────────────
// Las horas respaldadas salen de la asistencia y de las nóminas de proyecto; las
// históricas se acreditan a mano y no tienen respaldo en la plataforma.

export type ResumenExtension = {
  periodo: string
  condicion: CondicionAcademica
  personas: number
  cumplen: number
  sin_horas: number
  horas_promedio: number
  horas_respaldadas: number
  horas_historicas: number
  horas_total: number
}

export type FilaExtension = {
  padron_id: string
  nombre: string
  cedula_mascara: string | null
  matricula: string | null
  cohorte: string | null
  carrera: string | null
  condicion: CondicionAcademica
  periodo: string
  horas_asistencia: number
  horas_proyectos: number
  horas_historicas: number
  horas_ajustes: number
  horas_total: number
  horas_faltantes: number
  cumple: boolean
}

export const extensionResumen = () => rpc<ResumenExtension[]>('extension_resumen')

export const extensionNomina = (f: {
  periodo?: string | null; condicion?: string | null
  texto?: string | null; soloDeuda?: boolean; limite?: number
}) => rpc<FilaExtension[]>('extension_nomina', {
  p_periodo: f.periodo || null, p_condicion: f.condicion || null,
  p_texto: f.texto || null, p_solo_deuda: f.soloDeuda ?? false,
  p_limite: f.limite ?? 300,
})

export const acreditarHoras = (a: {
  padronId: string; horas: number; periodo?: string | null
  motivo: string; detalle?: string | null; origen?: 'historica' | 'ajuste'
}) => rpc<{ ok: boolean; id: string }>('horas_extension_agregar', {
  p_padron_id: a.padronId, p_horas: a.horas, p_periodo: a.periodo || null,
  p_motivo: a.motivo, p_detalle: a.detalle || null, p_origen: a.origen ?? 'historica',
})

export const acreditarEgresados = (cohortes: string[], motivo: string, simulacion: boolean) =>
  rpc<{
    simulacion: boolean; meta: number; personas: number; horas: number
    detalle: { nombre: string; matricula: string; cohorte: string
               periodo_egreso: string; tenia: number; se_acreditan: number }[]
  }>('horas_extension_acreditar_egresados',
     { p_cohortes: cohortes, p_motivo: motivo, p_dry_run: simulacion })
