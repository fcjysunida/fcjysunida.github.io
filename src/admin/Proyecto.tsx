import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  traerProyecto, guardarProyecto, participantesDe, guardarParticipantes,
  informesDe, guardarInforme, horasSugeridas, listarPeriodos, listarActividades,
} from '../data/panel'
import type {
  Proyecto as TProyecto, Propuesta, ParticipanteProyecto, InformeProyecto,
  PeriodoAcademico, Actividad, ClasificacionProyecto, EstadoProyecto, TipoParticipante,
} from '../lib/tipos'
import {
  CLASIFICACIONES, ESTADOS_PROYECTO, TIPOS_PARTICIPANTE,
  RUBROS, FUENTES, CREDITOS, DESTINATARIOS, etiquetaTipoParticipante,
} from '../lib/proyecto'
import { fechaCorta, hoyAsuncion } from '../lib/formato'
import { Cargando, Aviso } from '../ui/piezas'
import { Bloque, Campo, Area, Lineas, Filas, Matriz, Casillas } from './piezas-proyecto'

type Pestana = 'propuesta' | 'participantes' | 'informes'

export default function Proyecto() {
  const { id = '' } = useParams()
  const [p, setP] = useState<TProyecto | null>(null)
  const [periodos, setPeriodos] = useState<PeriodoAcademico[]>([])
  const [acts, setActs] = useState<Actividad[]>([])
  const [pest, setPest] = useState<Pestana>('propuesta')
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [sucio, setSucio] = useState(false)

  useEffect(() => {
    traerProyecto(id).then(setP).catch((e: Error) => setError(e.message))
    listarPeriodos().then(setPeriodos).catch(() => setPeriodos([]))
    listarActividades().then(setActs).catch(() => setActs([]))
  }, [id])

  const set = <K extends keyof TProyecto>(k: K, v: TProyecto[K]) => {
    setP((s) => (s ? { ...s, [k]: v } : s)); setSucio(true); setAviso('')
  }
  const setProp = <K extends keyof Propuesta>(k: K, v: Propuesta[K]) => {
    setP((s) => (s ? { ...s, propuesta: { ...s.propuesta, [k]: v } } : s))
    setSucio(true); setAviso('')
  }

  async function guardar() {
    if (!p) return
    try {
      await guardarProyecto(p)
      setSucio(false); setAviso('Proyecto guardado.')
    } catch (e) { setError((e as Error).message) }
  }

  if (error) return <Aviso>{error}</Aviso>
  if (!p) return <Cargando />

  const prop = p.propuesta ?? {}
  const alcance = prop.alcance ?? {}

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 24, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '48ch' }}>
          <div className="eyebrow">
            <Link to="/admin/proyectos">Proyectos</Link> — propuesta e informe
          </div>
          <h1 style={{ fontSize: 32, lineHeight: 1.14, marginTop: 6 }}>{p.nombre}</h1>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {sucio && <span style={{ fontSize: 13, color: 'var(--rojo-oscuro)' }}>sin guardar</span>}
          <button className="btn btn-primary" onClick={() => void guardar()} disabled={!sucio}>
            Guardar
          </button>
        </div>
      </div>

      <div className="fc-tabs" style={{ marginTop: 20 }}>
        {([['propuesta', 'Propuesta'], ['participantes', 'Participantes'],
           ['informes', 'Informes']] as [Pestana, string][]).map(([k, r]) => (
          <button key={k} className="nav-tab" aria-current={pest === k ? 'page' : undefined}
                  onClick={() => setPest(k)}>{r}</button>
        ))}
      </div>
      <hr className="rule-strong" style={{ margin: '0 0 8px' }} />
      <Aviso tono="nota">{aviso}</Aviso>

      {pest === 'propuesta' && (
        <div style={{ maxWidth: 880 }}>
          <Bloque titulo="Identificación">
            <div className="field">
              <label htmlFor="pr-nombre">Nombre del proyecto</label>
              <input id="pr-nombre" className="input input-linea"
                     style={{ fontFamily: 'var(--serif)', fontSize: 20, minHeight: 42 }}
                     value={p.nombre} onChange={(e) => set('nombre', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
              <div className="field">
                <label htmlFor="pr-clas">Clasificación del proyecto</label>
                <select id="pr-clas" className="input" value={p.clasificacion}
                        onChange={(e) => set('clasificacion', e.target.value as ClasificacionProyecto)}>
                  {CLASIFICACIONES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="pr-estado">Estado</label>
                <select id="pr-estado" className="input" value={p.estado}
                        onChange={(e) => set('estado', e.target.value as EstadoProyecto)}>
                  {ESTADOS_PROYECTO.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
            {p.clasificacion === 'otros' && (
              <Campo etiqueta="Especifique la clasificación"
                     valor={p.clasificacion_otros ?? ''}
                     onChange={(v) => set('clasificacion_otros', v)} />
            )}
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
              <Campo etiqueta="Localización del proyecto" valor={p.localizacion ?? ''}
                     onChange={(v) => set('localizacion', v)} />
              <Campo etiqueta="Otras organizaciones involucradas"
                     valor={p.otras_organizaciones ?? ''} placeholder="N/A"
                     onChange={(v) => set('otras_organizaciones', v)} />
              <Campo etiqueta="Líder del proyecto" valor={p.lider ?? ''}
                     onChange={(v) => set('lider', v)} />
              <Campo etiqueta="Tutor/a (docente de la cátedra o coordinador)"
                     valor={p.tutor ?? ''} onChange={(v) => set('tutor', v)} />
              <Campo etiqueta="Carrera(s)" valor={p.carreras ?? ''}
                     onChange={(v) => set('carreras', v)} />
              <Campo etiqueta="Curso o cátedra" valor={p.curso ?? ''}
                     onChange={(v) => set('curso', v)} />
            </div>
            <Area etiqueta="Entregable final del proyecto" valor={p.entregable ?? ''}
                  onChange={(v) => set('entregable', v)} />
            <Campo etiqueta="Proyectos relacionados" valor={p.proyectos_relacionados ?? ''}
                   placeholder="N/A" onChange={(v) => set('proyectos_relacionados', v)} />

            <div style={{ display: 'grid', gap: 16,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          marginTop: 14 }}>
              <Campo etiqueta="Fecha estimada de inicio" tipo="date"
                     valor={p.fecha_inicio ?? ''} onChange={(v) => set('fecha_inicio', v)} />
              <Campo etiqueta="Fecha estimada de finalización" tipo="date"
                     valor={p.fecha_fin ?? ''} onChange={(v) => set('fecha_fin', v)} />
              <div className="field">
                <label htmlFor="pr-per">Período académico</label>
                <select id="pr-per" className="input" value={p.periodo_academico ?? ''}
                        onChange={(e) => set('periodo_academico', e.target.value || null)}>
                  <option value="">Sin asignar</option>
                  {periodos.map((x) => <option key={x.codigo} value={x.codigo}>{x.codigo}</option>)}
                </select>
              </div>
            </div>
            <HorasEU proyecto={p} set={set} />
          </Bloque>

          <Bloque titulo="Vínculo con la actividad"
                  nota="Si el proyecto tiene un formulario de inscripción y registro de asistencia en el sistema, vincúlelos: los beneficiarios y las horas se cruzan solos con las asistencias registradas.">
            <div className="field">
              <label htmlFor="pr-act">Actividad asociada</label>
              <select id="pr-act" className="input" value={p.actividad_id ?? ''}
                      onChange={(e) => set('actividad_id', e.target.value || null)}>
                <option value="">Sin actividad asociada</option>
                {acts.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}
              </select>
            </div>
          </Bloque>

          <Bloque titulo="Justificación y alcance">
            <Area etiqueta="Introducción" valor={prop.introduccion ?? ''}
                  onChange={(v) => setProp('introduccion', v)} alto={120} />
            <Area etiqueta="Justificación" valor={prop.justificacion ?? ''}
                  onChange={(v) => setProp('justificacion', v)} alto={120} />
            <Area etiqueta="Antecedentes" valor={alcance.antecedentes ?? ''}
                  onChange={(v) => setProp('alcance', { ...alcance, antecedentes: v })} />
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
              <Area etiqueta="Situación actual" valor={alcance.situacion_actual ?? ''}
                    onChange={(v) => setProp('alcance', { ...alcance, situacion_actual: v })} />
              <Area etiqueta="Situación deseada" valor={alcance.situacion_deseada ?? ''}
                    onChange={(v) => setProp('alcance', { ...alcance, situacion_deseada: v })} />
            </div>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
              <Area etiqueta="Población beneficiada — directos"
                    valor={alcance.poblacion_directa ?? ''}
                    onChange={(v) => setProp('alcance', { ...alcance, poblacion_directa: v })} />
              <Area etiqueta="Población beneficiada — indirectos"
                    valor={alcance.poblacion_indirecta ?? ''}
                    onChange={(v) => setProp('alcance', { ...alcance, poblacion_indirecta: v })} />
            </div>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
              <Campo etiqueta="Cantidad de beneficiarios directos" tipo="number"
                     valor={String(p.beneficiarios_directos)}
                     onChange={(v) => set('beneficiarios_directos', Number(v) || 0)} />
              <Campo etiqueta="Cantidad de beneficiarios indirectos" tipo="number"
                     valor={String(p.beneficiarios_indirectos)}
                     onChange={(v) => set('beneficiarios_indirectos', Number(v) || 0)} />
            </div>
            <Filas etiqueta="Resultados esperados y medios de verificación"
                   columnas={[['resultado', 'Resultado'], ['indicadores', 'Indicadores'],
                              ['verificacion', 'Medios de verificación']]}
                   valores={prop.resultados ?? []}
                   vacia={{ resultado: '', indicadores: '', verificacion: '' }}
                   onChange={(v) => setProp('resultados', v)} />
          </Bloque>

          <Bloque titulo="Objetivos y metas">
            <Area etiqueta="Objetivo general" valor={prop.objetivo_general ?? ''}
                  onChange={(v) => setProp('objetivo_general', v)} />
            <Lineas etiqueta="Objetivos específicos" valores={prop.objetivos_especificos ?? []}
                    onChange={(v) => setProp('objetivos_especificos', v)} />
            <Lineas etiqueta="Metas" valores={prop.metas ?? []}
                    onChange={(v) => setProp('metas', v)} />
          </Bloque>

          <Bloque titulo="Plan de trabajo y matriz de responsabilidades">
            <Area etiqueta="Metodología" valor={prop.metodologia ?? ''}
                  onChange={(v) => setProp('metodologia', v)} alto={120}
                  ayuda="Cómo se hará el trabajo, sus fases y procedimientos." />
            <Filas etiqueta="Actividades"
                   columnas={[['actividad', 'Actividad'], ['inicio', 'Inicio'],
                              ['fin', 'Finalización'], ['responsable', 'Responsable']]}
                   valores={prop.actividades ?? []}
                   vacia={{ actividad: '', inicio: '', fin: '', responsable: '' }}
                   onChange={(v) => setProp('actividades', v)} />
          </Bloque>

          <Bloque titulo="Presupuesto y fuente de financiación">
            <Matriz etiqueta="En guaraníes" nota="Solo los rubros que se destinarán al proyecto."
                    filas={RUBROS} columnas={FUENTES}
                    valores={prop.presupuesto ?? {}}
                    onChange={(v) => setProp('presupuesto', v)} />
          </Bloque>

          <Bloque titulo="Créditos académicos"
                  nota="Marque lo que se solicita a la Institución.">
            <Casillas etiqueta="" filas={CREDITOS} columnas={DESTINATARIOS}
                      valores={prop.creditos ?? {}}
                      onChange={(v) => setProp('creditos', v)} />
          </Bloque>

          <Bloque titulo="Anexos"
                  nota="Planillas, fotografías, planos, esquemas, notas de pedidos oficiales.">
            <Lineas etiqueta="Listado de anexos" valores={prop.anexos ?? []}
                    onChange={(v) => setProp('anexos', v)}
                    placeholder="Fotografías de la jornada" />
          </Bloque>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => void guardar()} disabled={!sucio}>
              Guardar
            </button>
            <span style={{ fontSize: 13, color: 'var(--tenue)', alignSelf: 'center' }}>
              La exportación en Word se hace con{' '}
              <code>npm run cli -- proyecto:exportar --id {p.id.slice(0, 8)}…</code>
            </span>
          </div>
        </div>
      )}

      {pest === 'participantes' && <Participantes proyectoId={id} />}
      {pest === 'informes' && <Informes proyecto={p} />}
    </div>
  )
}

function HorasEU({
  proyecto, set,
}: {
  proyecto: TProyecto
  set: <K extends keyof TProyecto>(k: K, v: TProyecto[K]) => void
}) {
  const [sug, setSug] = useState<{ horas: number; regla: string; max_total: number | null } | null>(null)

  useEffect(() => {
    horasSugeridas(proyecto.clasificacion, Number(proyecto.horas_reloj), 1)
      .then(setSug).catch(() => setSug(null))
  }, [proyecto.clasificacion, proyecto.horas_reloj])

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
      <Campo etiqueta="Tiempo total en horas reloj" tipo="number"
             valor={String(proyecto.horas_reloj)}
             onChange={(v) => set('horas_reloj', Number(v) || 0)} />
      <div className="field">
        <label htmlFor="pr-heu">Horas de extensión universitaria</label>
        <input id="pr-heu" className="input" type="number" step="0.5"
               value={proyecto.horas_extension}
               onChange={(e) => set('horas_extension', Number(e.target.value) || 0)} />
        {sug && (
          <span className="ayuda">
            Según el anexo: {sug.regla}. Sugerido para estas horas reloj:{' '}
            <strong>{sug.horas}</strong>
            {sug.max_total ? `, con un máximo de ${sug.max_total} por tipo de actividad` : ''}.{' '}
            {sug.horas !== Number(proyecto.horas_extension) && (
              <button className="btn btn-ghost" style={{ fontSize: 12 }}
                      onClick={() => set('horas_extension', sug.horas)}>usar {sug.horas}</button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

function Participantes({ proyectoId }: { proyectoId: string }) {
  const [filas, setFilas] = useState<ParticipanteProyecto[] | null>(null)
  const [aviso, setAviso] = useState('')
  const [sucio, setSucio] = useState(false)

  useEffect(() => {
    participantesDe(proyectoId).then(setFilas).catch(() => setFilas([]))
  }, [proyectoId])

  if (!filas) return <Cargando />

  const set = (i: number, parche: Partial<ParticipanteProyecto>) => {
    setFilas(filas.map((f, j) => (j === i ? { ...f, ...parche } : f))); setSucio(true)
  }

  async function guardar() {
    try {
      await guardarParticipantes(proyectoId, (filas ?? []).map((f, i) => ({
        proyecto_id: proyectoId, tipo: f.tipo, nombre: f.nombre,
        matricula: f.matricula, carrera: f.carrera, ciclo: f.ciclo,
        catedra: f.catedra, organizacion: f.organizacion, orden: i,
      })))
      setSucio(false); setAviso('Participantes guardados.')
    } catch (e) { setAviso((e as Error).message) }
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <Bloque titulo="Participantes del proyecto"
              nota="Docentes y cátedra, funcionarios de la UNIDA, personas de otras instituciones y estudiantes. Para los estudiantes, el formato oficial pide nombre, cédula, carrera, ciclo y matrícula.">
        <div className="fc-scroll">
          <table className="matriz" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 150 }}>Tipo</th>
                <th style={{ minWidth: 200 }}>Nombre y apellido</th>
                <th>Cátedra u organización</th>
                <th style={{ width: 120 }}>Carrera</th>
                <th style={{ width: 110 }}>Ciclo</th>
                <th style={{ width: 120 }}>Matrícula</th>
                <th style={{ width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i}>
                  <td>
                    <select value={f.tipo} aria-label="Tipo"
                            style={{ width: '100%', border: 0, background: 'transparent', font: 'inherit' }}
                            onChange={(e) => set(i, { tipo: e.target.value as TipoParticipante })}>
                      {TIPOS_PARTICIPANTE.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </td>
                  <td><input value={f.nombre} aria-label="Nombre"
                             onChange={(e) => set(i, { nombre: e.target.value })} /></td>
                  <td><input value={f.tipo === 'externo' ? (f.organizacion ?? '') : (f.catedra ?? '')}
                             aria-label="Cátedra u organización"
                             onChange={(e) => set(i, f.tipo === 'externo'
                               ? { organizacion: e.target.value } : { catedra: e.target.value })} /></td>
                  <td><input value={f.carrera ?? ''} aria-label="Carrera"
                             onChange={(e) => set(i, { carrera: e.target.value })} /></td>
                  <td><input value={f.ciclo ?? ''} aria-label="Ciclo"
                             onChange={(e) => set(i, { ciclo: e.target.value })} /></td>
                  <td><input value={f.matricula ?? ''} aria-label="Matrícula"
                             onChange={(e) => set(i, { matricula: e.target.value })} /></td>
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }}
                            onClick={() => { setFilas(filas.filter((_, j) => j !== i)); setSucio(true) }}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          {TIPOS_PARTICIPANTE.map((t) => (
            <button key={t.id} className="btn btn-secondary" style={{ fontSize: 13 }}
                    onClick={() => {
                      setFilas([...filas, {
                        id: '', proyecto_id: proyectoId, tipo: t.id, nombre: '',
                        cedula_mascara: null, matricula: null, carrera: null, ciclo: null,
                        catedra: null, organizacion: null, orden: filas.length,
                      }])
                      setSucio(true)
                    }}>
              + {etiquetaTipoParticipante(t.id)}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <button className="btn btn-primary" onClick={() => void guardar()} disabled={!sucio}>
            Guardar participantes
          </button>
        </div>
        <Aviso tono="nota">{aviso}</Aviso>
        <p className="ayuda" style={{ marginTop: 12 }}>
          La cédula de los estudiantes no se pide acá: si la persona se inscribió por el
          formulario, ya está cifrada en su inscripción, y la matrícula la completa el cruce
          con el padrón académico.
        </p>
      </Bloque>
    </div>
  )
}

function Informes({ proyecto }: { proyecto: TProyecto }) {
  const [filas, setFilas] = useState<InformeProyecto[] | null>(null)
  const [edit, setEdit] = useState<InformeProyecto | null>(null)

  const cargar = () => { informesDe(proyecto.id).then(setFilas).catch(() => setFilas([])) }
  useEffect(cargar, [proyecto.id])

  if (!filas) return <Cargando />

  if (edit) {
    return <EditorInforme informe={edit} proyecto={proyecto}
                          alCerrar={() => { setEdit(null); cargar() }} />
  }

  return (
    <div style={{ maxWidth: 880 }}>
      <Bloque titulo="Informes presentados"
              nota="Un proyecto puede tener un informe final o varios parciales. La estructura sigue el formato oficial 10.">
        {filas.length === 0 ? (
          <p className="tenue">Todavía no hay informes para este proyecto.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Fecha</th><th>Elaborado por</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {filas.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontSize: 13 }}>{fechaCorta(i.fecha_informe)}</td>
                  <td className="obra">{i.elaborado_por}</td>
                  <td style={{ fontSize: 13 }}>{i.estado}</td>
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 13 }}
                            onClick={() => setEdit(i)}>Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button className="btn btn-primary" style={{ marginTop: 16 }}
                onClick={() => setEdit({
                  id: '', proyecto_id: proyecto.id,
                  elaborado_por: proyecto.lider ?? '', aprobado_por: null,
                  fecha_informe: hoyAsuncion(), lugar_ejecucion: proyecto.localizacion,
                  beneficiarios: null, resumen: null, metodologia: null, conclusiones: null,
                  informe: {}, estado: 'borrador', creado_en: '',
                })}>
          Nuevo informe
        </button>
      </Bloque>
    </div>
  )
}

function EditorInforme({
  informe, proyecto, alCerrar,
}: { informe: InformeProyecto; proyecto: TProyecto; alCerrar: () => void }) {
  const [i, setI] = useState(informe)
  const [aviso, setAviso] = useState('')
  const [sucio, setSucio] = useState(false)

  const set = <K extends keyof InformeProyecto>(k: K, v: InformeProyecto[K]) => {
    setI((s) => ({ ...s, [k]: v })); setSucio(true)
  }
  const setB = <K extends keyof InformeProyecto['informe']>(
    k: K, v: InformeProyecto['informe'][K],
  ) => { setI((s) => ({ ...s, informe: { ...s.informe, [k]: v } })); setSucio(true) }

  async function guardar() {
    try {
      const { id, creado_en, ...resto } = i
      await guardarInforme(id ? { id, ...resto } : resto)
      setSucio(false); setAviso('Informe guardado.')
    } catch (e) { setAviso((e as Error).message) }
  }

  const b = i.informe ?? {}

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 16, flexWrap: 'wrap', marginTop: 20 }}>
        <h2 style={{ fontSize: 25 }}>Informe de proyecto de extensión universitaria</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => void guardar()} disabled={!sucio}>
            Guardar
          </button>
          <button className="btn btn-secondary" onClick={alCerrar}>Volver</button>
        </div>
      </div>
      <Aviso tono="nota">{aviso}</Aviso>

      <Bloque titulo="Datos informativos">
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
          <Campo etiqueta="Elaborado por" valor={i.elaborado_por}
                 onChange={(v) => set('elaborado_por', v)} />
          <Campo etiqueta="Aprobado por" valor={i.aprobado_por ?? ''}
                 onChange={(v) => set('aprobado_por', v)} />
          <Campo etiqueta="Fecha del informe" tipo="date" valor={i.fecha_informe}
                 onChange={(v) => set('fecha_informe', v)} />
          <Campo etiqueta="Lugar de ejecución" valor={i.lugar_ejecucion ?? ''}
                 onChange={(v) => set('lugar_ejecucion', v)} />
        </div>
        <Campo etiqueta="Beneficiarios" valor={i.beneficiarios ?? ''}
               onChange={(v) => set('beneficiarios', v)}
               ayuda={`Proyecto: ${proyecto.beneficiarios_directos} directos declarados.`} />
      </Bloque>

      <Bloque titulo="Resumen y metodología">
        <Area etiqueta="Resumen" valor={i.resumen ?? ''} alto={140}
              onChange={(v) => set('resumen', v)} />
        <Area etiqueta="Metodología" valor={i.metodologia ?? ''}
              onChange={(v) => set('metodologia', v)} />
      </Bloque>

      <Bloque titulo="Análisis"
              nota="Lo planteado en el proyecto frente a lo efectivamente alcanzado.">
        <Filas etiqueta=""
               columnas={[['fila', 'Concepto'], ['planteado', 'Planteado en el proyecto'],
                          ['alcanzado', 'Alcanzado']]}
               valores={b.analisis ?? []}
               vacia={{ fila: '', planteado: '', alcanzado: '' }}
               onChange={(v) => setB('analisis', v)} />
      </Bloque>

      <Bloque titulo="Plan de trabajo">
        <Filas etiqueta="Actividades realizadas"
               columnas={[['actividad', 'Actividad realizada'], ['responsables', 'Responsables'],
                          ['cronograma', 'Cronograma']]}
               valores={b.plan ?? []}
               vacia={{ actividad: '', responsables: '', cronograma: '' }}
               onChange={(v) => setB('plan', v)} />
        <Filas etiqueta="Metas, indicadores y recursos"
               columnas={[['meta', 'Meta'], ['indicadores', 'Indicadores'],
                          ['recursos', 'Recursos utilizados']]}
               valores={b.metas ?? []}
               vacia={{ meta: '', indicadores: '', recursos: '' }}
               onChange={(v) => setB('metas', v)} />
      </Bloque>

      <Bloque titulo="Conclusiones">
        <Area etiqueta="" valor={i.conclusiones ?? ''} alto={160}
              onChange={(v) => set('conclusiones', v)} />
      </Bloque>

      <Bloque titulo="Rendición de cuentas">
        <Matriz etiqueta="En guaraníes"
                nota="Solo los rubros y recursos que se utilizaron."
                filas={RUBROS} columnas={FUENTES}
                valores={b.rendicion ?? {}} onChange={(v) => setB('rendicion', v)} />
      </Bloque>

      <Bloque titulo="Anexos"
              nota="Fotografías, cuestionarios y demás medios de verificación.">
        <Lineas etiqueta="" valores={b.anexos ?? []} onChange={(v) => setB('anexos', v)} />
      </Bloque>

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button className="btn btn-primary" onClick={() => void guardar()} disabled={!sucio}>
          Guardar
        </button>
        <button className="btn btn-secondary" onClick={alCerrar}>Volver</button>
      </div>
    </div>
  )
}
