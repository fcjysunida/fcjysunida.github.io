import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listarProyectos, guardarProyecto, agregarParticipantes } from '../data/panel'
import type { ProyectoResumen, ClasificacionProyecto } from '../lib/tipos'
import { CLASIFICACIONES, etiquetaClasificacion, etiquetaEstadoProyecto } from '../lib/proyecto'
import { fechaCorta, numero, hoyAsuncion } from '../lib/formato'
import { usePermisos } from '../lib/sesion'
import ImportarDocumento from './ImportarDocumento'
import type { ProyectoLeido } from '../data/panel'
import { Cargando, Aviso, Dato } from '../ui/piezas'

const TODOS = '—todos—'

export default function Proyectos() {
  const [filas, setFilas] = useState<ProyectoResumen[] | null>(null)
  const [error, setError] = useState('')
  const [anio, setAnio] = useState(TODOS)
  const [categoria, setCategoria] = useState(TODOS)
  const [clasificacion, setClasificacion] = useState(TODOS)
  const [busca, setBusca] = useState('')
  const permisos = usePermisos()
  const ir = useNavigate()

  useEffect(() => {
    listarProyectos().then(setFilas).catch((e: Error) => setError(e.message))
  }, [])

  const anios = useMemo(() => {
    const s = new Set<number>()
    for (const p of filas ?? []) {
      const a = p.anio ?? (p.fecha_inicio ? Number(p.fecha_inicio.slice(0, 4)) : null)
      if (a) s.add(a)
    }
    return [...s].sort((a, b) => b - a)
  }, [filas])

  const categorias = useMemo(() => {
    const s = new Set<string>()
    for (const p of filas ?? []) if (p.categoria_memoria) s.add(p.categoria_memoria)
    return [...s].sort()
  }, [filas])

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (filas ?? []).filter((p) => {
      const a = p.anio ?? (p.fecha_inicio ? Number(p.fecha_inicio.slice(0, 4)) : null)
      if (anio !== TODOS && String(a) !== anio) return false
      if (categoria !== TODOS && p.categoria_memoria !== categoria) return false
      if (clasificacion !== TODOS && p.clasificacion !== clasificacion) return false
      if (q && !`${p.nombre} ${p.lider ?? ''} ${p.carreras ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [filas, anio, categoria, clasificacion, busca])

  /** Crea el proyecto con lo que el documento traía y lo abre para revisar.
   *  Se guarda como borrador: nada queda aprobado sin que alguien lo mire. */
  async function crearDesde(d: ProyectoLeido) {
    setError('')
    try {
      const anio = d.fecha_inicio ? Number(d.fecha_inicio.slice(0, 4))
                                  : Number(hoyAsuncion().slice(0, 4))
      const id = await guardarProyecto({
        nombre: d.nombre || 'Proyecto sin título',
        clasificacion: (d.clasificacion || 'cursos_extracurriculares') as ClasificacionProyecto,
        estado: 'borrador',
        carreras: d.carreras?.length ? d.carreras : undefined,
        curso: d.curso || undefined,
        localizacion: d.localizacion || undefined,
        otras_organizaciones: d.otras_organizaciones || undefined,
        lider: d.lider || undefined,
        tutor: d.tutor || undefined,
        entregable: d.entregable || undefined,
        fecha_inicio: d.fecha_inicio || undefined,
        fecha_fin: d.fecha_fin || undefined,
        horas_reloj: d.horas_reloj ? Number(d.horas_reloj) : undefined,
        anio,
        fuente: 'Lectura asistida del documento remitido',
        propuesta: {
          introduccion: d.introduccion || undefined,
          justificacion: d.justificacion || undefined,
          objetivo_general: d.objetivo_general || undefined,
          metodologia: d.metodologia || undefined,
          detalle: d.detalle || undefined,
        },
      })
      // La nómina se carga por la vía de siempre, que verifica contra el padrón.
      const gente = (d.estudiantes ?? []).filter((e) => e.nombre?.trim())
      if (gente.length > 0) {
        await agregarParticipantes(id, gente.map((e) => ({
          nombre: e.nombre, cedula: e.cedula, matricula: e.matricula,
          carrera: e.carrera, tipo: 'estudiante',
        })), 'documento remitido')
      }
      ir(`/admin/proyectos/${id}`)
    } catch (e) { setError((e as Error).message) }
  }

  async function crear() {
    try {
      const id = await guardarProyecto({
        nombre: 'Proyecto sin título', clasificacion: 'cursos_extracurriculares',
        estado: 'borrador', fecha_inicio: hoyAsuncion(),
        anio: Number(hoyAsuncion().slice(0, 4)), fuente: 'carga manual', propuesta: {},
      })
      ir(`/admin/proyectos/${id}`)
    } catch (e) { setError((e as Error).message) }
  }

  if (error) return <Aviso>{error}</Aviso>
  if (!filas) return <Cargando />

  const conInforme = filas.filter((p) => p.informes > 0).length
  const conFecha = filas.filter((p) => p.fecha_inicio).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 24, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '46ch' }}>
          <div className="eyebrow">Extensión universitaria</div>
          <h1 className="tipo-display" style={{ marginTop: 8 }}>Proyectos e informes</h1>
        </div>
        {permisos.creaActividad && (
          <button className="btn btn-primary" onClick={() => void crear()}>Nuevo proyecto</button>
        )}
      </div>
      <p className="entradilla">
        La propuesta sigue el formato «9. Propuesta de Proyecto de Extensión Universitaria» y el
        informe final, el formato «10». Ambos se exportan en Word. Las actividades de las
        memorias 2021–2025 están cargadas como proyectos finalizados: sirven de historial y de
        base para redactar los informes que falten.
      </p>

      {permisos.creaActividad && (
        <div style={{ margin: '24px 0 0' }}>
          <ImportarDocumento<ProyectoLeido>
            tipo="proyecto"
            onLeido={(d) => void crearDesde(d)}
            titulo="Cargar un proyecto desde el documento remitido"
            ayuda="Word, ODT o PDF. Se leen los campos del formato 9 y la nómina de
                   estudiantes, y se crea el proyecto como borrador para que usted lo
                   revise. La nómina se cruza con el padrón como siempre." />
        </div>
      )}

      <hr className="rule-strong" style={{ margin: '30px 0 28px' }} />

      <div className="fc-grid" style={{ marginBottom: 30 }}>
        <Dato label="Proyectos" valor={numero(filas.length)}
              nota={`${anios.length} años, de ${anios[anios.length - 1] ?? '—'} a ${anios[0] ?? '—'}`} />
        <Dato label="Con fecha exacta" valor={numero(conFecha)}
              nota={`${filas.length - conFecha} documentados solo por año`} />
        <Dato label="Con informe" valor={numero(conInforme)}
              nota={`${filas.length - conInforme} sin informe cargado`} />
        <Dato label="Horas de extensión"
              valor={numero(filas.reduce((t, p) => t + Number(p.horas_extension), 0))}
              nota="según la escala del anexo" />
      </div>

      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end',
                    borderTop: '1px solid var(--regla)', paddingTop: 18 }}>
        <Filtro etiqueta="Año" valor={anio} onChange={setAnio}
                opciones={anios.map((a) => [String(a), String(a)])} />
        {categorias.length > 0 && (
          <Filtro etiqueta="Categoría" valor={categoria} onChange={setCategoria}
                  opciones={categorias.map((c) => [c, c])} ancho={190} />
        )}
        <Filtro etiqueta="Clasificación" valor={clasificacion}
                onChange={(v) => setClasificacion(v as ClasificacionProyecto | typeof TODOS)}
                opciones={CLASIFICACIONES.map((c) => [c.id, c.label])} ancho={230} />
        <div className="field" style={{ minWidth: 200 }}>
          <label htmlFor="p-busca">Buscar</label>
          <input id="p-busca" className="input input-linea" value={busca}
                 placeholder="Nombre, responsable o carrera"
                 onChange={(e) => setBusca(e.target.value)} />
        </div>
        {(anio !== TODOS || categoria !== TODOS || clasificacion !== TODOS || busca) && (
          <button className="btn btn-ghost" onClick={() => {
            setAnio(TODOS); setCategoria(TODOS); setClasificacion(TODOS); setBusca('')
          }}>Limpiar</button>
        )}
      </div>

      <p style={{ fontSize: 13, color: 'var(--tenue)', margin: '14px 0 6px' }}>
        {visibles.length === filas.length
          ? `${numero(filas.length)} proyectos`
          : `${numero(visibles.length)} de ${numero(filas.length)} proyectos`}
      </p>

      {visibles.length === 0 ? (
        <p className="tenue" style={{ marginTop: 20 }}>Ningún proyecto coincide con ese filtro.</p>
      ) : (
        <div className="fc-scroll">
          <table className="table" style={{ minWidth: 940 }}>
            <thead>
              <tr>
                <th style={{ width: 62 }}>Año</th>
                <th>Proyecto</th><th>Clasificación</th><th>Categoría</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Horas EU</th>
                <th>Informe</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id}>
                  <td className="numeral" style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>
                    {p.anio ?? (p.fecha_inicio ? p.fecha_inicio.slice(0, 4) : '—')}
                  </td>
                  <td className="obra" style={{ maxWidth: '42ch' }}>
                    <Link to={`/admin/proyectos/${p.id}`}>{p.nombre}</Link>
                  </td>
                  <td style={{ fontSize: 13 }}>{etiquetaClasificacion(p.clasificacion)}</td>
                  <td style={{ fontSize: 13, color: 'var(--tenue)' }}>
                    {p.categoria_memoria ?? '—'}
                  </td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {p.fecha_inicio
                      ? fechaCorta(p.fecha_inicio)
                      : <span className="tenue" title="La memoria documenta solo el año">
                          sin fecha exacta
                        </span>}
                  </td>
                  <td className="numeral" style={{ textAlign: 'right' }}>
                    {p.horas_extension || '—'}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {p.informes > 0
                      ? `${p.informes}${p.ultimo_informe ? ` — ${fechaCorta(p.ultimo_informe)}` : ''}`
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

function Filtro({
  etiqueta, valor, onChange, opciones, ancho = 150,
}: {
  etiqueta: string; valor: string; onChange: (v: string) => void
  opciones: [string, string][]; ancho?: number
}) {
  const id = `f-${etiqueta.toLowerCase()}`
  return (
    <div className="field" style={{ width: ancho }}>
      <label htmlFor={id}>{etiqueta}</label>
      <select id={id} className="input input-linea" value={valor}
              onChange={(e) => onChange(e.target.value)}>
        <option value={TODOS}>Todos</option>
        {opciones.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </select>
    </div>
  )
}
