import { useEffect, useMemo, useState } from 'react'
import {
  extensionResumen, extensionNomina, acreditarHoras, acreditarEgresados,
} from '../data/panel'
import type { ResumenExtension, FilaExtension } from '../data/panel'
import { descargarCSV, numero } from '../lib/formato'
import { usePermisos } from '../lib/sesion'
import { Cargando, Aviso, Dato } from '../ui/piezas'

/** Las cohortes se leen de los cuatro primeros dígitos de la matrícula. */
const COHORTES_EGRESO = ['2020', '2021']

const MOTIVO_EGRESO =
  'Acreditación por egreso: el título prueba el cumplimiento del requisito de ' +
  'Extensión Universitaria, cursado antes de que existiera esta plataforma.'

function Barra({ total, meta }: { total: number; meta: number }) {
  const pct = Math.min(100, meta > 0 ? (total / meta) * 100 : 0)
  return (
    <div style={{ height: 6, background: 'rgba(32,30,29,0.10)', width: 92 }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: pct >= 100 ? 'var(--rojo)' : 'rgba(32,30,29,0.45)',
      }} />
    </div>
  )
}

export default function Extension() {
  const permisos = usePermisos()
  const [resumen, setResumen] = useState<ResumenExtension[] | null>(null)
  const [filas, setFilas] = useState<FilaExtension[] | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const [periodo, setPeriodo] = useState('')
  const [condicion, setCondicion] = useState('')
  const [texto, setTexto] = useState('')
  const [soloDeuda, setSoloDeuda] = useState(false)

  // Acreditación manual sobre una persona de la nómina.
  const [abierta, setAbierta] = useState<FilaExtension | null>(null)
  const [horas, setHoras] = useState('')
  const [motivo, setMotivo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Acreditación por egreso, en lote.
  const [previa, setPrevia] = useState<Awaited<ReturnType<typeof acreditarEgresados>> | null>(null)
  const [corriendo, setCorriendo] = useState(false)

  const cargarResumen = () =>
    extensionResumen().then(setResumen).catch((e: Error) => setError(e.message))

  const cargarNomina = () => {
    setFilas(null)
    extensionNomina({ periodo, condicion, texto, soloDeuda })
      .then(setFilas).catch((e: Error) => setError(e.message))
  }

  useEffect(() => { void cargarResumen() }, [])
  useEffect(() => {
    const t = setTimeout(cargarNomina, texto ? 300 : 0)
    return () => clearTimeout(t)
  }, [periodo, condicion, texto, soloDeuda])

  const periodosDisponibles = useMemo(
    () => [...new Set((resumen ?? []).map((r) => r.periodo))].sort().reverse(),
    [resumen],
  )

  const totales = useMemo(() => {
    const base = (resumen ?? []).filter((r) => !condicion || r.condicion === condicion)
    const personas = base.reduce((a, r) => a + r.personas, 0)
    const cumplen = base.reduce((a, r) => a + r.cumplen, 0)
    const horasTot = base.reduce((a, r) => a + Number(r.horas_total), 0)
    const respald = base.reduce((a, r) => a + Number(r.horas_respaldadas), 0)
    return { personas, cumplen, horasTot, respald }
  }, [resumen, condicion])

  async function guardarAcreditacion() {
    if (!abierta) return
    setError(''); setAviso(''); setGuardando(true)
    try {
      await acreditarHoras({
        padronId: abierta.padron_id, horas: Number(horas),
        periodo: abierta.periodo, motivo, detalle,
      })
      setAviso(`Se acreditaron ${horas} horas a ${abierta.nombre}.`)
      setAbierta(null); setHoras(''); setMotivo(''); setDetalle('')
      cargarNomina(); void cargarResumen()
    } catch (e) { setError((e as Error).message) }
    finally { setGuardando(false) }
  }

  async function lote(simulacion: boolean) {
    setError(''); setAviso(''); setCorriendo(true)
    try {
      const r = await acreditarEgresados(COHORTES_EGRESO, MOTIVO_EGRESO, simulacion)
      setPrevia(r)
      if (!simulacion) {
        setAviso(`Se acreditaron ${numero(r.horas)} horas a ${r.personas} egresados.`)
        setPrevia(null); cargarNomina(); void cargarResumen()
      }
    } catch (e) { setError((e as Error).message) }
    finally { setCorriendo(false) }
  }

  function exportar() {
    if (!filas) return
    descargarCSV('horas-extension', filas.map((f) => ({
      nombre: f.nombre, matricula: f.matricula ?? '', cohorte: f.cohorte ?? '',
      carrera: f.carrera ?? '', condicion: f.condicion, periodo: f.periodo,
      horas_asistencia: f.horas_asistencia, horas_proyectos: f.horas_proyectos,
      horas_historicas: f.horas_historicas, horas_ajustes: f.horas_ajustes,
      horas_total: f.horas_total, horas_faltantes: f.horas_faltantes,
      cumple: f.cumple ? 'sí' : 'no',
    })))
  }

  if (error && !resumen) return <Aviso>{error}</Aviso>
  if (!resumen) return <Cargando />

  return (
    <div>
      <div className="eyebrow">Extensión Universitaria</div>
      <h1 style={{ fontSize: 36, lineHeight: 1.12, marginTop: 8 }}>Horas por estudiante</h1>
      <p style={{ maxWidth: '78ch', color: 'var(--tenue-2)', margin: '14px 0 0' }}>
        Cada persona del padrón debe acumular la meta de horas a lo largo de la carrera.
        Se cuentan por separado las horas <strong>respaldadas</strong> —asistencia registrada
        en la plataforma o nómina de un proyecto— y las <strong>históricas</strong>, acreditadas
        a mano porque son anteriores al sistema y no tienen respaldo de asistencia.
      </p>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />
      <Aviso>{error}</Aviso>
      <Aviso tono="nota">{aviso}</Aviso>

      <div className="fc-grid" style={{ marginBottom: 32 }}>
        <Dato label="Personas en el padrón" valor={numero(totales.personas)}
              nota={condicion ? `condición: ${condicion}` : 'estudiantes y egresados'} />
        <Dato label="Alcanzan la meta" valor={numero(totales.cumplen)}
              nota={totales.personas > 0
                ? `${Math.round((totales.cumplen / totales.personas) * 100)}% del total` : '—'} />
        <Dato label="Horas acumuladas" valor={numero(totales.horasTot)}
              nota={`${numero(totales.respald)} con respaldo en la plataforma`} />
      </div>

      {/* ── Acreditación por egreso ───────────────────────────────────── */}
      {permisos.creaActividad && (
        <div className="tarjeta" style={{ padding: 20, marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>
            Acreditación por egreso
          </div>
          <p style={{ maxWidth: '74ch', color: 'var(--tenue-2)', margin: '8px 0 14px', fontSize: 14 }}>
            A los egresados de las cohortes {COHORTES_EGRESO.join(' y ')} —según los cuatro
            primeros dígitos de la matrícula— se les acredita el saldo que falte para llegar
            a la meta, imputado a su período de egreso. El fundamento es el título: no se
            les inscribe como participantes de proyectos concretos, porque eso afirmaría una
            asistencia que nadie registró.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" disabled={corriendo}
                    onClick={() => void lote(true)}>
              Simular la acreditación
            </button>
            {previa && previa.personas > 0 && (
              <button className="btn" disabled={corriendo} onClick={() => void lote(false)}>
                Acreditar {numero(previa.horas)} horas a {previa.personas} egresados
              </button>
            )}
          </div>
          {previa && (
            <div style={{ marginTop: 14, fontSize: 14 }}>
              {previa.personas === 0
                ? <span className="tenue">No hay egresados de esas cohortes por debajo de la meta.</span>
                : (
                  <div className="fc-scroll">
                    <table className="table">
                      <thead><tr>
                        <th>Nombre</th><th>Matrícula</th><th>Egreso</th>
                        <th style={{ textAlign: 'right' }}>Tenía</th><th style={{ textAlign: 'right' }}>Se acreditan</th>
                      </tr></thead>
                      <tbody>
                        {previa.detalle.map((d) => (
                          <tr key={d.matricula}>
                            <td>{d.nombre}</td><td className="numeral">{d.matricula}</td>
                            <td>{d.periodo_egreso}</td>
                            <td className="numeral" style={{ textAlign: 'right' }}>{d.tenia}</td>
                            <td className="numeral" style={{ textAlign: 'right' }}>{d.se_acreditan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* ── Conteo por período ────────────────────────────────────────── */}
      <div style={{ fontFamily: 'var(--serif)', fontSize: 19, marginBottom: 12 }}>
        Conteo por período
      </div>
      <div className="fc-scroll" style={{ marginBottom: 34 }}>
        <table className="table">
          <thead><tr>
            <th>Período</th><th>Condición</th>
            <th style={{ textAlign: 'right' }}>Personas</th><th style={{ textAlign: 'right' }}>Cumplen</th>
            <th style={{ textAlign: 'right' }}>Sin horas</th><th style={{ textAlign: 'right' }}>Promedio</th>
            <th style={{ textAlign: 'right' }}>Respaldadas</th><th style={{ textAlign: 'right' }}>Históricas</th>
          </tr></thead>
          <tbody>
            {resumen.map((r) => (
              <tr key={`${r.periodo}-${r.condicion}`}>
                <td className="numeral">{r.periodo}</td>
                <td>{r.condicion === 'egresado' ? 'Egresados' : 'Estudiantes'}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{r.personas}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{r.cumplen}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{r.sin_horas}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{r.horas_promedio}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{numero(r.horas_respaldadas)}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{numero(r.horas_historicas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Nómina ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>
          Nómina
          {filas && (
            <span className="tenue" style={{ fontSize: 14, fontFamily: 'var(--sans)' }}>
              {' '}— {filas.length} personas
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input className="input input-linea" style={{ width: 200 }} placeholder="Nombre o matrícula"
                 value={texto} onChange={(e) => setTexto(e.target.value)} />
          <select className="input input-linea" style={{ width: 'auto' }} aria-label="Período"
                  value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="">Todos los períodos</option>
            {periodosDisponibles.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input input-linea" style={{ width: 'auto' }} aria-label="Condición"
                  value={condicion} onChange={(e) => setCondicion(e.target.value)}>
            <option value="">En curso y egresados</option>
            <option value="estudiante">En curso</option>
            <option value="egresado">Egresados</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input type="checkbox" checked={soloDeuda}
                   onChange={(e) => setSoloDeuda(e.target.checked)} />
            Solo por debajo de la meta
          </label>
          <button className="btn btn-secondary" onClick={exportar} disabled={!filas}>
            Exportar
          </button>
        </div>
      </div>

      {!filas ? <Cargando /> : filas.length === 0 ? (
        <p className="tenue">No hay personas que cumplan ese filtro.</p>
      ) : (
        <div className="fc-scroll">
          <table className="table">
            <thead><tr>
              <th>Nombre</th><th>Matrícula</th><th>Cohorte</th><th>Condición</th>
              <th style={{ textAlign: 'right' }}>Asistencia</th><th style={{ textAlign: 'right' }}>Proyectos</th>
              <th style={{ textAlign: 'right' }}>Históricas</th><th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Faltan</th><th />
            </tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.padron_id}>
                  <td>
                    {f.nombre}
                    <div className="tenue" style={{ fontSize: 12 }}>
                      {f.cedula_mascara ?? 'sin documento'}
                      {f.carrera ? ` · ${f.carrera}` : ''}
                    </div>
                  </td>
                  <td className="numeral">{f.matricula ?? '—'}</td>
                  <td className="numeral">{f.cohorte ?? '—'}</td>
                  <td>{f.condicion === 'egresado' ? 'Egresado' : 'En curso'}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{f.horas_asistencia}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{f.horas_proyectos}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{f.horas_historicas + f.horas_ajustes}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                                  justifyContent: 'flex-end' }}>
                      {f.horas_total}
                      <Barra total={f.horas_total} meta={f.horas_total + f.horas_faltantes} />
                    </div>
                  </td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{f.horas_faltantes || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {permisos.creaActividad && (
                      <button className="btn btn-ghost" onClick={() => {
                        setAbierta(f); setHoras(String(f.horas_faltantes || ''))
                        setMotivo(''); setDetalle('')
                      }}>Sumar horas</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Alta manual ───────────────────────────────────────────────── */}
      {abierta && (
        <div className="tarjeta" style={{ padding: 20, marginTop: 26, maxWidth: 620 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>
            Sumar horas a {abierta.nombre}
          </div>
          <p style={{ color: 'var(--tenue-2)', margin: '8px 0 16px', fontSize: 14 }}>
            Estas horas se registran como <strong>históricas</strong>: quedan asentadas como
            no respaldadas por la plataforma. El motivo es obligatorio y se guarda en auditoría.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label>
              <div style={{ fontSize: 12, marginBottom: 5, color: 'rgba(32,30,29,0.7)' }}>Horas</div>
              <input className="input" type="number" min="0.5" step="0.5" style={{ width: 140 }}
                     value={horas} onChange={(e) => setHoras(e.target.value)} />
            </label>
            <label>
              <div style={{ fontSize: 12, marginBottom: 5, color: 'rgba(32,30,29,0.7)' }}>Motivo</div>
              <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                     placeholder="En qué se basa la acreditación" />
            </label>
            <label>
              <div style={{ fontSize: 12, marginBottom: 5, color: 'rgba(32,30,29,0.7)' }}>Detalle (opcional)</div>
              <textarea className="input" rows={2} value={detalle}
                        onChange={(e) => setDetalle(e.target.value)}
                        placeholder="Actividades que se reconocen, resolución, expediente" />
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" onClick={() => void guardarAcreditacion()}
                      disabled={guardando || !motivo.trim() || !(Number(horas) > 0)}>
                Acreditar
              </button>
              <button className="btn btn-ghost" onClick={() => setAbierta(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
