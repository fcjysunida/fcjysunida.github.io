import { writeFileSync } from 'node:fs'
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle,
} from 'docx'

const BORDE = {
  top:    { style: BorderStyle.SINGLE, size: 2, color: 'AAAAAA' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: 'AAAAAA' },
  left:   { style: BorderStyle.SINGLE, size: 2, color: 'AAAAAA' },
  right:  { style: BorderStyle.SINGLE, size: 2, color: 'AAAAAA' },
}

function celda(texto: string, negrita = false, ancho?: number): TableCell {
  return new TableCell({
    borders: BORDE,
    width: ancho ? { size: ancho, type: WidthType.PERCENTAGE } : undefined,
    children: String(texto ?? '').split('\n').map((l) =>
      new Paragraph({ children: [new TextRun({ text: l, bold: negrita, size: 20 })] })),
  })
}

const tabla = (filas: TableRow[]) =>
  new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas })

const par = (t = '') => new Paragraph({ text: t })
const h2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, text: t })
const h3 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_3, text: t })

/** Cuadro rubro × fuente, tal como está en los formatos oficiales. */
function matriz(
  titulo: string,
  rubros: readonly (readonly [string, string])[],
  fuentes: readonly (readonly [string, string])[],
  valores: Record<string, Record<string, string>>,
): (Paragraph | Table)[] {
  return [
    h3(titulo),
    tabla([
      new TableRow({ children: [celda('Rubro', true, 28),
        ...fuentes.map(([, r]) => celda(r, true))] }),
      ...rubros.map(([k, r]) => new TableRow({
        children: [celda(r, false, 28), ...fuentes.map(([f]) => celda(valores?.[k]?.[f] ?? ''))],
      })),
    ]),
    par(),
  ]
}

export const RUBROS = [
  ['movilidad', 'Movilidad'], ['omnibus', 'Ómnibus u otros medios'], ['pasajes', 'Pasajes'],
  ['combustible', 'Combustible'], ['estadia', 'Estadía'],
  ['materiales_fungibles', 'Materiales fungibles a ser utilizados'],
  ['materiales_distribuir', 'Materiales a ser distribuidos'],
  ['equipos', 'Equipos o instrumentos a ser utilizados'], ['honorarios', 'Honorarios'],
  ['peliculas', 'Películas, cintas, revelados, impresiones'],
  ['edicion', 'Edición de informaciones'],
] as const

export const FUENTES = [
  ['estado', 'Recursos del Estado'], ['unida', 'Recursos institucionales — UNIDA'],
  ['prestamos', 'Préstamos'], ['donaciones', 'Donaciones'], ['otros', 'Otros (autogestión)'],
] as const

const CREDITOS = [
  ['certificados', 'Certificados'], ['reconocimientos', 'Reconocimientos'],
  ['premios', 'Premios'], ['otros', 'Otros estímulos'],
] as const
const DESTINATARIOS = [
  ['docentes', 'Docentes'], ['estudiantes', 'Estudiantes'], ['otros', 'Otros participantes'],
] as const

