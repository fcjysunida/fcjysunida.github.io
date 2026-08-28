import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { crearActividad } from '../data/panel'
import type { BorradorActividad, Enlaces } from '../data/panel'
import type { Campo, TipoCampo } from '../lib/tipos'
import {
  TIPOS_CAMPO, TIPOS_ACTIVIDAD, MODALIDADES, PORTADAS,
  camposHabituales, conOpciones, nuevoId, etiquetaCampo,
} from '../lib/campos'
import { basePublica, RETENCION_MESES, LEY } from '../lib/institucion'
import { diaLargo, hoyAsuncion } from '../lib/formato'
import { usePermisos } from '../lib/sesion'
import { Aviso } from '../ui/piezas'

export default function Constructor() {
  const permisos = usePermisos()
  const [b, setB] = useState<BorradorActividad>({
    titulo: '', tipo: 'extension', modalidad: 'presencial',
    inicio: hoyAsuncion(), dias: 1, cupo: 0, lugar: '', descripcion: '',
    portada: 'juridico', portadaCredito: PORTADAS[0]!.credito,
    campos: camposHabituales(), horas: 4,
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [creada, setCreada] = useState<Enlaces | null>(null)

  const set = <K extends keyof BorradorActividad>(k: K, v: BorradorActividad[K]) => {
    setB((s) => ({ ...s, [k]: v })); setError('')
  }
  const setCampos = (fn: (cs: Campo[]) => Campo[]) => setB((s) => ({ ...s, campos: fn(s.campos) }))

  const resumen = useMemo(() => {
    const o = b.campos.filter((c) => c.obligatorio).length
    const s = b.campos.filter((c) => c.sensible).length
    const f = b.campos.filter((c) => c.cifrado && !c.sensible).length
    return `${b.campos.length} campos · ${o} obligatorios · ${f} cifrados · ${s} con datos sensibles`
  }, [b.campos])

  const sinMapaObligatorio = !b.campos.some((c) => c.mapa === 'nombre')
    || !b.campos.some((c) => c.mapa === 'cedula')

  async function publicar() {
    setError('')
    if (b.titulo.trim() === '') { setError('La actividad necesita un título.'); return }
    if (sinMapaObligatorio) {
      setError('El formulario debe conservar un campo asociado a «nombre» y otro a «cédula»: son los que permiten identificar la inscripción y validar la asistencia.')
      return
    }
    setGuardando(true)
    try {
      setCreada(await crearActividad(b))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  if (!permisos.creaActividad) {
    return <p className="tenue">Su rol no crea actividades. Consulte con la Coordinación de Extensión.</p>
  }

  if (creada) return <Publicada enlaces={creada} alReiniciar={() => setCreada(null)} />

  return (
    <div>
      <div className="eyebrow">Constructor de formularios</div>
      <h1 style={{ fontSize: 38, lineHeight: 1.12, marginTop: 8, maxWidth: '30ch' }}>
        Nueva actividad y su formulario de inscripción
      </h1>
      <p style={{ maxWidth: '66ch', color: 'var(--tenue-2)', margin: '14px 0 0' }}>
        Los campos se agregan, ordenan y tipifican libremente. Cada campo declara si es
        obligatorio, si se guarda cifrado y si contiene datos sensibles en el sentido del
        artículo 3.° numeral 7 de la {LEY}, lo que activa el consentimiento expreso separado
        y el borrado anticipado.
      </p>
      <hr className="rule-strong" style={{ margin: '30px 0' }} />

      <div className="fc-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div className="field">
            <label htmlFor="titulo">Título de la actividad</label>
            <input id="titulo" className="input input-linea"
                   style={{ fontFamily: 'var(--serif)', fontSize: 20, minHeight: 44 }}
                   value={b.titulo} onChange={(e) => set('titulo', e.target.value)}
                   placeholder="Taller de seguridad digital" />
          </div>

          <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <label htmlFor="tipo">Tipo de actividad</label>
              <select id="tipo" className="input" value={b.tipo}
                      onChange={(e) => set('tipo', e.target.value as BorradorActividad['tipo'])}>
                {TIPOS_ACTIVIDAD.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="modalidad">Modalidad</label>
              <select id="modalidad" className="input" value={b.modalidad}
                      onChange={(e) => set('modalidad', e.target.value as BorradorActividad['modalidad'])}>
                {MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="field">
              <label htmlFor="inicio">Fecha de inicio</label>
              <input id="inicio" className="input" type="date" value={b.inicio}
                     onChange={(e) => set('inicio', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dias">Jornadas</label>
              <input id="dias" className="input" type="number" min={1} max={10} value={b.dias}
                     onChange={(e) => set('dias', Math.min(10, Math.max(1, Number(e.target.value) || 1)))} />
            </div>
            <div className="field">
              <label htmlFor="cupo">Cupo</label>
              <input id="cupo" className="input" type="number" min={0} value={b.cupo}
                     onChange={(e) => set('cupo', Math.max(0, Number(e.target.value) || 0))} />
              <span className="ayuda">0 = sin límite</span>
            </div>
            <div className="field">
              <label htmlFor="horas">Horas académicas</label>
              <input id="horas" className="input" type="number" min={0} step={0.5} value={b.horas}
                     onChange={(e) => set('horas', Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="lugar">Sede o enlace de la actividad</label>
            <input id="lugar" className="input" value={b.lugar}
                   onChange={(e) => set('lugar', e.target.value)}
                   placeholder="Aula Magna FCJYS UNIDA — Asunción" />
          </div>

          <div className="field">
            <label htmlFor="desc">Presentación pública</label>
            <textarea id="desc" className="input" value={b.descripcion}
                      onChange={(e) => set('descripcion', e.target.value)}
                      placeholder="Objetivo, destinatarios y certificación de la actividad." />
          </div>

          {/* ── Campos ─────────────────────────────────────────────────── */}
          <div>
            <hr className="rule" style={{ marginBottom: 20 }} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                          gap: 16, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 24 }}>Campos del formulario</h2>
              <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>{resumen}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
              {b.campos.map((c, i) => (
                <FilaCampo key={c.id} campo={c} indice={i} total={b.campos.length}
                           setCampos={setCampos} />
              ))}
            </div>

            <hr className="rule" />
            <AgregarCampo setCampos={setCampos}
                          restaurar={() => setCampos(() => camposHabituales())} />
          </div>

          {/* ── Portada ────────────────────────────────────────────────── */}
          <div>
            <hr className="rule" style={{ marginBottom: 20 }} />
            <h2 style={{ fontSize: 24 }}>Portada</h2>
            <p style={{ fontSize: 14, color: 'var(--tenue-2)', margin: '8px 0 16px' }}>
              Imágenes de repositorios libres, en blanco y negro por norma de identidad.
            </p>
            <div style={{ display: 'grid', gap: 14,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              {PORTADAS.map((p) => {
                const elegida = b.portada === p.id
                return (
                  <button key={p.id} type="button" aria-pressed={elegida}
                          onClick={() => setB((s) => ({ ...s, portada: p.id, portadaCredito: p.credito }))}
                          style={{ border: 0, padding: 0, cursor: 'pointer', textAlign: 'left',
                                   background: 'transparent', display: 'flex',
                                   flexDirection: 'column', gap: 8, opacity: elegida ? 1 : 0.72 }}>
                    <span style={{ display: 'block', width: '100%', height: 92, overflow: 'hidden',
                                   background: 'var(--md-surface-c-highest)',
                                   outline: elegida ? '2px solid var(--rojo)' : '1px solid var(--regla)',
                                   outlineOffset: 2 }}>
                      <img src={p.url} alt="" className="grayscale"
                           style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{p.label}</span>
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--tenue)', marginTop: 10 }}>{b.portadaCredito}</div>
          </div>
        </div>

        {/* ── Columna lateral ──────────────────────────────────────────── */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 28,
                        position: 'sticky', top: 24 }}>
          <div>
            <div className="eyebrow">Al publicar se genera</div>
            <ul style={{ margin: '12px 0 0', paddingLeft: 20, fontSize: 14, lineHeight: 1.65,
                         color: 'var(--tenue-2)' }}>
              <li>Un enlace de inscripción <code>{basePublica()}/f/…</code></li>
              <li>Un enlace único de asistencia <code>{basePublica()}/a/…</code>, válido todas las jornadas</li>
              <li>
                {b.dias === 1 ? 'Un código de sala' : `${b.dias} códigos de sala, uno por jornada`}
                , que rotan al regenerar el enlace
              </li>
              <li>
                {b.dias === 1
                  ? `Una jornada: ${diaLargo(b.inicio)}`
                  : `Jornadas del ${diaLargo(b.inicio)} en adelante`}
              </li>
            </ul>
          </div>

          <hr className="rule" />

          <div>
            <div className="eyebrow">Cumplimiento — {LEY}</div>
            <ul style={{ margin: '12px 0 0', paddingLeft: 20, fontSize: 14, lineHeight: 1.65,
                         color: 'var(--tenue-2)' }}>
              <li>Base legal declarada: consentimiento del titular, artículo 5.° numeral 1.</li>
              <li>Información previa completa al titular, artículo 27.</li>
              <li>Consentimiento expreso y separado para los campos sensibles, artículo 20 numeral 1.</li>
              <li>Conservación limitada: {RETENCION_MESES} meses, artículo 4.° inciso e).</li>
              <li>Revocación y derechos atendidos en 30 días corridos, artículos 6.° y 26.</li>
            </ul>
            {b.campos.some((c) => c.sensible) && (
              <p style={{ fontSize: 13, color: 'var(--rojo-oscuro)', marginTop: 12 }}>
                Este formulario incluye campos sensibles: antes de difundirlo corresponde
                completar la evaluación de impacto del artículo 14.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-primary btn-block" style={{ minHeight: 44 }}
                    onClick={() => void publicar()} disabled={guardando}>
              {guardando ? 'Publicando…' : 'Publicar el formulario'}
            </button>
            <Aviso>{error}</Aviso>
          </div>
        </aside>
      </div>
    </div>
  )
}

function FilaCampo({
  campo, indice, total, setCampos,
}: {
  campo: Campo; indice: number; total: number
  setCampos: (fn: (cs: Campo[]) => Campo[]) => void
}) {
  const cambiar = (parche: Partial<Campo>) =>
    setCampos((cs) => cs.map((x, i) => (i === indice ? { ...x, ...parche } : x)))
  const mover = (d: -1 | 1) =>
    setCampos((cs) => {
      const j = indice + d
      if (j < 0 || j >= cs.length) return cs
      const n = cs.slice()
      ;[n[indice], n[j]] = [n[j]!, n[indice]!]
      return n
    })

  return (
    <div style={{ borderTop: '1px solid var(--md-outline-variant)', padding: '18px 0 20px',
                  display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--md-outline)',
                       minWidth: 26, paddingTop: 26 }}>{indice + 1}</span>
        <div style={{ flex: 1, minWidth: 260, display: 'grid', gap: 14,
                      gridTemplateColumns: '1.5fr 1fr' }}>
          <div className="field">
            <label htmlFor={`et-${campo.id}`}>Pregunta</label>
            <input id={`et-${campo.id}`} className="input" value={campo.etiqueta}
                   onChange={(e) => cambiar({ etiqueta: e.target.value })}
                   placeholder="Escriba la pregunta" />
          </div>
          <div className="field">
            <label htmlFor={`ti-${campo.id}`}>Tipo de campo</label>
            <select id={`ti-${campo.id}`} className="input" value={campo.tipo}
                    onChange={(e) => {
                      const t = e.target.value as TipoCampo
                      cambiar({
                        tipo: t,
                        cifrado: t === 'cedula' ? true : campo.cifrado,
                        opciones: conOpciones(t) && (campo.opciones ?? []).length === 0
                          ? ['Primera opción', 'Segunda opción'] : campo.opciones,
                      })
                    }}>
              {TIPOS_CAMPO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, paddingTop: 22, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} title="Subir"
                  disabled={indice === 0} onClick={() => mover(-1)}>↑</button>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} title="Bajar"
                  disabled={indice === total - 1} onClick={() => mover(1)}>↓</button>
          <button className="btn btn-ghost" style={{ fontSize: 13 }}
                  onClick={() => setCampos((cs) => [
                    ...cs.slice(0, indice + 1),
                    { ...cs[indice]!, id: nuevoId(), mapa: '' },
                    ...cs.slice(indice + 1),
                  ])}>Duplicar</button>
          <button className="btn btn-ghost" style={{ fontSize: 13 }}
                  onClick={() => setCampos((cs) => cs.filter((_, i) => i !== indice))}>Quitar</button>
        </div>
      </div>

      <div style={{ paddingLeft: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="field">
          <label htmlFor={`ay-${campo.id}`}>Texto de ayuda</label>
          <input id={`ay-${campo.id}`} className="input" value={campo.ayuda ?? ''}
                 onChange={(e) => cambiar({ ayuda: e.target.value })}
                 placeholder="Aclaración que verá la persona (opcional)" />
        </div>

        {conOpciones(campo.tipo) && (
          <div className="field">
            <label htmlFor={`op-${campo.id}`}>Opciones, una por línea</label>
            <textarea id={`op-${campo.id}`} className="input" style={{ minHeight: 74 }}
                      value={(campo.opciones ?? []).join('\n')}
                      onChange={(e) => cambiar({
                        opciones: e.target.value.split('\n').map((t) => t.trim()).filter(Boolean),
                      })} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          <Marca marcada={!!campo.obligatorio} onChange={(v) => cambiar({ obligatorio: v })}
                 texto="Obligatorio" />
          <Marca marcada={!!campo.cifrado} onChange={(v) => cambiar({ cifrado: v })}
                 texto="Identificador — se guarda cifrado" />
          <Marca marcada={!!campo.sensible}
                 onChange={(v) => cambiar({ sensible: v, cifrado: v ? true : campo.cifrado })}
                 texto="Dato sensible — consentimiento expreso y borrado anticipado" />
        </div>

        {campo.mapa ? (
          <span className="ayuda">
            Alimenta el campo «{campo.mapa}» de la inscripción y, con él, los indicadores del
            informe. Quitarlo o cambiarle el tipo afecta las estadísticas.
          </span>
        ) : (
          <span className="ayuda">
            Campo libre de tipo {etiquetaCampo(campo.tipo).toLowerCase()}: la respuesta se guarda
            junto a la inscripción y no alimenta ningún indicador.
          </span>
        )}
      </div>
    </div>
  )
}

function Marca({
  marcada, onChange, texto,
}: { marcada: boolean; onChange: (v: boolean) => void; texto: string }) {
  return (
    <label style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
      <input type="checkbox" checked={marcada} onChange={(e) => onChange(e.target.checked)} />
      <span>{texto}</span>
    </label>
  )
}

function AgregarCampo({
  setCampos, restaurar,
}: { setCampos: (fn: (cs: Campo[]) => Campo[]) => void; restaurar: () => void }) {
  const [tipo, setTipo] = useState<TipoCampo>('texto')
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
                  paddingTop: 18 }}>
      <div className="field" style={{ minWidth: 220 }}>
        <label htmlFor="nuevo-tipo">Agregar un campo</label>
        <select id="nuevo-tipo" className="input" value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoCampo)}>
          {TIPOS_CAMPO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      <button className="btn btn-secondary" onClick={() => setCampos((cs) => [...cs, {
        id: nuevoId(), tipo, etiqueta: '', ayuda: '', obligatorio: false,
        cifrado: tipo === 'cedula', sensible: false, mapa: '',
        opciones: conOpciones(tipo) ? ['Primera opción', 'Segunda opción'] : [],
      }])}>
        Agregar campo
      </button>
      <button className="btn btn-ghost" onClick={restaurar}>Restaurar el conjunto habitual</button>
    </div>
  )
}

function Publicada({ enlaces, alReiniciar }: { enlaces: Enlaces; alReiniciar: () => void }) {
  const base = basePublica()
  const [copiado, setCopiado] = useState('')
  const copiar = (t: string, cual: string) => {
    void navigator.clipboard?.writeText(t)
    setCopiado(cual)
    window.setTimeout(() => setCopiado(''), 1800)
  }
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="eyebrow">Formulario publicado</div>
      <h1 style={{ fontSize: 34, lineHeight: 1.12, marginTop: 8 }}>{enlaces.titulo}</h1>
      <hr className="rule-strong" style={{ margin: '28px 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <Enlace rotulo="Enlace de inscripción — se difunde a los participantes"
                url={`${base}/f/${enlaces.token_formulario}`}
                copiado={copiado === 'f'} onCopiar={() => copiar(`${base}/f/${enlaces.token_formulario}`, 'f')} />
        <Enlace rotulo="Enlace único de asistencia — válido todas las jornadas"
                url={`${base}/a/${enlaces.token_asistencia}`}
                copiado={copiado === 'a'} onCopiar={() => copiar(`${base}/a/${enlaces.token_asistencia}`, 'a')} />

        <div>
          <hr className="rule" style={{ marginBottom: 18 }} />
          <div className="eyebrow">Códigos de sala</div>
          <p style={{ fontSize: 14, color: 'var(--tenue-2)', margin: '8px 0 14px' }}>
            El enlace de asistencia es siempre el mismo; lo que cambia cada día es el código,
            que anuncia el docente al abrir la jornada.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28 }}>
            {enlaces.jornadas.map((j) => (
              <div key={j.numero}>
                <div style={{ fontSize: 13, color: 'var(--tenue)' }}>
                  Jornada {j.numero} — {diaLargo(j.fecha)}
                </div>
                <div className="numeral" style={{ fontFamily: 'var(--serif)', fontSize: 40,
                                                  lineHeight: 1.1, letterSpacing: '0.06em',
                                                  color: 'var(--rojo-oscuro)' }}>
                  {j.codigo}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to={`/f/${enlaces.token_formulario}`}>
            Ver el formulario público
          </Link>
          <Link className="btn btn-secondary" to={`/admin/asistencia?a=${enlaces.id}`}>
            Ir a la asistencia
          </Link>
          <button className="btn btn-ghost" onClick={alReiniciar}>Crear otra actividad</button>
        </div>
      </div>
    </div>
  )
}

function Enlace({
  rotulo, url, copiado, onCopiar,
}: { rotulo: string; url: string; copiado: boolean; onCopiar: () => void }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--tenue)' }}>{rotulo}</div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 19, wordBreak: 'break-all' }}>{url}</div>
        <button className="btn btn-ghost" onClick={onCopiar}>
          {copiado ? 'Enlace copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
