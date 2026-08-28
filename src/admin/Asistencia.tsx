import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarJornadas, regenerarEnlace, regenerarCodigo, cerrarActividad } from '../data/panel'
import type { Jornada } from '../lib/tipos'
import { diaLargo, hoyAsuncion } from '../lib/formato'
import { basePublica } from '../lib/institucion'
import { usePermisos } from '../lib/sesion'
import { Cargando, Aviso } from '../ui/piezas'
import { useActividadElegida, Selector } from './SelectorActividad'

export default function Asistencia() {
  const { acts, actividad, id, elegir, error, recargar } = useActividadElegida()
  const permisos = usePermisos()
  const [jornadas, setJornadas] = useState<Jornada[] | null>(null)
  const [aviso, setAviso] = useState('')
  const [copiado, setCopiado] = useState(false)
  const hoy = hoyAsuncion()

  const cargar = () => {
    if (!id) return
    setJornadas(null)
    listarJornadas(id).then(setJornadas).catch((e: Error) => setAviso(e.message))
  }
  useEffect(cargar, [id])

  if (error) return <Aviso>{error}</Aviso>
  if (!acts) return <Cargando />
  if (acts.length === 0) return <p className="tenue">Todavía no hay actividades.</p>

  const enlace = actividad ? `${basePublica()}/a/${actividad.token_asistencia}` : ''

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 24, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '40ch' }}>
          <div className="eyebrow">Asistencia por jornada</div>
          <h1 className="tipo-display">{actividad?.titulo ?? '—'}</h1>
        </div>
        <Selector acts={acts} id={id} elegir={elegir} />
      </div>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />
      <Aviso>{aviso}</Aviso>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-end',
                    justifyContent: 'space-between' }}>
        <div style={{ maxWidth: '52ch' }}>
          <div style={{ fontSize: 13, color: 'var(--tenue)' }}>
            Un solo enlace para todas las jornadas
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, wordBreak: 'break-all',
                        marginTop: 4 }}>
            {enlace}
          </div>
          <p style={{ fontSize: 14, color: 'var(--tenue-2)', margin: '10px 0 0' }}>
            El enlace resuelve la jornada del día. Lo que cambia es el código de sala, que el
            docente anuncia al abrir cada jornada. Regenerar el enlace lo invalida y rota todos
            los códigos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => {
            void navigator.clipboard?.writeText(enlace)
            setCopiado(true); window.setTimeout(() => setCopiado(false), 1800)
          }}>
            {copiado ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
          {permisos.regeneraEnlace && (
            <button className="btn btn-primary" onClick={() => {
              if (!window.confirm(
                'Regenerar el enlace invalida el anterior en el momento y rota TODOS los códigos ' +
                'de sala. Quien tenga el enlace viejo dejará de poder registrarse.\n\n¿Continuar?',
              )) return
              void regenerarEnlace(id).then(() => { void recargar(); cargar() })
                .catch((e: Error) => setAviso(e.message))
            }}>
              Regenerar enlace
            </button>
          )}
        </div>
      </div>

      {!jornadas ? <div style={{ marginTop: 30 }}><Cargando /></div> : (
        <div style={{ display: 'grid', marginTop: 34 }}>
          {jornadas.map((j) => {
            const esHoy = j.fecha === hoy
            return (
              <div key={j.id} style={{ borderTop: '1px solid var(--regla)', padding: '22px 0',
                                       display: 'flex', flexWrap: 'wrap', gap: 28,
                                       alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>
                    Jornada {j.numero}
                    {esHoy && (
                      <span style={{ fontSize: 13, fontFamily: 'var(--sans)',
                                     color: 'var(--rojo)', marginLeft: 10 }}>
                        hoy
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--tenue)' }}>{diaLargo(j.fecha)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--tenue)' }}>Código de sala</div>
                  <div className="numeral" style={{ fontFamily: 'var(--serif)', fontSize: 40,
                                                    lineHeight: 1.1, letterSpacing: '0.06em',
                                                    color: 'var(--rojo-oscuro)' }}>
                    {j.codigo_sala}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--tenue)' }}>Asistencias</div>
                  <div className="numeral" style={{ fontFamily: 'var(--serif)', fontSize: 40,
                                                    lineHeight: 1.1 }}>
                    {j.presentes}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => {
                    if (!window.confirm(`¿Rotar el código de la jornada ${j.numero}?`)) return
                    void regenerarCodigo(id, j.numero).then(cargar)
                      .catch((e: Error) => setAviso(e.message))
                  }}>
                    Nuevo código
                  </button>
                  {esHoy && actividad && (
                    <Link className="btn btn-ghost" style={{ fontSize: 13 }}
                          to={`/a/${actividad.token_asistencia}`}>
                      Vista de registro
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {actividad && permisos.creaActividad && actividad.estado === 'publicada' && (
        <div style={{ marginTop: 40, borderTop: '2px solid var(--regla-fuerte)', paddingTop: 22 }}>
          <h2 className="tipo-titulo">Cierre de la actividad</h2>
          <p style={{ fontSize: 14, color: 'var(--tenue-2)', maxWidth: '70ch', marginTop: 8 }}>
            Al cerrarla dejan de aceptarse inscripciones nuevas y empieza a correr el plazo de
            conservación de veinticuatro meses. El registro de asistencia y la evaluación de
            satisfacción siguen disponibles.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => {
              if (!window.confirm('¿Cerrar la inscripción de esta actividad?')) return
              void cerrarActividad(id, false).then(() => void recargar())
                .catch((e: Error) => setAviso(e.message))
            }}>
              Cerrar inscripciones
            </button>
            <button className="btn btn-secondary" onClick={() => {
              if (!window.confirm('¿Marcar la actividad como finalizada?')) return
              void cerrarActividad(id, true).then(() => void recargar())
                .catch((e: Error) => setAviso(e.message))
            }}>
              Marcar como finalizada
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
