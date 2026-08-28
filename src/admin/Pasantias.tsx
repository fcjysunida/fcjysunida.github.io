import { useEffect, useMemo, useState } from 'react'
import {
  pasantiasResumen, pasantiasNomina, guardarPasantia, convalidarEgresados,
} from '../data/panel'
import type { ResumenPasantia, FilaPasantia } from '../data/panel'
import { descargarCSV, numero } from '../lib/formato'
import { usePermisos } from '../lib/sesion'
import { Cargando, Aviso, Dato } from '../ui/piezas'

/** Estados del art. 17 y del capítulo II del reglamento. */
const ESTADOS: { id: string; label: string }[] = [
  { id: 'inscrita',          label: 'Inscrita' },
  { id: 'en_curso',          label: 'En curso' },
  { id: 'informe_pendiente', label: 'Informe pendiente' },
  { id: 'informe_observado', label: 'Informe observado' },
  { id: 'aprobada',          label: 'Aprobada' },
  { id: 'reprobada',         label: 'Reprobada' },
  { id: 'abandonada',        label: 'Abandonada' },
  { id: 'convalidada',       label: 'Convalidada' },
]

const MODALIDADES: { id: string; label: string }[] = [
  { id: 'curricular',    label: 'Curricular (art. 24)' },
  { id: 'investigacion', label: 'En proyecto de investigación (art. 122.a)' },
  { id: 'convalidacion', label: 'Convalidación por experiencia laboral (art. 35)' },
]

const MOTIVO_EGRESO =
  'Convalidación por egreso (art. 35 del Reglamento de Práctica y Pasantía): el título ' +
  'acredita el cumplimiento del requisito, anterior a esta plataforma.'

const etiqueta = (lista: { id: string; label: string }[], id: string | null) =>
  lista.find((x) => x.id === id)?.label ?? '—'

function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 12, color: 'var(--rojo-oscuro)', display: 'block' }}>
      {children}
    </span>
  )
}