interface Participante {
  tipo: string; nombre: string; matricula?: string | null
  carrera?: string | null; ciclo?: string | null
  catedra?: string | null; organizacion?: string | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Cualquiera = Record<string, any>

function firmas(): Table {
  return tabla([
    new TableRow({ children: [
      celda('\n\n_____________________________\nTutor/a (docente de la cátedra o coordinador)'),
      celda('\n\n_____________________________\nResponsable estudiantil'),
    ] }),
    new TableRow({ children: [
      celda('\n\n_____________________________\nCoordinador/a de carrera'),
      celda('\n\n_____________________________\nDecano de la Facultad'),
    ] }),
  ])
}

/** Formato 9 — Propuesta de Proyecto de Extensión Universitaria. */
export async function propuestaDocx(
  p: Cualquiera, participantes: Participante[], ruta: string,
): Promise<void> {
  const pr = p.propuesta ?? {}
  const al = pr.alcance ?? {}
  const estudiantes = participantes.filter((x) => x.tipo === 'estudiante')
  const otros = participantes.filter((x) => x.tipo !== 'estudiante')

  const hijos: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Proyecto de Extensión' }),
    new Paragraph({ children: [new TextRun({ text: p.nombre, bold: true, size: 26 })] }),
    par(`Carrera(s): ${p.carreras ?? ''}`),
    par(`Curso: ${p.curso ?? ''}`),
    par('Facultad: Facultad de Ciencias Jurídicas y Sociales'),
    par(`Docente(s): ${p.lider ?? ''}`),
    par(`Período académico: ${p.periodo_academico ?? ''}`),
    par(),

    h2('Identificación'),
    tabla([
      ['Nombre del proyecto', p.nombre],
      ['Localización del proyecto', p.localizacion ?? ''],
      ['Otras organizaciones involucradas', p.otras_organizaciones ?? 'N/A'],
      ['Líder del proyecto', p.lider ?? ''],
      ['Entregable final del proyecto', p.entregable ?? ''],
      ['Proyectos relacionados', p.proyectos_relacionados ?? 'N/A'],
      ['Fecha estimada de inicio', p.fecha_inicio ?? ''],
      ['Fecha estimada de finalización', p.fecha_fin ?? ''],
      ['Tiempo total a ser utilizado',
       `${p.horas_reloj} horas reloj / ${p.horas_extension} horas de extensión universitaria`],
    ].map(([a, b]) => new TableRow({ children: [celda(a, true, 34), celda(String(b ?? ''))] }))),
    par(),

    h2('Participantes del proyecto'),
    h3('Docentes, funcionarios y otras instituciones'),
    tabla([
      new TableRow({ children: [celda('Tipo', true, 26), celda('Nombre y apellido', true),
                                celda('Cátedra u organización', true)] }),
      ...(otros.length > 0 ? otros : [{ tipo: '', nombre: '', catedra: '' } as Participante])
        .map((x) => new TableRow({ children: [
          celda(x.tipo, false, 26), celda(x.nombre),
          celda(x.organizacion ?? x.catedra ?? ''),
        ] })),
    ]),
    par(),
    h3('Estudiantes'),
    tabla([
      new TableRow({ children: [celda('Nombre y apellido', true), celda('C.I. N.º', true),
                                celda('Carrera', true), celda('Ciclo', true),
                                celda('Matrícula N.º', true)] }),
      ...(estudiantes.length > 0
        ? estudiantes
        : Array.from({ length: 5 }, () => ({ nombre: '' } as Participante)))
        .map((x) => new TableRow({ children: [
          celda(x.nombre), celda(''), celda(x.carrera ?? ''),
          celda(x.ciclo ?? ''), celda(x.matricula ?? ''),
        ] })),
    ]),
    par('Observación: se puede agregar las filas según necesidad.'),
    par(`Tutor/a: ${p.tutor ?? ''}`),
    par(),

    h2('Clasificación del proyecto'),
    tabla(([
      ['cursos_extracurriculares', 'Cursos extracurriculares'],
      ['prestaciones_servicio', 'Prestaciones de servicio'],
      ['actos_culturales', 'Actos vinculados con el arte y la cultura'],
      ['deportes', 'Deportes'], ['publicaciones', 'Publicaciones'],
      ['eventos_academicos', 'Eventos académicos'],
      ['experiencia_conocimiento', 'Adquisición de experiencia y conocimiento'],
      ['otros', `Otros${p.clasificacion_otros ? ` (${p.clasificacion_otros})` : ' (especificar)'}`],
    ] as const).map(([k, r]) => new TableRow({
      children: [celda(r, false, 70), celda(p.clasificacion === k ? '( X )' : '(     )')],
    }))),
    par(),

    h2('Justificación y alcance'),
    h3('Introducción'), par(pr.introduccion ?? ''),
    h3('Justificación'), par(pr.justificacion ?? ''),
    h3('Alcance'),
    par(`Antecedentes: ${al.antecedentes ?? ''}`),
    par(`Situación actual: ${al.situacion_actual ?? ''}`),
    par(`Situación deseada: ${al.situacion_deseada ?? ''}`),
    par(`Población beneficiada — directos: ${al.poblacion_directa ?? ''}`),
    par(`Población beneficiada — indirectos: ${al.poblacion_indirecta ?? ''}`),
    par(`Cantidad de personas beneficiadas: ${p.beneficiarios_directos} directos, ` +
        `${p.beneficiarios_indirectos} indirectos.`),
    par(),
    h3('Resultados esperados y medios de verificación'),
    tabla([
      new TableRow({ children: [celda('Resultado', true), celda('Indicadores', true),
                                celda('Medios de verificación', true)] }),
      ...((pr.resultados ?? []) as Cualquiera[]).map((r) => new TableRow({
        children: [celda(r.resultado ?? ''), celda(r.indicadores ?? ''), celda(r.verificacion ?? '')],
      })),
    ]),
    par(),

    h2('Objetivos y metas del proyecto'),
    h3('Objetivo general'), par(pr.objetivo_general ?? ''),
    h3('Objetivos específicos'),
    ...((pr.objetivos_especificos ?? []) as string[]).map((o) =>
      new Paragraph({ text: o, bullet: { level: 0 } })),
    h3('Metas'),
    ...((pr.metas ?? []) as string[]).map((m) => new Paragraph({ text: m, bullet: { level: 0 } })),
    par(),

    h2('Plan de trabajo y matriz de responsabilidades'),
    h3('Metodología'), par(pr.metodologia ?? ''),
    tabla([
      new TableRow({ children: [celda('Actividad', true), celda('Fecha de inicio', true),
                                celda('Fecha de finalización', true), celda('Responsable', true)] }),
      ...((pr.actividades ?? []) as Cualquiera[]).map((a) => new TableRow({
        children: [celda(a.actividad ?? ''), celda(a.inicio ?? ''),
                   celda(a.fin ?? ''), celda(a.responsable ?? '')],
      })),
    ]),
    par(),

    h2('Presupuesto / fuente de financiación (en guaraníes)'),
    ...matriz('', RUBROS, FUENTES, pr.presupuesto ?? {}),

    h2('Créditos académicos'),
    tabla([
      new TableRow({ children: [celda('Créditos académicos', true, 34),
                                ...DESTINATARIOS.map(([, r]) => celda(r, true))] }),
      ...CREDITOS.map(([k, r]) => new TableRow({
        children: [celda(r, false, 34),
          ...DESTINATARIOS.map(([d]) => celda(pr.creditos?.[k]?.[d] ? 'X' : ''))],
      })),
    ]),
    par(),

    h2('Anexos'),
    ...((pr.anexos ?? []) as string[]).map((a) => new Paragraph({ text: a, bullet: { level: 0 } })),
    par(),
    firmas(),
  ]

