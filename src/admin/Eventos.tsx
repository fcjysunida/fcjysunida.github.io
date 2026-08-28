import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarEventos, guardarEvento, listarCarreras } from '../data/panel'
import type { Evento, Carrera } from '../data/panel'
import { fechaCorta, numero } from '../lib/formato'
import { usePermisos } from '../lib/sesion'
import { Cargando, Aviso, Dato } from '../ui/piezas'
import { Icono } from '../ui/iconos'

const TIPOS: { id: string; label: string }[] = [
  { id: 'reunion_empresa',     label: 'Reunión con empresa u organismo' },
  { id: 'visita_institucional', label: 'Visita institucional' },
  { id: 'feria_empleo',        label: 'Feria de empleo o pasantías' },
  { id: 'charla',              label: 'Charla o conversatorio' },
  { id: 'firma_convenio',      label: 'Firma de convenio' },
  { id: 'mesa_trabajo',        label: 'Mesa de trabajo' },
  { id: 'otro',                label: 'Otro' },
]

const VINCULOS: { id: string; label: string }[] = [
  { id: 'pasantia',      label: 'Pasantías' },
  { id: 'extension',     label: 'Extensión' },
  { id: 'investigacion', label: 'Investigación' },
  { id: 'convenios',     label: 'Convenios' },
]

const VACIO: Record<string, string> = {
  id: '', titulo: '', tipo: 'reunion_empresa', fecha: '', fecha_fin: '',
  lugar: '', organizacion: '', resumen: '', informe: '', informe_en: '',
  beneficiarios: '', horas_reloj: '',
}

