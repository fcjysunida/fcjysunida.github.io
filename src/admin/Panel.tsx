import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  listarActividades, periodos, extensionResumen, pasantiasResumen,
} from '../data/panel'
import type { ResumenExtension, ResumenPasantia } from '../data/panel'
import type { Actividad } from '../lib/tipos'
import { etiquetaTipo } from '../lib/campos'
import { rango, mesLargo, numero, hoyAsuncion } from '../lib/formato'
import { usePermisos } from '../lib/sesion'
import { Cargando, Dato, Aviso } from '../ui/piezas'
import { Barras, Serie, Anillo } from '../ui/graficos'

const ESTADOS: Record<string, string> = {
  borrador: 'Borrador', publicada: 'Publicada', cerrada: 'Cerrada', finalizada: 'Finalizada',
}

/** Accesos a lo que se hace todos los días, sin pasar por el menú. */
const ATAJOS: { a: string; label: string; nota: string }[] = [
  { a: '/admin/inscripciones', label: 'Inscripciones', nota: 'Ver y editar inscriptos' },
  { a: '/admin/asistencia',    label: 'Asistencia',    nota: 'Registrar por jornada' },
  { a: '/admin/certificados',  label: 'Constancias',   nota: 'Emitir e imprimir' },
  { a: '/admin/extension',     label: 'Horas',         nota: 'Cumplimiento por persona' },
  { a: '/admin/pasantias',     label: 'Pasantías',     nota: 'Seguimiento y plazos' },
  { a: '/admin/indicadores',   label: 'Estadísticas',  nota: 'Informe mensual DTC' },
]

