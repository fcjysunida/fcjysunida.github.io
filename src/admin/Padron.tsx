import { useEffect, useMemo, useState } from 'react'
import {
  listarPeriodos, guardarPeriodo, resumenPadron, importarPadron, recruzarPadron,
} from '../data/panel'
import type { PeriodoAcademico, ResumenPadron, FilaPadron, CondicionAcademica } from '../lib/tipos'
import { fechaCorta, numero } from '../lib/formato'
import { usePermisos } from '../lib/sesion'
import { Cargando, Aviso } from '../ui/piezas'

export default function Padron() {
  const permisos = usePermisos()
  const [periodos, setPeriodos] = useState<PeriodoAcademico[] | null>(null)
  const [resumen, setResumen] = useState<ResumenPadron[]>([])
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  const cargar = () => {
    listarPeriodos().then(setPeriodos).catch((e: Error) => setError(e.message))
    resumenPadron().then(setResumen).catch(() => setResumen([]))
  }
  useEffect(cargar, [])

  const totales = useMemo(() => ({
    estudiantes: resumen.reduce((t, r) => t + Number(r.estudiantes), 0),
    egresados: resumen.reduce((t, r) => t + Number(r.egresados), 0),
  }), [resumen])

  if (error) return <Aviso>{error}</Aviso>
  if (!periodos) return <Cargando />

  return (
    <div>
      <div className="eyebrow">Registro académico</div>
      <h1 className="tipo-display" style={{ marginTop: 8, maxWidth: '28ch' }}>
        Padrón de estudiantes y egresados por período
      </h1>
      <p className="entradilla">
        Es lo que permite no depender de lo que la persona declara al inscribirse. Al recibir
        una inscripción, el sistema busca la cédula en el padrón y fija la condición efectiva:
        estudiante si figura como tal en el período de la actividad, egresado si figura como
        egresado, y lo declarado si no figura. El cruce se hace sobre el HMAC de la cédula:
        no se descifra ninguna.
      </p>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />

      <div className="fc-grid" style={{ marginBottom: 34 }}>
        <Cifra label="Períodos cargados" valor={numero(periodos.length)} />
        <Cifra label="Registros de estudiantes" valor={numero(totales.estudiantes)} />
        <Cifra label="Registros de egresados" valor={numero(totales.egresados)} />
      </div>

      <Aviso tono="nota">{aviso}</Aviso>

      {permisos.edita && (
        <>
          <NuevoPeriodo alGuardar={(m) => { setAviso(m); cargar() }} />
          <Importador periodos={periodos} alTerminar={(m) => { setAviso(m); cargar() }} />
        </>
      )}

      <hr className="rule-strong" style={{ margin: '36px 0 20px' }} />
      <h2 className="tipo-titulo">Períodos</h2>
      {resumen.length === 0 ? (
        <p className="tenue" style={{ marginTop: 12 }}>
          Todavía no hay períodos cargados. Cree el primero arriba y después importe la planilla.
        </p>
      ) : (
        <div className="fc-scroll" style={{ marginTop: 10 }}>
          <table className="table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>Período</th><th>Desde</th><th>Hasta</th>
                <th style={{ textAlign: 'right' }}>Estudiantes</th>
                <th style={{ textAlign: 'right' }}>Egresados</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <tr key={r.periodo}>
                  <td className="obra">{r.periodo}</td>
                  <td style={{ fontSize: 13 }}>{fechaCorta(r.desde)}</td>
                  <td style={{ fontSize: 13 }}>{fechaCorta(r.hasta)}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{numero(Number(r.estudiantes))}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{numero(Number(r.egresados))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 13, color: 'var(--tenue)', marginTop: 18, maxWidth: '80ch' }}>
        Las cédulas del padrón se guardan cifradas y en forma de HMAC; el panel muestra
        únicamente el agregado. Para cargar varios años de planillas de una vez conviene la
        línea de comandos: <code>npm run cli -- padron:importar</code>, que lee .xlsx y .csv.
      </p>
    </div>
  )
}

function Cifra({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--tenue)' }}>{label}</div>
      <div className="numeral" style={{ fontFamily: 'var(--serif)', fontSize: 42,
                                        lineHeight: 1.05, marginTop: 2 }}>{valor}</div>
    </div>
  )
}

function NuevoPeriodo({ alGuardar }: { alGuardar: (m: string) => void }) {
  const [codigo, setCodigo] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')

  async function guardar() {
    setError('')
    if (!/^\d{4}-[12]$/.test(codigo)) {
      setError('El código del período va como «2021-1» o «2021-2».'); return
    }
    try {
      await guardarPeriodo(codigo, desde, hasta)
      alGuardar(`Período ${codigo} guardado.`)
      setCodigo(''); setDesde(''); setHasta('')
    } catch (e) { setError((e as Error).message) }
  }

  return (
    <div style={{ marginTop: 30 }}>
      <hr className="rule" style={{ marginBottom: 20 }} />
      <h2 className="tipo-titulo">Agregar un período</h2>
      <p className="bloque-nota">
        Las fechas delimitan qué actividades caen dentro del período, que es lo que decide si
        alguien era estudiante en ese momento.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ width: 130 }}>
          <label htmlFor="p-cod">Código</label>
          <input id="p-cod" className="input" placeholder="2021-1" value={codigo}
                 onChange={(e) => { setCodigo(e.target.value); setError('') }} />
        </div>
        <div className="field" style={{ width: 170 }}>
          <label htmlFor="p-desde">Desde</label>
          <input id="p-desde" className="input" type="date" value={desde}
                 onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field" style={{ width: 170 }}>
          <label htmlFor="p-hasta">Hasta</label>
          <input id="p-hasta" className="input" type="date" value={hasta}
                 onChange={(e) => setHasta(e.target.value)} />
        </div>
        <button className="btn btn-secondary" onClick={() => void guardar()}
                disabled={!codigo || !desde || !hasta}>Guardar período</button>
      </div>
      <Aviso>{error}</Aviso>
    </div>
  )
}

