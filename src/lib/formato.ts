const ZONA = 'America/Asuncion'

export function fecha(iso: string): string {
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-PY', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA,
  })
}

export function fechaCorta(iso: string): string {
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-PY', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA,
  })
}

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-PY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: ZONA,
  })
}

export function diaLargo(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-PY', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA,
  })
}

/** «Del 12 al 13 de agosto de 2026» o «12 de agosto de 2026».
 *  Se arma a mano: es-PY con `day` y `month` pero sin `year` devuelve
 *  «27-agosto» en lugar de «27 de agosto». */
export function rango(inicio: string, dias: number): string {
  const d0 = new Date(inicio + 'T12:00:00')
  const dia = (d: Date) => d.toLocaleDateString('es-PY', { day: 'numeric', timeZone: ZONA })
  const mes = (d: Date) => d.toLocaleDateString('es-PY', { month: 'long', timeZone: ZONA })
  const anio = (d: Date) => d.toLocaleDateString('es-PY', { year: 'numeric', timeZone: ZONA })
  if (dias <= 1) return `${dia(d0)} de ${mes(d0)} de ${anio(d0)}`
  const d1 = new Date(d0.getTime() + (dias - 1) * 86_400_000)
  // Un solo mes: «Del 12 al 13 de agosto de 2026». Dos meses: se repite el mes.
  return mes(d0) === mes(d1) && anio(d0) === anio(d1)
    ? `Del ${dia(d0)} al ${dia(d1)} de ${mes(d1)} de ${anio(d1)}`
    : `Del ${dia(d0)} de ${mes(d0)} al ${dia(d1)} de ${mes(d1)} de ${anio(d1)}`
}

export function mesLargo(periodo: string): string {
  return new Date(periodo + '-01T12:00:00').toLocaleDateString('es-PY', {
    month: 'long', year: 'numeric', timeZone: ZONA,
  })
}

export function fechaDeJornada(inicio: string, indice: number): string {
  const d = new Date(new Date(inicio + 'T12:00:00').getTime() + indice * 86_400_000)
  return d.toISOString().slice(0, 10)
}

export function hoyAsuncion(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA })
}

export function numero(n: number): string {
  return n.toLocaleString('es-PY')
}

/** Descarga un CSV en el navegador, sin dependencias ni servicios de terceros. */
export function descargarCSV(nombre: string, filas: Record<string, unknown>[]): void {
  if (filas.length === 0) return
  const cabeceras = Object.keys(filas[0]!)
  const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [
    cabeceras.join(','),
    ...filas.map((f) => cabeceras.map((c) => escapar(f[c])).join(',')),
  ].join('\r\n')
  // BOM: Excel en español abre los acentos correctamente.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre.endsWith('.csv') ? nombre : `${nombre}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