export default function Panel() {
  const [acts, setActs] = useState<Actividad[] | null>(null)
  const [meses, setMeses] = useState<{ periodo: string; actividades: number; proyectos: number }[]>([])
  const [ext, setExt] = useState<ResumenExtension[]>([])
  const [pas, setPas] = useState<ResumenPasantia[]>([])
  const [error, setError] = useState('')
  const permisos = usePermisos()
  const ir = useNavigate()
  const periodo = hoyAsuncion().slice(0, 7)

  useEffect(() => {
    listarActividades().then(setActs).catch((e: Error) => setError(e.message))
    periodos().then(setMeses).catch(() => setMeses([]))
    extensionResumen().then(setExt).catch(() => setExt([]))
    pasantiasResumen().then(setPas).catch(() => setPas([]))
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

  /** Doce meses de proyectos y actividades, del más viejo al más nuevo. */
  const serie = useMemo(() => {
    const porAnio = new Map<string, number>()
    for (const m of meses) {
      const anio = m.periodo.slice(0, 4)
      porAnio.set(anio, (porAnio.get(anio) ?? 0) + m.proyectos + m.actividades)
    }
    return [...porAnio.entries()].sort()
      .map(([anio, n]) => ({ etiqueta: anio, valor: n }))
  }, [meses])

  const extension = useMemo(() => {
    const t = (c: string) => ext.filter((r) => r.condicion === c)
    const s = (rs: ResumenExtension[], f: (r: ResumenExtension) => number) =>
      rs.reduce((a, r) => a + Number(f(r)), 0)
    return {
      egresados: { total: s(t('egresado'), (r) => r.personas), cumplen: s(t('egresado'), (r) => r.cumplen) },
      estudiantes: { total: s(t('estudiante'), (r) => r.personas), cumplen: s(t('estudiante'), (r) => r.cumplen) },
      respaldadas: s(ext, (r) => r.horas_respaldadas),
      historicas: s(ext, (r) => r.horas_historicas),
    }
  }, [ext])

  const pasantias = useMemo(() => {
    const s = (f: (r: ResumenPasantia) => number) => pas.reduce((a, r) => a + Number(f(r)), 0)
    return { total: s((r) => r.personas), cumplen: s((r) => r.cumplen) }
  }, [pas])

  if (error) return <Aviso>{error}</Aviso>
  if (!acts) return <Cargando />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 24, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '46ch' }}>
          <div className="eyebrow">Coordinación de Extensión y Vinculación</div>
          <h1 style={{ fontSize: 42, lineHeight: 1.08, marginTop: 8, textTransform: 'capitalize' }}>
            {mesLargo(periodo)}
          </h1>
        </div>
        {permisos.creaActividad && (
          <button className="fab" onClick={() => ir('/admin/nueva')}>
            <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>+</span>
            Nueva actividad
          </button>
        )}
      </div>

      {/* ── Atajos ────────────────────────────────────────────────────── */}
      <nav aria-label="Accesos directos"
           style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '26px 0 34px' }}>
        {ATAJOS.map((x) => (
          <Link key={x.a} to={x.a} className="tarjeta"
                style={{ display: 'block', padding: '12px 18px', textDecoration: 'none',
                         color: 'var(--md-on-surface)', minWidth: 150 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>{x.label}</div>
            <div className="tenue" style={{ fontSize: 12.5 }}>{x.nota}</div>
          </Link>
        ))}
      </nav>

      {/* ── Cifras del mes ────────────────────────────────────────────── */}
      <div className="fc-grid" style={{ marginBottom: 30 }}>
        {kpis.map((k, i) => (
          <Dato key={k.label} label={k.label} valor={numero(k.value)} nota={k.note}
                tono={i === 0 ? 'primario' : 'neutro'} />
        ))}
      </div>

      {/* ── Visualizaciones ───────────────────────────────────────────── */}
      <div className="fc-2" style={{ marginBottom: 36 }}>
        <section className="tarjeta" style={{ padding: '22px 24px' }}>
          <h2 style={{ fontSize: 19 }}>Actividades y proyectos por año</h2>
          <p className="tenue" style={{ fontSize: 13.5, margin: '4px 0 18px' }}>
            Memorias institucionales, formatos oficiales y lo registrado en la plataforma.
          </p>
          {serie.length === 0
            ? <p className="tenue">Sin datos todavía.</p>
            : <Serie titulo="Actividades y proyectos por año" datos={serie} />}
        </section>

        <section className="tarjeta" style={{ padding: '22px 24px' }}>
          <h2 style={{ fontSize: 19 }}>Requisitos de egreso</h2>
          <p className="tenue" style={{ fontSize: 13.5, margin: '4px 0 18px' }}>
            Cuántas personas del padrón los tienen cumplidos.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Anillo titulo="Horas de extensión" valor={extension.egresados.cumplen + extension.estudiantes.cumplen}
                    total={extension.egresados.total + extension.estudiantes.total}
                    etiqueta="Meta de la carrera, respaldadas más históricas" />
            <Anillo titulo="Pasantía" valor={pasantias.cumplen} total={pasantias.total}
                    etiqueta="Aprobada o convalidada por egreso" />
          </div>
        </section>
      </div>

      <section className="tarjeta" style={{ padding: '22px 24px', marginBottom: 36 }}>
        <h2 style={{ fontSize: 19 }}>Origen de las horas de extensión</h2>
        <p className="tenue" style={{ fontSize: 13.5, margin: '4px 0 18px' }}>
          Las respaldadas tienen asistencia registrada o nómina de proyecto; las históricas
          se acreditaron a mano y no tienen respaldo en la plataforma.
        </p>
        <Barras titulo="Origen de las horas de extensión" unidad=" h" datos={[
          { etiqueta: 'Respaldadas por la plataforma', valor: Math.round(extension.respaldadas),
            detalle: 'Asistencia o nómina de proyecto' },
          { etiqueta: 'Acreditadas a mano', valor: Math.round(extension.historicas),
            detalle: 'Anteriores al sistema, con motivo asentado' },
        ]} />
      </section>

      {/* ── Actividades ───────────────────────────────────────────────── */}
      <h2 style={{ fontSize: 19, marginBottom: 12 }}>Actividades</h2>
      {acts.length === 0 ? (
        <p className="tenue">
          Todavía no hay actividades.{' '}
          {permisos.creaActividad
            ? <Link to="/admin/nueva">Cree la primera desde el constructor de formularios</Link>
            : 'La Coordinación de Extensión debe crear la primera.'}.
        </p>
      ) : (
        <div className="fc-scroll">
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
                  <td className="numeral" style={{ textAlign: 'right', color: 'var(--md-on-surface-variant)' }}>
                    {a.cupo || '—'}
                  </td>
                  <td className="numeral" style={{ textAlign: 'right' }}>{a.asistencias}</td>
                  <td>
                    <span className={a.estado === 'publicada' ? 'chip chip-ok' : 'chip'}>
                      {ESTADOS[a.estado] ?? a.estado}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
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