/** Lectura de planilla pegada o de un CSV. Para .xlsx conviene la línea de comandos. */
function Importador({
  periodos, alTerminar,
}: { periodos: PeriodoAcademico[]; alTerminar: (m: string) => void }) {
  const [periodo, setPeriodo] = useState(periodos[0]?.codigo ?? '')
  const [condicion, setCondicion] = useState<CondicionAcademica>('estudiante')
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const filas = useMemo(() => leerPegado(texto), [texto])

  async function importar() {
    setError(''); setTrabajando(true)
    try {
      const r = await importarPadron(periodo, condicion, filas)
      const c = await recruzarPadron()
      alTerminar(
        `${r.procesadas} registros cargados en ${periodo} (${r.omitidas} omitidos por falta de ` +
        `cédula o nombre). El período tiene ahora ${r.total_periodo}. ` +
        `Se recruzaron ${c.revisadas} inscripciones y se reclasificaron ${c.reclasificadas}.`,
      )
      setTexto('')
    } catch (e) { setError((e as Error).message) } finally { setTrabajando(false) }
  }

  return (
    <div style={{ marginTop: 30 }}>
      <hr className="rule" style={{ marginBottom: 20 }} />
      <h2 className="tipo-titulo">Importar una planilla</h2>
      <p className="bloque-nota">
        Pegue las filas desde Excel o Google Sheets, o el contenido de un CSV. La primera línea
        debe ser el encabezado. Se reconocen las columnas <em>nombre</em>, <em>cédula</em>,{' '}
        <em>matrícula</em>, <em>carrera</em> y <em>ciclo</em> (o <em>semestre</em>/<em>curso</em>),
        en cualquier orden.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ width: 150 }}>
          <label htmlFor="i-per">Período</label>
          <select id="i-per" className="input" value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}>
            {periodos.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo}</option>)}
          </select>
        </div>
        <div className="field" style={{ width: 170 }}>
          <label htmlFor="i-cond">Condición</label>
          <select id="i-cond" className="input" value={condicion}
                  onChange={(e) => setCondicion(e.target.value as CondicionAcademica)}>
            <option value="estudiante">Estudiantes</option>
            <option value="egresado">Egresados</option>
          </select>
        </div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="i-txt">Filas</label>
        <textarea id="i-txt" className="input" style={{ minHeight: 130, fontFamily: 'monospace',
                                                        fontSize: 13 }}
                  value={texto} onChange={(e) => { setTexto(e.target.value); setError('') }}
                  placeholder={'nombre\tcedula\tmatricula\tcarrera\tciclo\nAyala, María Fernanda\t3456789\tM-2021-045\tDerecho\t8'} />
      </div>
      {filas.length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--tenue)' }}>
          Se reconocieron <strong>{filas.length}</strong> filas. Primera:{' '}
          {filas[0]?.nombre} — cédula {filas[0]?.cedula}
          {filas[0]?.matricula ? `, matrícula ${filas[0].matricula}` : ''}.
        </p>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => void importar()}
                disabled={trabajando || filas.length === 0 || !periodo}>
          {trabajando ? 'Importando…' : `Importar ${filas.length} registros`}
        </button>
      </div>
      <Aviso>{error}</Aviso>
    </div>
  )
}

/** Lee filas pegadas (tabuladas o CSV) con detección flexible de encabezados. */
export function leerPegado(texto: string): FilaPadron[] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lineas.length < 2) return []
  const sep = (lineas[0]!.match(/\t/g)?.length ?? 0) >= (lineas[0]!.match(/,/g)?.length ?? 0) ? '\t' : ','
  const partir = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))

  const cab = partir(lineas[0]!).map((c) =>
    c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
  const buscar = (...claves: string[]) =>
    cab.findIndex((c) => claves.some((k) => c.includes(k)))

  const iNombre = buscar('nombre', 'apellido')
  const iCedula = buscar('cedula', 'ci', 'documento')
  const iMat    = buscar('matricula', 'matr')
  const iCarr   = buscar('carrera')
  const iCiclo  = buscar('ciclo', 'semestre', 'curso')
  if (iNombre < 0 || iCedula < 0) return []

  const en = (c: string[], i: number) => (i >= 0 ? (c[i] ?? '').trim() : '')
  return lineas.slice(1).map(partir).map((c) => ({
    nombre: en(c, iNombre),
    cedula: en(c, iCedula),
    matricula: en(c, iMat) || undefined,
    carrera: en(c, iCarr) || undefined,
    ciclo: en(c, iCiclo) || undefined,
  })).filter((f) => f.nombre !== '' && f.cedula !== '')
}
