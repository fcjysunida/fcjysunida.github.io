import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listarProyectos, guardarProyecto } from '../data/panel'
import type { ProyectoResumen } from '../lib/tipos'
import { etiquetaClasificacion, etiquetaEstadoProyecto } from '../lib/proyecto'
import { fechaCorta, numero, hoyAsuncion } from '../lib/formato'
import { usePermisos } from '../lib/sesion'
import { Cargando, Aviso, Dato } from '../ui/piezas'

export default function Proyectos() {
  const [filas, setFilas] = useState<ProyectoResumen[] | null>(null)
  const [error, setError] = useState('')
  const permisos = usePermisos()
  const ir = useNavigate()

  useEffect(() => {
    listarProyectos().then(setFilas).catch((e: Error) => setError(e.message))
  }, [])

  async function crear() {
    try {
      const id = await guardarProyecto({
        nombre: 'Proyecto sin título', clasificacion: 'cursos_extracurriculares',
        estado: 'borrador', fecha_inicio: hoyAsuncion(), propuesta: {},
      })
      ir(`/admin/proyectos/${id}`)
    } catch (e) { setError((e as Error).message) }
  }

  if (error) return <Aviso>{error}</Aviso>
  if (!filas) return <Cargando />

  const horas = filas.reduce((t, p) => t + Number(p.horas_extension), 0)
  const benef = filas.reduce((t, p) => t + Number(p.beneficiarios_directos), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 24, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '46ch' }}>
          <div className="eyebrow">Extensión universitaria</div>
          <h1 style={{ fontSize: 38, lineHeight: 1.1, marginTop: 8 }}>Proyectos e informes</h1>
        </div>
        {permisos.creaActividad && (
          <button className="btn btn-primary" onClick={() => void crear()}>Nuevo proyecto</button>
        )}
      </div>
      <p style={{ maxWidth: '74ch', color: 'var(--tenue-2)', margin: '14px 0 0' }}>
        La propuesta sigue el formato «9. Propuesta de Proyecto de Extensión Universitaria» y el
        informe final, el formato «10. Informe de Proyecto de Extensión Universitaria». Ambos se
        exportan en Word con la estructura y el orden de los formularios oficiales.
      </p>

      <hr className="rule-strong" style={{ margin: '30px 0 28px' }} />

      <div className="fc-grid" style={{ marginBottom: 34 }}>
        <Dato label="Proyectos" valor={numero(filas.length)}
              nota={`${filas.filter((p) => p.estado === 'finalizado').length} finalizados`} />
        <Dato label="Horas de extensión" valor={numero(horas)} nota="según la escala del anexo" />
        <Dato label="Beneficiarios directos" valor={numero(benef)} nota="declarados en las propuestas" />
        <Dato label="Informes presentados"
              valor={numero(filas.reduce((t, p) => t + Number(p.informes), 0))}
              nota={`${filas.filter((p) => p.informes === 0).length} proyectos sin informe`} />
      </div>

      <hr className="rule" />

      {filas.length === 0 ? (
        <p className="tenue" style={{ marginTop: 24 }}>
          Todavía no hay proyectos cargados.
          {permisos.creaActividad ? ' Cree el primero con el botón de arriba.' : ''}
        </p>
      ) : (
        <div className="fc-scroll" style={{ marginTop: 8 }}>
          <table className="table" style={{ minWidth: 960 }}>
            <thead>
              <tr>
                <th>Proyecto</th><th>Clasificación</th><th>Período</th><th>Fechas</th>
                <th style={{ textAlign: 'right' }}>Horas EU</th>
                <th style={{ textAlign: 'right' }}>Estud.</th>
                <th style={{ textAlign: 'right' }}>Benef.</th>
                <th>Informe</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id}>
                  <td className="obra" style={{ maxWidth: '32ch' }}>
                    <Link to={`/admin/proyectos/${p.id}`}>{p.nombre}</Link>
                  </td>
                  <td style={{ fontSize: 13 }}>{etiquetaClasificacion(p.clasificacion)}</td>
                  <td style={{ fontSize: 13 }}>{p.periodo_academico ?? '—'}</td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {p.fecha_inicio ? fechaCorta(p.fecha_inicio) : '—'}
                  </td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{p.horas_extension}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{p.estudiantes}</td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{p.beneficiarios_directos}</td>
                  <td style={{ fontSize: 13 }}>
                    {p.informes > 0
                      ? `${p.informes} — ${p.ultimo_informe ? fechaCorta(p.ultimo_informe) : ''}`
                      : <span style={{ color: 'var(--rojo-oscuro)' }}>pendiente</span>}
                  </td>
                  <td style={{ fontSize: 13 }}>{etiquetaEstadoProyecto(p.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
