import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  certificadosDe, emitirCertificados, anularCertificado, listarPlantillas,
  avisarCertificados,
} from '../data/panel'
import type { Certificado, PlantillaCertificado, RolCertificado } from '../lib/tipos'
import { fechaHora, descargarCSV, numero } from '../lib/formato'
import { basePublica } from '../lib/institucion'
import { usePermisos } from '../lib/sesion'
import { Cargando, Aviso } from '../ui/piezas'
import { useActividadElegida, Selector } from './SelectorActividad'

const ROLES: { id: RolCertificado; label: string }[] = [
  { id: 'participante', label: 'Participante' },
  { id: 'disertante',   label: 'Disertante' },
  { id: 'organizador',  label: 'Organizador' },
  { id: 'tutor',        label: 'Tutor' },
  { id: 'panelista',    label: 'Panelista' },
  { id: 'moderador',    label: 'Moderador' },
]

export default function Certificados() {
  const { acts, actividad, id, elegir, error } = useActividadElegida()
  const permisos = usePermisos()
  const [filas, setFilas] = useState<Certificado[] | null>(null)
  const [plantillas, setPlantillas] = useState<PlantillaCertificado[]>([])
  const [rol, setRol] = useState<RolCertificado>('participante')
  const [minimo, setMinimo] = useState(1)
  const [plantilla, setPlantilla] = useState<string>('')
  const [aviso, setAviso] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const cargar = () => {
    if (!id) return
    setFilas(null)
    certificadosDe(id).then(setFilas).catch((e: Error) => setAviso(e.message))
  }
  useEffect(cargar, [id])
  useEffect(() => { listarPlantillas().then(setPlantillas).catch(() => setPlantillas([])) }, [])

  async function emitir(simulacion: boolean) {
    setAviso(''); setTrabajando(true)
    try {
      const r = await emitirCertificados(id, rol, minimo, plantilla || null, simulacion)
      if (r.sin_plantilla) {
        setAviso('No hay ninguna plantilla vigente para ese rol. Cree una antes de emitir.')
        return
      }
      setAviso(simulacion
        ? `Se emitirían ${r.a_emitir} constancias de ${rol}. ${r.ya_tenian} personas ya la tienen.`
        : `Se emitieron ${r.a_emitir} constancias. El aviso a cada persona quedó encolado.`)
      if (!simulacion) cargar()
    } catch (e) { setAviso((e as Error).message) } finally { setTrabajando(false) }
  }

  if (error) return <Aviso>{error}</Aviso>
  if (!acts) return <Cargando />
  if (acts.length === 0) return <p className="tenue">Todavía no hay actividades.</p>

  const vigentes = (filas ?? []).filter((c) => !c.anulado_en)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 24, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '42ch' }}>
          <div className="eyebrow">Constancias</div>
          <h1 style={{ fontSize: 32, lineHeight: 1.15, marginTop: 6 }}>{actividad?.titulo ?? '—'}</h1>
        </div>
        <Selector acts={acts} id={id} elegir={elegir} />
      </div>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />
      <Aviso tono="nota">{aviso}</Aviso>

      {permisos.exporta && (
        <div style={{ marginBottom: 30 }}>
          <h2 style={{ fontSize: 22 }}>Emitir</h2>
          <p className="bloque-nota" style={{ maxWidth: '76ch' }}>
            Alcanza a las inscripciones confirmadas que pidieron certificado y que registraron
            al menos la cantidad de jornadas indicada. Cada constancia lleva un código de
            verificación público y congela el nombre, la fecha y las horas del día de emisión.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 170 }}>
              <label htmlFor="c-rol">Rol</label>
              <select id="c-rol" className="input" value={rol}
                      onChange={(e) => setRol(e.target.value as RolCertificado)}>
                {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ width: 160 }}>
              <label htmlFor="c-min">Jornadas mínimas</label>
              <input id="c-min" className="input" type="number" min={0}
                     max={actividad?.dias ?? 10} value={minimo}
                     onChange={(e) => setMinimo(Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <div className="field" style={{ minWidth: 220 }}>
              <label htmlFor="c-plt">Plantilla</label>
              <select id="c-plt" className="input" value={plantilla}
                      onChange={(e) => setPlantilla(e.target.value)}>
                <option value="">La que corresponda al rol</option>
                {plantillas.filter((p) => p.vigente).map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-secondary" disabled={trabajando}
                    onClick={() => void emitir(true)}>Simular</button>
            <button className="btn btn-primary" disabled={trabajando}
                    onClick={() => {
                      if (!window.confirm(
                        'Se emitirán las constancias y se encolará un aviso por correo a cada ' +
                        'persona.\n\n¿Continuar?')) return
                      void emitir(false)
                    }}>Emitir</button>
          </div>
        </div>
      )}

      <hr className="rule" style={{ margin: '10px 0 20px' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 25 }}>Emitidas</h2>
        {(filas?.length ?? 0) > 0 && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Link className="btn btn-secondary" style={{ fontSize: 13 }}
                to={`/admin/certificados/imprimir?a=${id}`}>
            Imprimir todas en PDF
          </Link>
          {permisos.exporta && (
            <button className="btn btn-ghost" disabled={trabajando}
                    onClick={() => {
                      void avisarCertificados(id, true).then((r) => {
                        if (r.a_enviar === 0) {
                          setAviso(`No hay avisos pendientes. ${r.ya_avisados} ya se enviaron` +
                                   (r.sin_correo_valido > 0
                                     ? `, ${r.sin_correo_valido} sin correo válido.` : '.'))
                          return
                        }
                        if (!window.confirm(
                          `Se enviará el aviso de constancia a ${r.a_enviar} personas.\n` +
                          `${r.ya_avisados} ya lo recibieron` +
                          (r.sin_correo_valido > 0
                            ? ` y ${r.sin_correo_valido} no tienen correo válido` : '') +
                          '.\n\nEl correo no se puede desenviar. ¿Autoriza el envío?')) return
                        void avisarCertificados(id, false)
                          .then((f) => { setAviso(`${f.a_enviar} avisos encolados.`); cargar() })
                          .catch((e: Error) => setAviso(e.message))
                      }).catch((e: Error) => setAviso(e.message))
                    }}>
              Autorizar el aviso por correo
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => descargarCSV(
            `constancias-${actividad?.titulo.slice(0, 40) ?? id}`,
            (filas ?? []).map((c) => ({
              codigo: c.codigo, nombre: c.nombre, rol: c.rol, horas: c.horas,
              jornadas: c.jornadas, correo: c.email,
              enlace: `${basePublica()}/c/${c.codigo}`,
              estado: c.anulado_en ? 'anulada' : 'vigente',
              aviso: c.aviso_enviado_en ? 'enviado' : 'pendiente',
            })))}>
            Exportar el listado
          </button>
          </div>
        )}
      </div>

      {!filas ? <Cargando /> : filas.length === 0 ? (
        <p className="tenue" style={{ marginTop: 12 }}>
          Todavía no se emitieron constancias para esta actividad.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--tenue)', margin: '4px 0 14px' }}>
            {numero(vigentes.length)} vigentes de {numero(filas.length)} emitidas.
          </p>
          <div className="fc-scroll">
            <table className="table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Código</th><th>Nombre</th><th>Rol</th>
                  <th style={{ textAlign: 'right' }}>Horas</th>
                  <th style={{ textAlign: 'right' }}>Jorn.</th>
                  <th>Emitida</th><th>Estado</th><th>Aviso</th><th />
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => (
                  <tr key={c.id}>
                    <td className="numeral" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                      <Link to={`/c/${c.codigo}`}>{c.codigo}</Link>
                    </td>
                    <td className="obra">{c.nombre}</td>
                    <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{c.rol}</td>
                    <td className="numeral" style={{ textAlign: 'right' }}>{c.horas}</td>
                    <td className="numeral" style={{ textAlign: 'right' }}>{c.jornadas}</td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{fechaHora(c.emitido_en)}</td>
                    <td style={{ fontSize: 13, color: c.anulado_en ? 'var(--rojo-oscuro)' : undefined }}>
                      {c.anulado_en ? 'Anulada' : 'Vigente'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--tenue)' }}>
                      {c.aviso_enviado_en ? 'enviado' : '—'}
                    </td>
                    <td>
                      {!c.anulado_en && permisos.creaActividad && (
                        <button className="btn btn-ghost" style={{ fontSize: 13 }}
                                onClick={() => {
                                  const m = window.prompt(
                                    'La anulación queda asentada en auditoría.\n¿Motivo?')
                                  if (!m?.trim()) return
                                  void anularCertificado(c.id, m.trim())
                                    .then(cargar).catch((e: Error) => setAviso(e.message))
                                }}>Anular</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <hr className="rule-strong" style={{ margin: '36px 0 20px' }} />
      <h2 style={{ fontSize: 25 }}>Plantillas</h2>
      <p className="bloque-nota" style={{ maxWidth: '76ch' }}>
        Se escriben en HTML con etiquetas <code>&lt;&lt;Etiqueta&gt;&gt;</code>, la misma
        sintaxis que usaba Autocrat. Disponibles: <code>&lt;&lt;Nombres&gt;&gt;</code>,{' '}
        <code>&lt;&lt;Apellido&gt;&gt;</code>, <code>&lt;&lt;NombreCompleto&gt;&gt;</code>,{' '}
        <code>&lt;&lt;Evento&gt;&gt;</code>, <code>&lt;&lt;Fecha&gt;&gt;</code>,{' '}
        <code>&lt;&lt;Horas&gt;&gt;</code>, <code>&lt;&lt;Rol&gt;&gt;</code>,{' '}
        <code>&lt;&lt;Modalidad&gt;&gt;</code>, <code>&lt;&lt;Lugar&gt;&gt;</code>,{' '}
        <code>&lt;&lt;Jornadas&gt;&gt;</code>, <code>&lt;&lt;Codigo&gt;&gt;</code> y{' '}
        <code>&lt;&lt;FechaEmision&gt;&gt;</code>. El fondo es la imagen del diseño
        institucional exportada del archivo de Slides.
      </p>
      <div className="fc-scroll" style={{ marginTop: 10 }}>
        <table className="table" style={{ minWidth: 560 }}>
          <thead><tr><th>Plantilla</th><th>Rol</th><th>Orientación</th><th>Fondo</th><th>Estado</th></tr></thead>
          <tbody>
            {plantillas.map((p) => (
              <tr key={p.id}>
                <td className="obra">{p.nombre}</td>
                <td style={{ fontSize: 13, textTransform: 'capitalize' }}>
                  {p.rol ?? 'cualquiera'}
                </td>
                <td style={{ fontSize: 13 }}>{p.orientacion}</td>
                <td style={{ fontSize: 13 }}>{p.fondo_url ? 'sí' : 'sin fondo'}</td>
                <td style={{ fontSize: 13 }}>{p.vigente ? 'Vigente' : 'Retirada'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
