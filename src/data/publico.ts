// Superficie pública: el navegador anónimo solo llama a estas ocho funciones.
// No tiene acceso directo a ninguna tabla.
import { rpc } from '../lib/supabase'
import type { ActividadPublica, Consentimiento } from '../lib/tipos'

export const consentimientoVigente = () => rpc<Consentimiento>('consentimiento_vigente')

export const actividadPorToken = (token: string) =>
  rpc<ActividadPublica>('actividad_por_token', { p_token: token })

export interface Consentimientos {
  tratamiento: boolean
  sensible: boolean
  imagen: boolean
  comunicaciones: boolean
}

export const inscribir = (
  token: string,
  respuestas: Record<string, string>,
  consentimientos: Consentimientos,
) =>
  rpc<{ ok: boolean; error?: string; estado?: string; consentimiento_version?: string; consentido_en?: string }>(
    'inscribir',
    { p_token: token, p_respuestas: respuestas, p_consentimientos: consentimientos },
  )

export const asistenciaContexto = (token: string) =>
  rpc<{ error?: string; titulo: string; hay_jornada: boolean; jornada: number | null; fecha: string | null }>(
    'asistencia_contexto', { p_token: token },
  )

export const registrarAsistencia = (token: string, cedula: string, codigo: string) =>
  rpc<{ ok: boolean; error?: string; jornada?: number; ya_estaba?: boolean; mensaje?: string }>(
    'registrar_asistencia', { p_token: token, p_cedula: cedula, p_codigo: codigo },
  )

export const evaluacionPendiente = (token: string, cedula: string) =>
  rpc<{ pendiente: boolean; ultima_jornada: boolean }>(
    'evaluacion_pendiente', { p_token: token, p_cedula: cedula },
  )

export interface RespuestasEncuesta {
  contenido: number
  expositor: number
  organizacion: number
  recursos: number
  aplicabilidad: number
  global: number
  recomendacion: number
  comentario?: string
}

export const evaluarActividad = (token: string, cedula: string, r: RespuestasEncuesta) =>
  rpc<{ ok: boolean; error?: string; mensaje?: string }>(
    'evaluar_actividad', { p_token: token, p_cedula: cedula, p_respuestas: r },
  )

export const solicitarDerecho = (tipo: string, email: string, detalle: string) =>
  rpc<{ ok: boolean; error?: string; vence_en?: string }>(
    'solicitar_derecho', { p_tipo: tipo, p_email: email, p_detalle: detalle },
  )
