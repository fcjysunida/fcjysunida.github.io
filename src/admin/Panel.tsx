import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listarActividades } from '../data/panel'
import type { Actividad } from '../lib/tipos'
import { etiquetaTipo } from '../lib/campos'
import { rango, mesLargo, numero, hoyAsuncion } from '../lib/formato'
import { usePermisos } from '../lib/sesion'
import { Cargando, Dato, Aviso } from '../ui/piezas'

const ESTADOS: Record<string, string> = {
  borrador: 'Borrador', publicada: 'Publicada', cerrada: 'Cerrada', finalizada: 'Finalizada',
}

export default function Panel() {
  const [acts, setActs] = useState<Actividad[] | null>(null)
  const [error, setError] = useState('')
  const permisos = usePermisos()
  const ir = useNavigate()
  const periodo = hoyAsuncion().slice(0, 7)

  useEffect(() => {
    listarActividades().then(setActs).catch((e: Error) => setError(e.message))
  }, [])

  const delMes = useMemo(() => (acts ?? []).filter((a) => a.periodo === periodo), [acts, periodo])

  const kpis = useMemo(() => {
    const suma = (f: (a: Actividad) => number) => delMes.reduce((t, a) => t + f(a), 0)
    const tipos = new Set(delMes.map((a) => a.tipo))
    return [
      { label: 'Actividades del mes', value: delMes.length,
        note: `${tipos.size} ${tipos.size === 1 ? 'tipo distinto' : 'tipos distintos'}` },
      { label: 'Inscriptos', value: suma((a) => a.inscriptos),
        note: `sobre ${numero(suma((a) => a.cupo))} cupos ofrecidos` },
      { label: 'Asistencias registradas', value: suma((a) => a.asistencias),
        note: `en ${suma((a) => a.dias)} jornadas` },
      { label: 'Participación estudiantil', value: suma((a) => a.estudiantes),
        note: 'estudiantes de la Facultad' },
    ]
  }, [delMes])

  if (error) return <Aviso>{error}</Aviso>
  if (!acts) return <Cargando />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 24, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '46ch' }}>
          <div className="eyebrow">Coordinación de Extensión y Vinculación</div>
          <h1 style={{ fontSize: 40, lineHeight: 1.1, marginTop: 8, textTransform: 'capitalize' }}>
            {mesLargo(periodo)}
          </h1>
        </div>
        {permisos.creaActividad && (
          <button className="btn btn-primary" onClick={() => ir('/admin/nueva')}>
            Nueva actividad
          </button>
        )}
      </div>

      <hr className="rule-strong" style={{ margin: '32px 0 28px' }} />

      <div className="fc-grid" style={{ marginBottom: 34 }}>
        {kpis.map((k) => <Dato key={k.label} label={k.label} valor={numero(k.value)} nota={k.note} />)}
      </div>

      <hr className="rule" />

      {acts.length === 0 ? (
        <p className="tenue" style={{ marginTop: 24 }}>
          Todavía no hay actividades.{' '}
          {permisos.creaActividad
            ? <Link to="/admin/nueva">Cree la primera desde el constructor de formularios</Link>
            : 'La Coordinación de Extensión debe crear la primera.'}.
        </p>
      ) : (
        <div className="fc-scroll" style={{ marginTop: 8 }}>
          <table className="table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Actividad</th><th>Tipo</th><th>Fechas</th>
                <th style={{ textAlign: 'right' }}>Días</th>
                <th style={{ textAlign: 'right' }}>Inscriptos</th>
                <th style={{ textAlign: 'right' }}>Cupo</th>
                <th style={{ textAlign: 'right' }}>Asistencias</th>
                <th>Estado</th><th />
              </tr>
            </thead>
            <tbody>
              {acts.map((a) => (
                <tr key={a.id}>
                  <td className="obra" style={{ maxWidth: '30ch' }}>{a.titulo}</td>
                  <td style={{ fontSize: 13 }}>{etiquetaTipo(a.tipo)}</td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{rango(a.fecha_inicio, a.dias)}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{a.dias}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{a.inscriptos}</td>
                  <td className="numeral" style={{ textAlign: 'right', color: 'rgba(32,30,29,0.55)' }}>
                    {a.cupo || '—'}
                  </td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{a.asistencias}</td>
                  <td style={{ fontSize: 13 }}>{ESTADOS[a.estado] ?? a.estado}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <Link className="btn btn-ghost" style={{ fontSize: 13 }}
                            to={`/admin/inscripciones?a=${a.id}`}>Inscripciones</Link>
                      <Link className="btn btn-ghost" style={{ fontSize: 13 }}
                            to={`/admin/asistencia?a=${a.id}`}>Asistencia</Link>
                    </div>
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
