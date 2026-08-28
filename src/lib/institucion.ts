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

/** Base de los enlaces que se reparten (formulario, asistencia y constancias).
 *  Incluye el subdirectorio del build: en GitHub Pages sobre un repositorio
 *  corriente el sitio cuelga de /fcjysunida/, no de la raíz. */
export const basePublica = () => {
  if (typeof window === 'undefined') return `https://${DOMINIO_PUBLICO}`
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return window.location.origin + base
}

/** Enlace pensado para compartir por WhatsApp, correo o redes.
 *
 *  GitHub Pages no conoce las rutas de la aplicación: ante /f/:token responde
 *  404.html con estado 404, y casi ningún rastreador arma vista previa sobre un
 *  404. La función `enlace` responde 200 con las etiquetas Open Graph de la
 *  actividad y redirige a quien hace clic. Es más largo, pero se ve.  */
export const enlaceCompartible = (tipo: 'f' | 'a', token: string) => {
  const api = import.meta.env.VITE_SUPABASE_URL
  if (!api) return `${basePublica()}/${tipo}/${token}`
  return `${api.replace(/\/$/, '')}/functions/v1/enlace/${tipo}/${token}`
}
