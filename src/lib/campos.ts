import type { Campo, TipoCampo, TipoActividad, Modalidad, Rol } from './tipos'

export const TIPOS_CAMPO: { id: TipoCampo; label: string }[] = [
  { id: 'texto',    label: 'Texto breve' },
  { id: 'parrafo',  label: 'Párrafo' },
  { id: 'email',    label: 'Correo electrónico' },
  { id: 'tel',      label: 'Teléfono' },
  { id: 'cedula',   label: 'Cédula de identidad' },
  { id: 'numero',   label: 'Número' },
  { id: 'fecha',    label: 'Fecha' },
  { id: 'unica',    label: 'Opción única' },
  { id: 'casillas', label: 'Casillas de verificación' },
  { id: 'lista',    label: 'Lista desplegable' },
  { id: 'escala',   label: 'Escala de uno a cinco' },
  { id: 'archivo',  label: 'Archivo adjunto' },
]

export const TIPOS_ACTIVIDAD: { id: TipoActividad; label: string }[] = [
  { id: 'extension',              label: 'Extensión universitaria' },
  { id: 'publica',                label: 'Actividad pública' },
  { id: 'vinculacion',            label: 'Vinculación institucional' },
  { id: 'proyecto_extension',     label: 'Proyecto de extensión' },
  { id: 'capacitacion_docente',   label: 'Capacitación docente' },
  { id: 'actividad_estudiantil',  label: 'Actividad estudiantil' },
  { id: 'investigacion',          label: 'Investigación académica' },
]

export const MODALIDADES: { id: Modalidad; label: string }[] = [
  { id: 'presencial', label: 'Presencial' },
  { id: 'virtual',    label: 'Virtual' },
  { id: 'hibrida',    label: 'Híbrida' },
]

export const ROLES: { id: Rol; label: string }[] = [
  { id: 'admin',        label: 'Dirección' },
  { id: 'coordinacion', label: 'Coordinación de Extensión' },
  { id: 'docente',      label: 'Docente responsable de actividad' },
  { id: 'secretaria',   label: 'Secretaría' },
  { id: 'auditor',      label: 'Auditoría con acceso de lectura' },
]

export const etiquetaTipo = (t: TipoActividad) =>
  TIPOS_ACTIVIDAD.find((x) => x.id === t)?.label ?? t
export const etiquetaModalidad = (m: Modalidad) =>
  MODALIDADES.find((x) => x.id === m)?.label ?? m
export const etiquetaRol = (r: Rol) => ROLES.find((x) => x.id === r)?.label ?? r
export const etiquetaCampo = (t: TipoCampo) =>
  TIPOS_CAMPO.find((x) => x.id === t)?.label ?? t

export const conOpciones = (t: TipoCampo) => t === 'unica' || t === 'casillas' || t === 'lista'

export const tipoHtml = (t: TipoCampo): string =>
  t === 'email' ? 'email' : t === 'tel' ? 'tel'
  : t === 'numero' ? 'number' : t === 'fecha' ? 'date' : 'text'

export const nuevoId = () => 'c' + Math.random().toString(36).slice(2, 8)

/** Conjunto habitual de campos. `mapa` decide qué columna alimenta cada uno. */
export function camposHabituales(): Campo[] {
  return [
    { id: nuevoId(), tipo: 'texto', etiqueta: 'Nombre y apellido', obligatorio: true,
      ayuda: 'Tal como debe figurar en el certificado', mapa: 'nombre' },
    { id: nuevoId(), tipo: 'cedula', etiqueta: 'Cédula de identidad', obligatorio: true,
      cifrado: true, mapa: 'cedula',
      ayuda: 'Se utiliza para validar su asistencia. Se almacena cifrada.' },
    { id: nuevoId(), tipo: 'email', etiqueta: 'Correo electrónico', obligatorio: true,
      ayuda: 'Allí se envían la confirmación y el certificado', mapa: 'email' },
    { id: nuevoId(), tipo: 'tel', etiqueta: 'Teléfono o WhatsApp', cifrado: true, mapa: 'telefono' },
    { id: nuevoId(), tipo: 'unica', etiqueta: 'Condición', obligatorio: true, mapa: 'condicion',
      opciones: ['Estudiante', 'Docente', 'Egresado', 'Externo'] },
    { id: nuevoId(), tipo: 'texto', etiqueta: 'Institución u organización', mapa: 'institucion',
      ayuda: 'Alimenta el indicador de vinculación institucional' },
    { id: nuevoId(), tipo: 'texto', etiqueta: 'Carrera y semestre', mapa: 'carrera',
      ayuda: 'Solo si es estudiante' },
    { id: nuevoId(), tipo: 'texto', etiqueta: 'Ciudad o departamento', mapa: 'ciudad',
      ayuda: 'Alimenta el indicador de cobertura territorial' },
    { id: nuevoId(), tipo: 'unica', etiqueta: 'Modalidad de participación', obligatorio: true,
      mapa: 'modalidad', opciones: ['Presencial', 'Virtual'] },
    { id: nuevoId(), tipo: 'unica', etiqueta: '¿Necesita certificado?', mapa: 'certificado',
      opciones: ['Sí', 'No'] },
    { id: nuevoId(), tipo: 'parrafo', etiqueta: 'Requerimientos de accesibilidad',
      sensible: true, mapa: 'accesibilidad',
      ayuda: 'Dato sensible. Es voluntario. Solo lo consulta la organización de la actividad y se elimina antes que el resto.' },
    { id: nuevoId(), tipo: 'lista', etiqueta: '¿Cómo se enteró de la actividad?',
      mapa: 'origen_difusion',
      opciones: ['Instagram', 'Correo institucional', 'WhatsApp', 'Recomendación', 'Otro medio'] },
  ]
}

/** Galería institucional. Fotografías de repositorios libres, en blanco y negro. */
const commons = (n: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${n}?width=1200`

export const PORTADAS = [
  { id: 'juridico', label: 'Judicial',
    url: commons('Palacio%20de%20Justicia%20Paraguay%20by%20Felipe%20M%C3%A9ndez.jpg'),
    credito: 'Portada: Palacio de Justicia, Asunción — FF MM, CC BY-SA 3.0, Wikimedia Commons.' },
  { id: 'institucional', label: 'Institucional',
    url: commons('Palacio%20legislativo%20en%20Asunci%C3%B3n.jpg'),
    credito: 'Portada: Palacio Legislativo, Asunción — Didym, CC0, Wikimedia Commons.' },
  { id: 'ambiental', label: 'Ambiental',
    url: commons('Chaco%20Boreal%20Paraguay.jpg'),
    credito: 'Portada: Chaco Boreal, Paraguay — Ilosuna, CC BY 1.0, Wikimedia Commons.' },
  { id: 'tecnologico', label: 'Tecnológico',
    url: commons('Cern%20datacenter.jpg'),
    credito: 'Portada: centro de datos del CERN — CC BY-SA 3.0, Wikimedia Commons.' },
  { id: 'cientifico', label: 'Científico',
    url: commons('Scientist%20looking%20thorugh%20microscope.jpg'),
    credito: 'Portada: laboratorio — dominio público, Wikimedia Commons.' },
]

export const portadaDe = (id: string | null) =>
  PORTADAS.find((p) => p.id === id) ?? PORTADAS[0]!
