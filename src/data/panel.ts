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
export const periodos = () => rpc<{ periodo: string; actividades: number }[]>('periodos_disponibles')
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