export default function Eventos() {
  const permisos = usePermisos()
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [carreras, setCarreras] = useState<Carrera[]>([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(VACIO)
  const [carrerasSel, setCarrerasSel] = useState<string[]>([])
  const [vinculoSel, setVinculoSel] = useState<string[]>(['pasantia'])
  const [certifica, setCertifica] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cargar = () =>
    listarEventos().then(setEventos).catch((e: Error) => setError(e.message))

  useEffect(() => {
    void cargar()
    listarCarreras().then(setCarreras).catch(() => setCarreras([]))
  }, [])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const alternar = (lista: string[], set: (v: string[]) => void, valor: string) =>
    set(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor])

  function abrirNuevo() {
    setForm(VACIO); setCarrerasSel([]); setVinculoSel(['pasantia'])
    setCertifica(false); setAbierto(true)
  }

  function abrirExistente(e: Evento) {
    setForm({
      id: e.id, titulo: e.titulo, tipo: e.tipo, fecha: e.fecha,
      fecha_fin: e.fecha_fin ?? '', lugar: e.lugar ?? '',
      organizacion: e.organizacion ?? '', resumen: e.resumen ?? '',
      informe: e.informe ?? '', informe_en: e.informe_en ?? '',
      beneficiarios: e.beneficiarios != null ? String(e.beneficiarios) : '',
      horas_reloj: e.horas_reloj != null ? String(e.horas_reloj) : '',
    })
    setCarrerasSel(e.carreras ?? []); setVinculoSel(e.vinculo ?? [])
    setCertifica(e.certifica); setAbierto(true)
  }

  async function guardar() {
    setError(''); setAviso(''); setGuardando(true)
    try {
      await guardarEvento({
        ...form, carreras: carrerasSel, vinculo: vinculoSel, certifica,
      })
      setAviso('Evento guardado.')
      setAbierto(false); void cargar()
    } catch (e) { setError((e as Error).message) }
    finally { setGuardando(false) }
  }

  if (error && !eventos) return <Aviso>{error}</Aviso>
  if (!eventos) return <Cargando />

  const conInforme = eventos.filter((e) => e.tiene_informe).length
  const dePasantia = eventos.filter((e) => e.vinculo.includes('pasantia')).length

  return (
    <div>
      <div className="eyebrow">Extensión — sin inscripción</div>
      <h1 style={{ fontSize: 36, lineHeight: 1.12, marginTop: 8 }}>Registros de actividad</h1>
      <p style={{ maxWidth: '78ch', color: 'var(--tenue-2)', margin: '14px 0 0' }}>
        Reuniones con empresas, visitas, ferias de empleo y firmas de convenio. Se cargan
        <strong> después de que ocurrieron</strong>: no abren formulario ni toman asistencia.
        Llevan informe, nómina cargada a mano y, si corresponde, certificación —lo que piden
        los artículos 19 y 20 del Reglamento de Proyección Social y Extensión Universitaria.
      </p>

      <div className="tarjeta" style={{ padding: '14px 18px', marginTop: 18,
                                        display: 'flex', gap: 12, alignItems: 'flex-start',
                                        maxWidth: '78ch' }}>
        <Icono nombre="actividad" tam={20} />
        <div style={{ fontSize: 14 }}>
          <strong>¿Necesita que la gente se inscriba?</strong> Entonces no es un registro:
          es una <Link to="/admin/nueva">actividad</Link>. Las actividades abren un
          formulario público, toman asistencia por código de sala, emiten constancias y
          miden satisfacción. Los registros no hacen nada de eso: solo dejan constancia.
        </div>
      </div>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />
      <Aviso>{error}</Aviso>
      <Aviso tono="nota">{aviso}</Aviso>

      <div className="fc-grid" style={{ marginBottom: 30 }}>
        <Dato label="Registros cargados" valor={numero(eventos.length)} />
        <Dato label="Con informe presentado" valor={numero(conInforme)}
              nota="art. 19 del reglamento" />
        <Dato label="Ligados a pasantías" valor={numero(dePasantia)} />
      </div>

      {permisos.edita && !abierto && (
        <button className="btn btn-primary" style={{ marginBottom: 26 }} onClick={abrirNuevo}>
          Cargar un registro
        </button>
      )}

      {abierto && (
        <div className="tarjeta" style={{ padding: 22, marginBottom: 30, maxWidth: 780 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 19, marginBottom: 16 }}>
            {form.id ? 'Editar el registro' : 'Nuevo registro'}
          </div>

          <div style={{ display: 'grid', gap: 16,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Título</label>
              <input className="input" value={form.titulo}
                     onChange={(e) => set('titulo', e.target.value)} />
            </label>
            <label className="field">
              <label>Tipo</label>
              <select className="input" value={form.tipo}
                      onChange={(e) => set('tipo', e.target.value)}>
                {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="field">
              <label>Organización</label>
              <input className="input" value={form.organizacion}
                     onChange={(e) => set('organizacion', e.target.value)} />
            </label>
            <label className="field">
              <label>Fecha</label>
              <input className="input" type="date" value={form.fecha}
                     onChange={(e) => set('fecha', e.target.value)} />
            </label>
            <label className="field">
              <label>Fecha de cierre (si dura más de un día)</label>
              <input className="input" type="date" value={form.fecha_fin}
                     onChange={(e) => set('fecha_fin', e.target.value)} />
            </label>
            <label className="field">
              <label>Lugar</label>
              <input className="input" value={form.lugar}
                     onChange={(e) => set('lugar', e.target.value)} />
            </label>
            <label className="field">
              <label>Público beneficiado (N°)</label>
              <input className="input" type="number" min="0" value={form.beneficiarios}
                     onChange={(e) => set('beneficiarios', e.target.value)} />
            </label>
            <label className="field">
              <label>Horas reloj</label>
              <input className="input" type="number" min="0" step="0.5" value={form.horas_reloj}
                     onChange={(e) => set('horas_reloj', e.target.value)} />
            </label>
          </div>

          <div className="field" style={{ marginTop: 18 }}>
            <label>Carreras involucradas</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
              {carreras.map((c) => (
                <label key={c.codigo}
                       style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <input type="checkbox" checked={carrerasSel.includes(c.nombre)}
                         onChange={() => alternar(carrerasSel, setCarrerasSel, c.nombre)} />
                  {c.nombre}
                </label>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>A qué función responde</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
              {VINCULOS.map((v) => (
                <label key={v.id}
                       style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <input type="checkbox" checked={vinculoSel.includes(v.id)}
                         onChange={() => alternar(vinculoSel, setVinculoSel, v.id)} />
                  {v.label}
                </label>
              ))}
            </div>
          </div>

          <label className="field" style={{ marginTop: 16 }}>
            <label>Resumen</label>
            <textarea className="input" rows={2} value={form.resumen}
                      onChange={(e) => set('resumen', e.target.value)} />
          </label>

          <label className="field" style={{ marginTop: 16 }}>
            <label>Informe de la actividad (art. 19)</label>
            <textarea className="input" rows={5} value={form.informe}
                      onChange={(e) => set('informe', e.target.value)}
                      placeholder="Actividad, fechas, responsables, integrantes, público beneficiado, recursos utilizados." />
          </label>

          <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap',
                        alignItems: 'flex-end' }}>
            <label className="field">
              <label>Fecha del informe</label>
              <input className="input" type="date" value={form.informe_en}
                     onChange={(e) => set('informe_en', e.target.value)} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
                            paddingBottom: 10 }}>
              <input type="checkbox" checked={certifica}
                     onChange={(e) => setCertifica(e.target.checked)} />
              Corresponde emitir constancia a los participantes
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
            <button className="btn btn-primary" onClick={() => void guardar()}
                    disabled={guardando || !form.titulo?.trim() || !form.fecha}>
              Guardar
            </button>
            <button className="btn btn-ghost" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {eventos.length === 0 ? (
        <p className="tenue">Todavía no hay registros cargados.</p>
      ) : (
        <div className="fc-scroll">
          <table className="table">
            <thead><tr>
              <th>Evento</th><th>Tipo</th><th>Fecha</th><th>Organización</th>
              <th style={{ textAlign: 'right' }}>Participantes</th>
              <th>Informe</th><th /></tr></thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="obra">{e.titulo}</span>
                    <div className="tenue" style={{ fontSize: 12 }}>
                      {e.vinculo.map((v) =>
                        VINCULOS.find((x) => x.id === v)?.label ?? v).join(' · ') || '—'}
                      {e.carreras.length > 0 && ` · ${e.carreras.join(', ')}`}
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {TIPOS.find((t) => t.id === e.tipo)?.label ?? e.tipo}
                  </td>
                  <td className="numeral">{fechaCorta(e.fecha)}</td>
                  <td style={{ fontSize: 13 }}>{e.organizacion ?? '—'}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>
                    {e.participantes}
                    {e.estudiantes > 0 && (
                      <span className="tenue" style={{ fontSize: 12 }}> ({e.estudiantes} est.)</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {e.tiene_informe
                      ? <>presentado{e.informe_en ? ` · ${fechaCorta(e.informe_en)}` : ''}</>
                      : <span className="tenue">pendiente</span>}
                    {e.certifica && (
                      <div className="tenue" style={{ fontSize: 12 }}>certifica</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {permisos.edita && (
                      <button className="btn btn-ghost" onClick={() => abrirExistente(e)}>
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
