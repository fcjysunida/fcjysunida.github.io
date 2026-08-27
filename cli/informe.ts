import { writeFileSync } from 'node:fs'
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle,
} from 'docx'

export interface Bloque {
  n: string
  titulo: string
  items: { label: string; valor: number; unidad: string; origen: string }[]
}

export interface DatosInforme {
  periodo: string
  mes: string
  docente: string
  bloques: Bloque[]
  calidad: { respuestas: number; csat: number; nps: number; promedio: number }
}

const SIN_BORDES = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

function celda(texto: string, negrita = false, derecha = false): TableCell {
  return new TableCell({
    borders: SIN_BORDES,
    children: [new Paragraph({
      alignment: derecha ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text: texto, bold: negrita, size: 20 })],
    })],
  })
}

export function informeMarkdown(d: DatosInforme): string {
  const l: string[] = []
  l.push('# Informe Mensual de Extensión y Vinculación')
  l.push('## Docente de Tiempo Completo\n')
  l.push('## 1. Datos generales\n')
  l.push('| Campo | Valor |')
  l.push('| --- | --- |')
  l.push('| Docente | ' + d.docente + ' |')
  l.push('| Facultad | Ciencias Jurídicas y Sociales — UNIDA |')
  l.push('| Período | ' + d.mes + ' |')
  l.push('')
  for (const b of d.bloques) {
    l.push(`## ${b.n}. ${b.titulo}\n`)
    l.push('| Indicador | Valor | Unidad | Origen del dato |')
    l.push('| --- | ---: | --- | --- |')
    for (const it of b.items) {
      l.push(`| ${it.label} | ${it.valor} | ${it.unidad} | ${it.origen} |`)
    }
    l.push('')
  }
  l.push('## 7. Resumen ejecutivo\n')
  l.push('### Logros\n\n_A completar._\n')
  l.push('### Dificultades\n\n_A completar._\n')
  l.push('### Acciones de mejora\n')
  l.push(d.calidad.respuestas > 0
    ? `La encuesta de satisfacción recogió ${d.calidad.respuestas} respuestas, con un CSAT de ` +
      `${d.calidad.csat} %, un NPS de ${d.calidad.nps} puntos y una valoración media de ` +
      `${d.calidad.promedio} sobre 5.\n`
    : '_A completar._\n')
  l.push('## 8. Evidencias anexadas\n')
  l.push('- Listas de asistencia por jornada, exportadas desde el panel.')
  l.push('- Capturas de las publicaciones de difusión.')
  l.push('- Certificados emitidos.')
  return l.join('\n')
}

export async function informeDocx(d: DatosInforme, ruta: string): Promise<void> {
  const hijos: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Informe Mensual de Extensión y Vinculación', bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: 'Docente de Tiempo Completo', italics: true })] }),
    new Paragraph({ text: '' }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, text: '1. Datos generales' }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [celda('Docente', true), celda(d.docente)] }),
        new TableRow({ children: [celda('Facultad', true),
                                  celda('Ciencias Jurídicas y Sociales — UNIDA')] }),
        new TableRow({ children: [celda('Período', true), celda(d.mes)] }),
      ],
    }),
  ]

  for (const b of d.bloques) {
    hijos.push(new Paragraph({ text: '' }))
    hijos.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: `${b.n}. ${b.titulo}` }))
    hijos.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [
          celda('Indicador', true), celda('Valor', true, true),
          celda('Unidad', true), celda('Origen del dato', true),
        ] }),
        ...b.items.map((it) => new TableRow({ children: [
          celda(it.label), celda(String(it.valor), false, true),
          celda(it.unidad), celda(it.origen),
        ] })),
      ],
    }))
  }

  hijos.push(new Paragraph({ text: '' }))
  hijos.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: '7. Resumen ejecutivo' }))
  for (const sub of ['Logros', 'Dificultades', 'Acciones de mejora']) {
    hijos.push(new Paragraph({ heading: HeadingLevel.HEADING_3, text: sub }))
    hijos.push(new Paragraph({ text: '' }))
  }
  if (d.calidad.respuestas > 0) {
    hijos.push(new Paragraph({ children: [new TextRun({
      text: `La encuesta de satisfacción recogió ${d.calidad.respuestas} respuestas, con un CSAT ` +
            `de ${d.calidad.csat} %, un NPS de ${d.calidad.nps} puntos y una valoración media de ` +
            `${d.calidad.promedio} sobre 5.`,
      italics: true, size: 20 })] }))
  }

  hijos.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: '8. Evidencias anexadas' }))
  for (const t of [
    'Listas de asistencia por jornada, exportadas desde el panel.',
    'Capturas de las publicaciones de difusión.',
    'Certificados emitidos.',
  ]) hijos.push(new Paragraph({ text: t, bullet: { level: 0 } }))

  const doc = new Document({ sections: [{ children: hijos }] })
  writeFileSync(ruta, await Packer.toBuffer(doc))
}
