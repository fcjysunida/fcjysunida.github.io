import { readFileSync, mkdtempSync, existsSync } from 'node:fs'
import { extname, basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import ExcelJS from 'exceljs'

/**
 * Los sistemas académicos suelen exportar «.XLS» que en realidad es BIFF2, el
 * formato de Excel 2.1. ExcelJS no lo lee. LibreOffice sí, así que se convierte
 * a xlsx en un directorio temporal antes de leerlo.
 */
function convertirAXlsx(ruta: string): string {
  const salida = mkdtempSync(join(tmpdir(), 'fcjys-planilla-'))
  const binario = ['soffice', 'libreoffice'].find((b) => {
    try { execFileSync('which', [b], { stdio: 'ignore' }); return true } catch { return false }
  })
  if (!binario) {
    throw new Error(
      'Este archivo está en el formato antiguo de Excel y hace falta LibreOffice para leerlo.\n' +
      '  Instálelo con:  sudo apt install libreoffice-calc\n' +
      '  O ábralo en Excel o Google Sheets y guárdelo como .xlsx o .csv.',
    )
  }
  execFileSync(binario, ['--headless', '--convert-to', 'xlsx', '--outdir', salida, ruta],
               { stdio: 'ignore', timeout: 120_000 })
  const destino = join(salida, basename(ruta).replace(/\.[^.]+$/, '') + '.xlsx')
  if (!existsSync(destino)) throw new Error(`LibreOffice no pudo convertir ${basename(ruta)}.`)
  return destino
}

export interface FilaPadron {
  nombre: string
  /** Número de documento: cédula paraguaya o documento extranjero. */
  cedula: string
  tipo_documento?: string
  matricula?: string
  carrera?: string
  ciclo?: string
  /** Período propio de la fila, si la planilla trae una columna de período. */
  periodo?: string
}

/** «2021-02», «2021-2», «2021/2» y «202102» son el mismo período. */
export function normalizarPeriodo(v: string): string | undefined {
  const m = v.trim().match(/^(\d{4})\s*[-/._]?\s*0?([12])$/)
  return m ? `${m[1]}-${m[2]}` : undefined
}

const sinTildes = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Busca la columna cuyo encabezado contenga alguna de las claves. */
function indice(cab: string[], ...claves: string[]): number {
  return cab.findIndex((c) => claves.some((k) => c.includes(k)))
}

/**
 * El sistema académico exporta 95 columnas con nombres propios. Cuando se
 * reconoce ese encabezado se usa el mapeo exacto, que es mejor que adivinar:
 * el nombre viene partido en tres columnas y `dpersona` está truncado.
 */
function mapeoAcademico(cab: string[]): Record<string, number> | null {
  const i = (n: string) => cab.indexOf(n)
  if (i('p_ndoc_identidad') < 0 || i('persona_nombre') < 0) return null
  return {
    cedula: i('p_ndoc_identidad'),
    tipoDoc: i('p_gdoc_identidad'),
    apePaterno: i('persona_ape_paterno'),
    apeMaterno: i('persona_ape_materno'),
    nombres: i('persona_nombre'),
    matricula: i('cingreso'),
    carrera: i('scarrera'),
    periodo: i('periodo_sigla'),
    condicion: i('scondicion'),
    estado: i('sestado'),
  }
}

function armarAcademico(m: Record<string, number>, filas: string[][]): FilaPadron[] {
  const en = (f: string[], k: number) => (k >= 0 ? (f[k] ?? '').toString().trim() : '')
  // No se filtra por tipo de documento: parte del alumnado es extranjero y no
  // tiene cédula paraguaya. Dejarlos fuera del padrón los contaría como
  // «externos» en el informe, que es exactamente lo contrario de lo correcto.
  return filas
    .map((f) => {
      const apellidos = [en(f, m.apePaterno ?? -1), en(f, m.apeMaterno ?? -1)]
        .filter(Boolean).join(' ')
      const nombres = en(f, m.nombres ?? -1)
      return {
        nombre: [apellidos, nombres].filter(Boolean).join(', '),
        cedula: en(f, m.cedula ?? -1).replace(/\.0$/, ''),
        tipo_documento: en(f, m.tipoDoc ?? -1) || undefined,
        matricula: en(f, m.matricula ?? -1).replace(/\.0$/, '') || undefined,
        carrera: en(f, m.carrera ?? -1) || undefined,
        ciclo: undefined,
        periodo: normalizarPeriodo(en(f, m.periodo ?? -1)),
      }
    })
    .filter((f) => f.nombre !== '' && f.cedula !== '')
}

function armar(cab: string[], filas: string[][], forzado: Record<string, number>): FilaPadron[] {
  const i = {
    nombre: forzado.nombre ?? indice(cab, 'nombre', 'apellido', 'estudiante', 'egresado'),
    cedula: forzado.cedula ?? indice(cab, 'cedula', 'documento', 'ci'),
    matricula: forzado.matricula ?? indice(cab, 'matricula', 'matr'),
    carrera: forzado.carrera ?? indice(cab, 'carrera'),
    ciclo: forzado.ciclo ?? indice(cab, 'ciclo', 'semestre', 'curso'),
    tipoDoc: forzado.tipoDoc ?? indice(cab, 'tipo de doc', 'tipo_doc', 'gdoc'),
    periodo: forzado.periodo ?? indice(cab, 'periodo'),
  }
  if (i.nombre < 0 || (i.cedula < 0 && i.matricula < 0)) {
    throw new Error(
      'No encontré la columna de nombre, ni cédula ni matrícula.\n' +
      `  Encabezados leídos: ${cab.join(' | ')}\n` +
      '  Indíquelas a mano con --col-nombre N --col-cedula N --col-matricula N\n' +
      '  (la primera columna es 1).',
    )
  }
  const en = (f: string[], k: number) => (k >= 0 ? (f[k] ?? '').toString().trim() : '')
  return filas
    .map((f) => ({
      nombre: en(f, i.nombre),
      cedula: en(f, i.cedula).replace(/\.0$/, ''),
      tipo_documento: en(f, i.tipoDoc) || undefined,
      matricula: en(f, i.matricula).replace(/\.0$/, '') || undefined,
      carrera: en(f, i.carrera) || undefined,
      ciclo: en(f, i.ciclo) || undefined,
      periodo: normalizarPeriodo(en(f, i.periodo)),
    }))
    .filter((f) => f.nombre !== '' && (f.cedula !== '' || (f.matricula ?? '') !== ''))
}

/** Lee la planilla y devuelve las filas y los encabezados detectados. */
export async function leerPlanilla(
  ruta: string, forzado: Record<string, number> = {}, hoja?: string,
): Promise<{ filas: FilaPadron[]; encabezados: string[]; leidas: number }> {
  const ext = extname(ruta).toLowerCase()

  if (ext === '.csv' || ext === '.txt' || ext === '.tsv') {
    const texto = readFileSync(ruta, 'utf8').replace(/^﻿/, '')
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
    if (lineas.length < 2) throw new Error('La planilla no tiene filas de datos.')
    const primera = lineas[0]!
    const sep = (primera.match(/\t/g)?.length ?? 0) >= (primera.match(/;/g)?.length ?? 0)
      && (primera.match(/\t/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0)
      ? '\t' : (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ','
    const partir = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
    const cab = partir(primera).map(sinTildes)
    const datos = lineas.slice(1).map(partir)
    return { filas: armar(cab, datos, forzado), encabezados: partir(primera), leidas: datos.length }
  }

  if (ext === '.xlsx' || ext === '.xlsm' || ext === '.xls') {
    const archivo = ext === '.xls' ? convertirAXlsx(ruta) : ruta
    const libro = new ExcelJS.Workbook()
    await libro.xlsx.readFile(archivo)
    const h = hoja ? libro.getWorksheet(hoja) : libro.worksheets[0]
    if (!h) throw new Error(`No encontré la hoja${hoja ? ` «${hoja}»` : ''} en el archivo.`)

    const filas: string[][] = []
    h.eachRow({ includeEmpty: false }, (fila) => {
      const celdas: string[] = []
      fila.eachCell({ includeEmpty: true }, (celda, col) => {
        const v = celda.value
        celdas[col - 1] = v === null || v === undefined ? ''
          : typeof v === 'object' && 'text' in v ? String(v.text)
          : typeof v === 'object' && 'result' in v ? String(v.result ?? '')
          : String(v)
      })
      filas.push(celdas.map((c) => (c ?? '').trim()))
    })
    if (filas.length < 2) throw new Error('La hoja no tiene filas de datos.')

    // El encabezado no siempre está en la primera fila: se busca la primera que
    // mencione «cédula» o «documento», que es la columna que nunca falta.
    let iCab = filas.findIndex((f) =>
      f.some((c) => ['cedula', 'documento', 'p_ndoc_identidad', 'matricula'].some((k) =>
        sinTildes(c).includes(k))))
    if (iCab < 0) iCab = 0

    const cabCruda = filas[iCab] ?? []
    const cab = cabCruda.map(sinTildes)
    const datos = filas.slice(iCab + 1)
    const academico = Object.keys(forzado).length === 0 ? mapeoAcademico(cab) : null
    return {
      filas: academico ? armarAcademico(academico, datos) : armar(cab, datos, forzado),
      encabezados: cabCruda,
      leidas: datos.length,
    }
  }

  throw new Error(`Formato no reconocido: ${ext}. Use .xls, .xlsx, .csv o .tsv.`)
}