  writeFileSync(ruta, await Packer.toBuffer(new Document({ sections: [{ children: hijos }] })))
}

/** Formato 10 — Informe de Proyecto de Extensión Universitaria. */
export async function informeDocx(
  p: Cualquiera, inf: Cualquiera, participantes: Participante[], ruta: string,
): Promise<void> {
  const b = inf.informe ?? {}
  const estudiantes = participantes.filter((x) => x.tipo === 'estudiante')
  const otros = participantes.filter((x) => x.tipo !== 'estudiante')

  const hijos: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1,
      text: 'Informe de Proyectos de Extensión Universitaria' }),
    par(`Elaborado por: ${inf.elaborado_por ?? ''}`),
    par(`Aprobado por: ${inf.aprobado_por ?? ''}`),
    par(`Fecha del informe: ${inf.fecha_informe ?? ''}`),
    par(),

    h2('Datos informativos'),
    tabla([
      ['Nombre del proyecto', p.nombre],
      ['Facultad(es) organizadora(s)', p.facultad ?? ''],
      ['Carrera(s)', p.carreras ?? ''],
      ['Líder del proyecto', p.lider ?? ''],
      ['Beneficiarios', inf.beneficiarios ?? String(p.beneficiarios_directos ?? '')],
      ['Fecha de inicio', p.fecha_inicio ?? ''],
      ['Fecha de finalización', p.fecha_fin ?? ''],
      ['Lugar de ejecución', inf.lugar_ejecucion ?? p.localizacion ?? ''],
    ].map(([a, c]) => new TableRow({ children: [celda(a, true, 34), celda(String(c ?? ''))] }))),
    par(),

    h2('Participantes del proyecto'),
    tabla([
      new TableRow({ children: [celda('Tipo', true, 26), celda('Nombre y apellido', true),
                                celda('Cátedra u organización', true)] }),
      ...otros.map((x) => new TableRow({ children: [
        celda(x.tipo, false, 26), celda(x.nombre), celda(x.organizacion ?? x.catedra ?? ''),
      ] })),
    ]),
    par(),
    h3('Estudiantes'),
    tabla([
      new TableRow({ children: [celda('Nombre y apellido', true), celda('C.I. N.º', true),
                                celda('Carrera', true), celda('Curso / ciclo', true),
                                celda('Matrícula N.º', true)] }),
      ...estudiantes.map((x) => new TableRow({ children: [
        celda(x.nombre), celda(''), celda(x.carrera ?? ''),
        celda(x.ciclo ?? ''), celda(x.matricula ?? ''),
      ] })),
    ]),
    par(),

    h2('Resumen'), par(inf.resumen ?? ''),
    h3('Metodología'), par(inf.metodologia ?? ''),
    par(),

    h2('Análisis'),
    tabla([
      new TableRow({ children: [celda('', true, 24), celda('Planteados en el proyecto', true),
                                celda('Alcanzados', true)] }),
      ...((b.analisis ?? []) as Cualquiera[]).map((a) => new TableRow({
        children: [celda(a.fila ?? '', true, 24), celda(a.planteado ?? ''), celda(a.alcanzado ?? '')],
      })),
    ]),
    par(),

    h2('Plan de trabajo'),
    tabla([
      new TableRow({ children: [celda('Actividades realizadas', true), celda('Responsables', true),
                                celda('Cronograma', true)] }),
      ...((b.plan ?? []) as Cualquiera[]).map((a) => new TableRow({
        children: [celda(a.actividad ?? ''), celda(a.responsables ?? ''), celda(a.cronograma ?? '')],
      })),
    ]),
    par(),
    tabla([
      new TableRow({ children: [celda('Metas', true), celda('Indicadores', true),
                                celda('Recursos utilizados', true)] }),
      ...((b.metas ?? []) as Cualquiera[]).map((m) => new TableRow({
        children: [celda(m.meta ?? ''), celda(m.indicadores ?? ''), celda(m.recursos ?? '')],
      })),
    ]),
    par(),

    h2('Conclusiones'), par(inf.conclusiones ?? ''),
    par(),

    h2('Rendición de cuentas (en guaraníes)'),
    ...matriz('', RUBROS, FUENTES, b.rendicion ?? {}),
    par('Obs.: solo se mencionan los rubros y recursos que se utilizaron en el proyecto.'),

    h2('Anexos'),
    ...((b.anexos ?? []) as string[]).map((a) => new Paragraph({ text: a, bullet: { level: 0 } })),
    par('Observación: el informe también deberá entregarse en formato digital con los registros ' +
        'y medios de verificación escaneados y las fotos en tamaño original.'),
    par(),
    firmas(),
  ]

  writeFileSync(ruta, await Packer.toBuffer(new Document({ sections: [{ children: hijos }] })))
}
