import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  traerProyecto, guardarProyecto, participantesDe,
  informesDe, guardarInforme, horasSugeridas, listarPeriodos, listarActividades,
  redactarInforme, participantesDesdeActividad, agregarParticipantes,
  verificarParticipantes, desgloseDe, buscarPadron, quitarParticipante,
} from '../data/panel'
import type { Desglose, ResultadoPadron, FilaParticipante } from '../data/panel'
import type {
  Proyecto as TProyecto, Propuesta, ParticipanteProyecto, InformeProyecto,
  PeriodoAcademico, Actividad, ClasificacionProyecto, EstadoProyecto,
} from '../lib/tipos'
import {
  CLASIFICACIONES, ESTADOS_PROYECTO, RUBROS, FUENTES, CREDITOS, DESTINATARIOS,
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

      {pest === 'participantes' && <Participantes proyecto={p} />}
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

function Participantes({ proyecto }: { proyecto: TProyecto }) {
  const [filas, setFilas] = useState<ParticipanteProyecto[] | null>(null)
  const [desglose, setDesglose] = useState<Desglose | null>(null)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const cargar = () => {
    participantesDe(proyecto.id).then(setFilas).catch((e: Error) => setError(e.message))
    desgloseDe(proyecto.id).then(setDesglose).catch(() => setDesglose(null))
  }
  useEffect(cargar, [proyecto.id])

  async function accion(fn: () => Promise<string>) {
    setError(''); setAviso(''); setTrabajando(true)
    try { setAviso(await fn()); cargar() }
    catch (e) { setError((e as Error).message) } finally { setTrabajando(false) }
  }

  if (!filas) return <Cargando />

  const periodoTexto = proyecto.fecha_inicio
    ? `la fecha del proyecto (${fechaCorta(proyecto.fecha_inicio)})`
    : proyecto.anio ? `el año ${proyecto.anio}` : 'el período del proyecto'

  return (
    <div style={{ maxWidth: 1000 }}>
      <Bloque titulo="Participación"
              nota={<>La condición de cada persona se verifica contra el padrón académico
                    vigente en {periodoTexto}, no contra el de hoy: quien en 2022 era
                    estudiante y hoy es egresado figura como estudiante en el informe de 2022.</>}>
        {desglose && desglose.total > 0 && (
          <div className="fc-grid" style={{ margin: '4px 0 26px' }}>
            <Cifra label="Participantes" valor={desglose.total}
                   nota={`${desglose.asistieron} con participación registrada`} />
            <Cifra label="Estudiantes" valor={desglose.estudiantes}
                   nota="matriculados en el período" />
            <Cifra label="Egresados" valor={desglose.egresados} nota="ya egresados entonces" />
            <Cifra label="Externos" valor={desglose.externos}
                   nota={desglose.docentes > 0 ? `${desglose.docentes} docentes aparte` : 'sin registro académico'} />
          </div>
        )}
        {desglose && desglose.sin_verificar > 0 && (
          <p className="ayuda" style={{ color: 'var(--rojo-oscuro)', marginBottom: 16 }}>
            {desglose.sin_verificar} sin verificar contra el padrón. Si son de un período
            cuya nómina todavía no se importó, vuelva a verificar después de cargarla.
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
          {proyecto.actividad_id && (
            <>
              <button className="btn btn-secondary" disabled={trabajando}
                      onClick={() => void accion(async () => {
                        const r = await participantesDesdeActividad(proyecto.id, true)
                        return `${r.agregados} traídos de la actividad; ${r.ya_estaban} ya estaban.`
                      })}>
                Traer a quienes asistieron
              </button>
              <button className="btn btn-ghost" disabled={trabajando}
                      onClick={() => void accion(async () => {
                        const r = await participantesDesdeActividad(proyecto.id, false)
                        return `${r.agregados} traídos (incluye inscriptos sin asistencia).`
                      })}>
                Traer también a los inscriptos sin asistencia
              </button>
            </>
          )}
          <button className="btn btn-ghost" disabled={trabajando}
                  onClick={() => void accion(async () => {
                    const r = await verificarParticipantes(proyecto.id)
                    return `${r.revisados} revisados, ${r.reclasificados} reclasificados.`
                  })}>
            Volver a verificar contra el padrón
          </button>
        </div>
        <Aviso>{error}</Aviso>
        <Aviso tono="nota">{aviso}</Aviso>

        {filas.length === 0 ? (
          <p className="tenue">
            Todavía no hay participantes.
            {proyecto.actividad_id
              ? ' Tráigalos de la actividad vinculada, búsquelos en el padrón o cargue una nómina.'
              : ' Búsquelos en el padrón o cargue una nómina.'}
          </p>
        ) : (
          <div className="fc-scroll">
            <table className="table" style={{ minWidth: 940 }}>
              <thead>
                <tr>
                  <th>Nombre</th><th>Condición</th><th>Matrícula</th><th>Carrera</th>
                  <th>Organización</th><th>Origen</th><th />
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td className="obra">
                      {f.nombre}
                      {f.cedula_mascara && (
                        <span className="tenue numeral" style={{ fontSize: 11, display: 'block' }}>
                          {f.cedula_mascara}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }} title={f.condicion_origen ?? undefined}>
                      {f.condicion ? CONDICIONES[f.condicion] : '—'}
                      {f.periodo_verificado && (
                        <span className="tenue" style={{ fontSize: 11, display: 'block' }}>
                          {f.periodo_verificado}
                        </span>
                      )}
                    </td>
                    <td className="numeral" style={{ fontSize: 13 }}>{f.matricula ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{f.carrera ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{f.organizacion ?? f.catedra ?? '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--tenue)' }}>{f.fuente}</td>
                    <td>
                      <button className="btn btn-ghost" style={{ fontSize: 13 }}
                              onClick={() => void accion(async () => {
                                await quitarParticipante(f.id)
                                return 'Participante quitado.'
                              })}>Quitar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloque>

      <BuscadorPadron proyecto={proyecto} alAgregar={cargar} />
      <CargaNomina proyecto={proyecto} alAgregar={cargar} />
    </div>
  )
}

const CONDICIONES: Record<string, string> = {
  estudiante: 'Estudiante', docente: 'Docente', egresado: 'Egresado', externo: 'Externo',
}

function Cifra({ label, valor, nota }: { label: string; valor: number; nota: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--tenue)' }}>{label}</div>
      <div className="numeral" style={{ fontFamily: 'var(--serif)', fontSize: 38,
                                        lineHeight: 1.05 }}>{valor}</div>
      <div style={{ fontSize: 13, color: 'rgba(32,30,29,0.55)' }}>{nota}</div>
    </div>
  )
}

/** Búsqueda en el registro académico para casos retrospectivos. */
function BuscadorPadron({
  proyecto, alAgregar,
}: { proyecto: TProyecto; alAgregar: () => void }) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<ResultadoPadron[]>([])
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState('')

  async function buscar() {
    if (q.trim().length < 3) { setAviso('Escriba al menos tres letras.'); return }
    setBuscando(true); setAviso('')
    try { setResultados(await buscarPadron(q)) }
    catch (e) { setAviso((e as Error).message) } finally { setBuscando(false) }
  }

  return (
    <Bloque titulo="Buscar en el registro académico"
            nota="Para proyectos anteriores al formulario de inscripción: se busca a la persona por nombre o matrícula y se la agrega con su condición del período correspondiente.">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ minWidth: 260 }}>
          <label htmlFor="bp">Nombre o matrícula</label>
          <input id="bp" className="input" value={q}
                 onChange={(e) => setQ(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') void buscar() }} />
        </div>
        <button className="btn btn-secondary" onClick={() => void buscar()} disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      <Aviso tono="nota">{aviso}</Aviso>

      {resultados.length > 0 && (
        <div className="fc-scroll" style={{ marginTop: 14 }}>
          <table className="table" style={{ minWidth: 700 }}>
            <thead>
              <tr><th>Nombre</th><th>Matrícula</th><th>Período</th><th>Condición</th>
                  <th>Carrera</th><th /></tr>
            </thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={`${r.cedula_hash}-${r.periodo}`}>
                  <td className="obra">{r.nombre}</td>
                  <td className="numeral" style={{ fontSize: 13 }}>{r.matricula ?? '—'}</td>
                  <td style={{ fontSize: 13 }}>{r.periodo}</td>
                  <td style={{ fontSize: 13 }}>
                    {r.condicion === 'estudiante' ? 'Estudiante' : 'Egresado'}
                  </td>
                  <td style={{ fontSize: 13 }}>{r.carrera ?? '—'}</td>
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 13 }}
                            onClick={() => {
                              void agregarParticipantes(proyecto.id, [{
                                nombre: r.nombre, cedula_hash: r.cedula_hash,
                                matricula: r.matricula ?? undefined,
                              }], 'padron')
                                .then(() => { setAviso(`${r.nombre} agregado.`); alAgregar() })
                                .catch((e: Error) => setAviso(e.message))
                            }}>Agregar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Bloque>
  )
}

/** Carga masiva de participantes desde una lista pegada. */
function CargaNomina({
  proyecto, alAgregar,
}: { proyecto: TProyecto; alAgregar: () => void }) {
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const filas = useMemo(() => leerNomina(texto), [texto])

  return (
    <Bloque titulo="Cargar una nómina"
            nota="Una persona por línea. Se admite «Nombre», «Nombre, cédula» o «Nombre, cédula, organización». Quien figure en el padrón se reconoce solo; el resto queda como externo.">
      <div className="field">
        <label htmlFor="nom">Lista de participantes</label>
        <textarea id="nom" className="input" style={{ minHeight: 120, fontFamily: 'monospace',
                                                      fontSize: 13 }}
                  value={texto} onChange={(e) => setTexto(e.target.value)}
                  placeholder={'Pérez, Juan, 1234567\nGonzález, Ana\nComisión vecinal — Rosa Díaz'} />
      </div>
      {filas.length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--tenue)' }}>
          {filas.length} personas reconocidas; {filas.filter((f) => f.cedula).length} con documento.
        </p>
      )}
      <button className="btn btn-primary" disabled={trabajando || filas.length === 0}
              onClick={() => {
                setTrabajando(true); setAviso('')
                void agregarParticipantes(proyecto.id, filas, 'nomina')
                  .then((r) => {
                    setAviso(`${r.agregados} agregados, ${r.ya_estaban} ya estaban, ` +
                             `${r.omitidos} omitidos.`)
                    setTexto(''); alAgregar()
                  })
                  .catch((e: Error) => setAviso(e.message))
                  .finally(() => setTrabajando(false))
              }}>
        {trabajando ? 'Cargando…' : `Agregar ${filas.length} participantes`}
      </button>
      <Aviso tono="nota">{aviso}</Aviso>
    </Bloque>
  )
}

/** «Apellido, Nombre, 1234567, Organización» en cualquier combinación. */
export function leerNomina(texto: string): FilaParticipante[] {
  return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((linea) => {
    const partes = linea.split(/\s*[;|\t]\s*|\s+—\s+/).map((p) => p.trim()).filter(Boolean)
    const campos = partes.length > 1 ? partes : linea.split(/\s*,\s*/).map((p) => p.trim())
    // Se toma como documento el campo que sea mayormente numérico y de 5 a 12 signos.
    const iDoc = campos.findIndex((c) => /^[0-9][0-9.\-]{4,13}$/.test(c))
    const doc = iDoc >= 0 ? campos[iDoc] : undefined
    const resto = campos.filter((_, i) => i !== iDoc)
    // Con «Apellido, Nombre» el nombre son los dos primeros campos.
    const nombre = resto.length >= 2 && resto[0]!.length < 40 && !/\d/.test(resto[1] ?? '')
      ? `${resto[0]}, ${resto[1]}` : (resto[0] ?? '')
    const organizacion = resto.length > 2 ? resto[resto.length - 1] : undefined
    return { nombre, cedula: doc, organizacion: organizacion === nombre ? undefined : organizacion }
  }).filter((f) => f.nombre.length > 2)
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
  const [error, setError] = useState('')
  const [sucio, setSucio] = useState(false)
  const [redactando, setRedactando] = useState(false)
  const [faltantes, setFaltantes] = useState<string[]>([])

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

  async function redactar() {
    if (i.resumen?.trim() || i.conclusiones?.trim()) {
      if (!window.confirm(
        'El borrador reemplaza el resumen, la metodología, las conclusiones y los tres ' +
        'cuadros de este informe.\n\n¿Continuar?')) return
    }
    setError(''); setAviso(''); setRedactando(true); setFaltantes([])
    try {
      const b = await redactarInforme(proyecto.id)
      setI((s) => ({
        ...s,
        resumen: b.resumen, metodologia: b.metodologia, conclusiones: b.conclusiones,
        informe: { ...s.informe, analisis: b.analisis, plan: b.plan, metas: b.metas },
      }))
      setFaltantes(b.faltantes ?? [])
      setSucio(true)
      setAviso('Borrador generado. Revíselo y corrija antes de guardar: es un punto de ' +
               'partida, no un informe terminado.')
    } catch (e) { setError((e as Error).message) } finally { setRedactando(false) }
  }

  const b = i.informe ?? {}

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 16, flexWrap: 'wrap', marginTop: 20 }}>
        <h2 style={{ fontSize: 25 }}>Informe de proyecto de extensión universitaria</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => void redactar()}
                  disabled={redactando}>
            {redactando ? 'Redactando…' : 'Redactar un borrador'}
          </button>
          <button className="btn btn-primary" onClick={() => void guardar()} disabled={!sucio}>
            Guardar
          </button>
          <button className="btn btn-secondary" onClick={alCerrar}>Volver</button>
        </div>
      </div>
      <p className="bloque-nota" style={{ maxWidth: '76ch', marginTop: 10 }}>
        La redacción asistida arma un borrador con la estructura del formato oficial a partir
        de la propuesta cargada y, si el proyecto está vinculado a una actividad, de las cifras
        reales de inscripción, asistencia y satisfacción. <strong>No inventa datos</strong>: lo
        que falta lo deja señalado. El informe lo firma el docente, así que revise todo antes
        de guardar.
      </p>
      <Aviso>{error}</Aviso>
      <Aviso tono="nota">{aviso}</Aviso>
      {faltantes.length > 0 && (
        <div style={{ borderLeft: '3px solid var(--rojo)', padding: '10px 0 10px 14px',
                      margin: '14px 0' }}>
          <strong style={{ fontSize: 14 }}>Datos que faltan y debe completar:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 14,
                       color: 'var(--tenue-2)' }}>
            {faltantes.map((f, n) => <li key={n}>{f}</li>)}
          </ul>
        </div>
      )}

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
