/** Datos institucionales de cara al público. Un solo lugar para cambiarlos. */
export const FACULTAD =
  'Facultad de Ciencias Jurídicas y Sociales — Universidad de la Integración de las Américas'
export const FACULTAD_CORTA = 'Facultad de Ciencias Jurídicas y Sociales — UNIDA'
export const RESPONSABLE = 'Abg. Patricia Sequeira'
export const CORREO = 'extensionderecho@unida.edu.py'
export const DOMINIO_PUBLICO = 'fcjysunida.github.io'
export const RETENCION_MESES = 24
export const AUTORIDAD = 'Agencia Nacional de Protección de Datos Personales'
export const LEY = 'Ley N° 7593/2025'

/** Base de los enlaces que se reparten (formulario y asistencia). */
export const basePublica = () =>
  typeof window === 'undefined' ? `https://${DOMINIO_PUBLICO}` : window.location.origin