export default function Pasantias() {
  const permisos = usePermisos()
  const [resumen, setResumen] = useState<ResumenPasantia[] | null>(null)
  const [filas, setFilas] = useState<FilaPasantia[] | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const [periodo, setPeriodo] = useState('')
  const [condicion, setCondicion] = useState('')
  const [texto, setTexto] = useState('')
  const [soloDeuda, setSoloDeuda] = useState(false)

  const [abierta, setAbierta] = useState<FilaPasantia | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  const [previa, setPrevia] = useState<Awaited<ReturnType<typeof convalidarEgresados>> | null>(null)
  const [corriendo, setCorriendo] = useState(false)

  const cargarResumen = () =>
    pasantiasResumen().then(setResumen).catch((e: Error) => setError(e.message))

  const cargarNomina = () => {
    setFilas(null)
    pasantiasNomina({ periodo, condicion, texto, soloDeuda })
      .then(setFilas).catch((e: Error) => setError(e.message))
  }

  useEffect(() => { void cargarResumen() }, [])
  useEffect(() => {
    const t = setTimeout(cargarNomina, texto ? 300 : 0)
    return () => clearTimeout(t)
  }, [periodo, condicion, texto, soloDeuda])

  const periodos = useMemo(
    () => [...new Set((resumen ?? []).map((r) => r.periodo))].sort().reverse(),
    [resumen],
  )

  const totales = useMemo(() => {
    const base = (resumen ?? []).filter((r) => !condicion || r.condicion === condicion)
    return {
      personas: base.reduce((a, r) => a + r.personas, 0),
      cumplen: base.reduce((a, r) => a + r.cumplen, 0),
      sinRegistro: base.reduce((a, r) => a + r.sin_registro, 0),
      observadas: base.reduce((a, r) => a + r.observadas, 0),
    }
  }, [resumen, condicion])

  function abrir(f: FilaPasantia) {
    setAbierta(f)
    setForm({
      id: f.pasantia_id ?? '',
      modalidad: f.modalidad ?? 'curricular',
      estado: f.estado ?? 'inscrita',
      organizacion: f.organizacion ?? '',
      horas: f.horas ? String(f.horas) : '',
      con_convenio: f.con_convenio ? 'si' : 'no',
      semestre: '', area: '', fecha_inicio: '', fecha_fin: '',
      nota_empresa: '', nota_universidad: '',
      informe_presentado_en: '', conformidad_en: '',
      certificacion: '', motivo: '', observaciones: '',
    })
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function guardar() {
    if (!abierta) return
    setError(''); setAviso(''); setGuardando(true)
    try {
      await guardarPasantia({
        ...form,
        padron_id: abierta.padron_id,
        con_convenio: form.con_convenio === 'si',
        periodo: abierta.periodo,
      })
      setAviso(`Pasantía de ${abierta.nombre} registrada.`)
      setAbierta(null); cargarNomina(); void cargarResumen()
    } catch (e) { setError((e as Error).message) }
    finally { setGuardando(false) }
  }

  async function lote(simulacion: boolean) {
    setError(''); setAviso(''); setCorriendo(true)
    try {
      const r = await convalidarEgresados(null, MOTIVO_EGRESO, simulacion)
      setPrevia(r)
      if (!simulacion) {
        setAviso(`Se convalidó la pasantía de ${r.personas} egresados.`)
        setPrevia(null); cargarNomina(); void cargarResumen()
      }
    } catch (e) { setError((e as Error).message) }
    finally { setCorriendo(false) }
  }

  function exportar() {
    if (!filas) return
    descargarCSV('pasantias', filas.map((f) => ({
      nombre: f.nombre, matricula: f.matricula ?? '', cohorte: f.cohorte ?? '',
      carrera: f.carrera ?? '', condicion: f.condicion, periodo: f.periodo,
      modalidad: f.modalidad ?? '', estado: f.estado ?? 'sin registro',
      organizacion: f.organizacion ?? '', horas: f.horas,
      horas_faltantes: f.horas_faltantes, nota_final: f.nota_final ?? '',
      informe_fuera_de_plazo: f.informe_fuera_de_plazo ? 'sí' : 'no',
      conformidad_vencida: f.conformidad_vencida ? 'sí' : 'no',
      cumple: f.cumple ? 'sí' : 'no',
    })))
  }

  if (error && !resumen) return <Aviso>{error}</Aviso>
  if (!resumen) return <Cargando />

  return (
    <div>
      <div className="eyebrow">Prácticas preprofesionales</div>
      <h1 style={{ fontSize: 36, lineHeight: 1.12, marginTop: 8 }}>Pasantías</h1>
      <p style={{ maxWidth: '78ch', color: 'var(--tenue-2)', margin: '14px 0 0' }}>
        La pasantía es requisito de egreso (art. 5) y es obligatoria desde el sexto semestre
        (art. 7 inc. b). Se cumplen <strong>264 horas reloj</strong> (art. 29) y se aprueba
        con al menos <strong>70 %</strong>, ponderando 40 % la unidad receptora y 60 % la
        Universidad (art. 28). El seguimiento controla además los plazos del informe
        (arts. 15 y 16) y del informe de conformidad (art. 27).
      </p>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />
      <Aviso>{error}</Aviso>
      <Aviso tono="nota">{aviso}</Aviso>

      <div className="fc-grid" style={{ marginBottom: 32 }}>
        <Dato label="Personas en el padrón" valor={numero(totales.personas)}
              nota={condicion ? `condición: ${condicion}` : 'estudiantes y egresados'} />
        <Dato label="Con la pasantía cumplida" valor={numero(totales.cumplen)}
              nota={totales.personas > 0
                ? `${Math.round((totales.cumplen / totales.personas) * 100)}% del total` : '—'} />
        <Dato label="Sin registro de pasantía" valor={numero(totales.sinRegistro)}
              nota="no tienen ninguna pasantía cargada" />
        <Dato label="Con plazo vencido u observación" valor={numero(totales.observadas)}
              nota="arts. 15, 16 y 27" />
      </div>

      {/* ── Convalidación por egreso ──────────────────────────────────── */}
      {permisos.creaActividad && (
        <div className="tarjeta" style={{ padding: 20, marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>
            Convalidación por egreso — art. 35
          </div>
          <p style={{ maxWidth: '74ch', color: 'var(--tenue-2)', margin: '8px 0 14px',
                      fontSize: 14 }}>
            A quien ya tiene título se le da por cumplida la pasantía: el egreso prueba que
            el requisito se satisfizo. Se crea un registro individual por persona, en
            modalidad «convalidación», con la constancia de en qué se funda.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" disabled={corriendo}
                    onClick={() => void lote(true)}>
              Simular la convalidación
            </button>
            {previa && previa.personas > 0 && (
              <button className="btn btn-primary" disabled={corriendo}
                      onClick={() => void lote(false)}>
                Convalidar {previa.personas} egresados
              </button>
            )}
          </div>
          {previa && (
            <div style={{ marginTop: 14, fontSize: 14 }}>
              {previa.personas === 0
                ? <span className="tenue">No hay egresados sin la pasantía cumplida.</span>
                : (
                  <span className="tenue">
                    {previa.personas} egresados sin registro de pasantía, de las cohortes{' '}
                    {[...new Set(previa.detalle.map((d) => d.cohorte))].sort().join(', ')}.
                  </span>
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
            <th style={{ textAlign: 'right' }}>Personas</th>
            <th style={{ textAlign: 'right' }}>Cumplen</th>
            <th style={{ textAlign: 'right' }}>Sin registro</th>
            <th style={{ textAlign: 'right' }}>En curso</th>
            <th style={{ textAlign: 'right' }}>Convalidadas</th>
            <th style={{ textAlign: 'right' }}>Observadas</th>
          </tr></thead>
          <tbody>
            {resumen.map((r) => (
              <tr key={`${r.periodo}-${r.condicion}`}>
                <td className="numeral">{r.periodo}</td>
                <td>{r.condicion === 'egresado' ? 'Egresados' : 'Estudiantes'}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{r.personas}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{r.cumplen}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{r.sin_registro}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{r.en_curso}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{r.convalidadas}</td>
                <td className="numeral" style={{ textAlign: 'right' }}>{r.observadas}</td>
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
          <input className="input" style={{ width: 200 }} placeholder="Nombre o matrícula"
                 value={texto} onChange={(e) => setTexto(e.target.value)} />
          <select className="input" style={{ width: 'auto' }} aria-label="Período"
                  value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="">Todos los períodos</option>
            {periodos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} aria-label="Condición"
                  value={condicion} onChange={(e) => setCondicion(e.target.value)}>
            <option value="">En curso y egresados</option>
            <option value="estudiante">En curso</option>
            <option value="egresado">Egresados</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input type="checkbox" checked={soloDeuda}
                   onChange={(e) => setSoloDeuda(e.target.checked)} />
            Solo pendientes
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
              <th>Nombre</th><th>Matrícula</th><th>Condición</th><th>Estado</th>
              <th>Organización</th>
              <th style={{ textAlign: 'right' }}>Horas</th>
              <th style={{ textAlign: 'right' }}>Faltan</th>
              <th style={{ textAlign: 'right' }}>Nota</th>
              <th />
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
                  <td>{f.condicion === 'egresado' ? 'Egresado' : 'En curso'}</td>
                  <td>
                    {f.pasantia_id ? etiqueta(ESTADOS, f.estado) : (
                      <span className="tenue">sin registro</span>
                    )}
                    {f.informe_fuera_de_plazo && <Alerta>informe fuera de plazo (art. 15)</Alerta>}
                    {f.subsanacion_vencida && <Alerta>subsanación vencida (art. 16)</Alerta>}
                    {f.conformidad_vencida && <Alerta>conformidad vencida (art. 27)</Alerta>}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {f.organizacion ?? '—'}
                    {f.con_convenio && (
                      <span className="tenue" style={{ fontSize: 12 }}> · con convenio</span>
                    )}
                  </td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{f.horas}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>
                    {f.horas_faltantes || '—'}
                  </td>
                  <td className="numeral" style={{ textAlign: 'right' }}>
                    {f.nota_final ?? '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {permisos.edita && (
                      <button className="btn btn-ghost" onClick={() => abrir(f)}>
                        {f.pasantia_id ? 'Editar' : 'Registrar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Alta o edición ────────────────────────────────────────────── */}
      {abierta && (
        <div className="tarjeta" style={{ padding: 22, marginTop: 26, maxWidth: 760 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>
            Pasantía de {abierta.nombre}
          </div>
          <p style={{ color: 'var(--tenue-2)', margin: '6px 0 18px', fontSize: 14 }}>
            {abierta.matricula ? `Matrícula ${abierta.matricula} · ` : ''}
            {abierta.periodo}
          </p>

          <div style={{ display: 'grid', gap: 16,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label className="field">
              <label>Modalidad</label>
              <select className="input" value={form.modalidad}
                      onChange={(e) => set('modalidad', e.target.value)}>
                {MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <label className="field">
              <label>Estado</label>
              <select className="input" value={form.estado}
                      onChange={(e) => set('estado', e.target.value)}>
                {ESTADOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="field">
              <label>Organización receptora (art. 11)</label>
              <input className="input" value={form.organizacion}
                     onChange={(e) => set('organizacion', e.target.value)} />
            </label>
            <label className="field">
              <label>Área o dependencia</label>
              <input className="input" value={form.area}
                     onChange={(e) => set('area', e.target.value)} />
            </label>
            <label className="field">
              <label>¿Hay convenio con la UNIDA?</label>
              <select className="input" value={form.con_convenio}
                      onChange={(e) => set('con_convenio', e.target.value)}>
                <option value="no">No, la gestionó el estudiante</option>
                <option value="si">Sí, hay convenio</option>
              </select>
            </label>
            <label className="field">
              <label>Semestre (mínimo 6, art. 7 inc. b)</label>
              <input className="input" type="number" min="1" max="12" value={form.semestre}
                     onChange={(e) => set('semestre', e.target.value)} />
            </label>
            <label className="field">
              <label>Inicio</label>
              <input className="input" type="date" value={form.fecha_inicio}
                     onChange={(e) => set('fecha_inicio', e.target.value)} />
            </label>
            <label className="field">
              <label>Finalización</label>
              <input className="input" type="date" value={form.fecha_fin}
                     onChange={(e) => set('fecha_fin', e.target.value)} />
            </label>
            <label className="field">
              <label>Horas reloj cumplidas (meta 264, art. 29)</label>
              <input className="input" type="number" min="0" step="1" value={form.horas}
                     onChange={(e) => set('horas', e.target.value)} />
            </label>
            <label className="field">
              <label>Nota de la unidad receptora — 40 % (art. 28)</label>
              <input className="input" type="number" min="0" max="100" value={form.nota_empresa}
                     onChange={(e) => set('nota_empresa', e.target.value)} />
            </label>
            <label className="field">
              <label>Nota de la Universidad — 60 % (art. 28)</label>
              <input className="input" type="number" min="0" max="100"
                     value={form.nota_universidad}
                     onChange={(e) => set('nota_universidad', e.target.value)} />
            </label>
            <label className="field">
              <label>Informe presentado el (art. 15)</label>
              <input className="input" type="date" value={form.informe_presentado_en}
                     onChange={(e) => set('informe_presentado_en', e.target.value)} />
            </label>
            <label className="field">
              <label>Informe de conformidad (art. 27)</label>
              <input className="input" type="date" value={form.conformidad_en}
                     onChange={(e) => set('conformidad_en', e.target.value)} />
            </label>
          </div>

          {form.modalidad === 'convalidacion' && (
            <label className="field" style={{ marginTop: 16 }}>
              <label>Certificación que acompaña la solicitud (art. 35)</label>
              <input className="input" value={form.certificacion}
                     onChange={(e) => set('certificacion', e.target.value)}
                     placeholder="Constancia laboral, antigüedad, entidad" />
            </label>
          )}

          <label className="field" style={{ marginTop: 16 }}>
            <label>
              Motivo{form.modalidad === 'convalidacion' ? ' (obligatorio para convalidar)' : ''}
            </label>
            <input className="input" value={form.motivo}
                   onChange={(e) => set('motivo', e.target.value)} />
          </label>
          <label className="field" style={{ marginTop: 16 }}>
            <label>Observaciones</label>
            <textarea className="input" rows={2} value={form.observaciones}
                      onChange={(e) => set('observaciones', e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button className="btn btn-primary" onClick={() => void guardar()}
                    disabled={guardando
                      || (form.modalidad === 'convalidacion' && !form.motivo?.trim())}>
              Guardar
            </button>
            <button className="btn btn-ghost" onClick={() => setAbierta(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
