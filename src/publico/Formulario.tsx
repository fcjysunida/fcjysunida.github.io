import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { actividadPorToken, inscribir } from '../data/publico'
import type { Consentimientos } from '../data/publico'
import type { ActividadPublica, Campo } from '../lib/tipos'
import { conOpciones, etiquetaTipo, etiquetaModalidad, portadaDe, tipoHtml } from '../lib/campos'
import { rango } from '../lib/formato'
import { CORREO, FACULTAD, RESPONSABLE, AUTORIDAD } from '../lib/institucion'
import { Plegado, Escala, Cargando, Aviso } from '../ui/piezas'
import Marco from './Marco'

export default function Formulario() {
  const { token = '' } = useParams()
  const [act, setAct] = useState<ActividadPublica | null>(null)
  const [fallo, setFallo] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [consents, setConsents] = useState<Consentimientos>({
    tratamiento: false, sensible: false, imagen: false, comunicaciones: false,
  })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [hecho, setHecho] = useState<{ estado: string; version: string; sello: string } | null>(null)

  useEffect(() => {
    actividadPorToken(token)
      .then((a) => (a.error ? setFallo('no_encontrada') : setAct(a)))
      .catch(() => setFallo('red'))
  }, [token])

  const sensibles = useMemo(
    () => (act?.campos ?? []).filter((c) => c.sensible),
    [act],
  )
  const hayDatoSensibleCargado = sensibles.some((c) => (valores[c.id] ?? '').trim() !== '')

  const poner = (id: string, v: string) => {
    setValores((s) => ({ ...s, [id]: v }))
    setError('')
  }

  async function enviar() {
    if (!act) return
    setError('')
    const faltan = act.campos.filter((c) => c.obligatorio && !(valores[c.id] ?? '').trim())
    if (faltan.length > 0) {
      setError(`Complete los campos obligatorios: ${faltan.map((c) => c.etiqueta).join(', ')}.`)
      return
    }
    if (!consents.tratamiento) {
      setError('Sin el consentimiento para el tratamiento de datos no es posible registrar la inscripción.')
      return
    }
    if (hayDatoSensibleCargado && !consents.sensible) {
      setError('Declaró un dato sensible: marque también el consentimiento expreso para ese campo o deje el campo vacío.')
      return
    }
    setEnviando(true)
    try {
      // El uso de imagen está comprendido en el consentimiento general (v1.0),
      // pero se guarda por separado para poder revocarlo sin tocar la inscripción.
      const r = await inscribir(token, valores, { ...consents, imagen: consents.tratamiento })
      if (!r.ok) { setError(r.error ?? 'No se pudo registrar la inscripción.'); return }
      setHecho({
        estado: r.estado ?? 'confirmada',
        version: r.consentimiento_version ?? '1.0',
        sello: new Date(r.consentido_en ?? Date.now()).toLocaleString('es-PY', {
          day: '2-digit', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: 'America/Asuncion',
        }),
      })
    } catch {
      setError('No pudimos comunicarnos con el servidor. Vuelva a intentar en unos instantes.')
    } finally {
      setEnviando(false)
    }
  }

  if (fallo === 'no_encontrada') {
    return (
      <Marco>
        <div className="tarjeta" style={{ padding: '34px 32px' }}>
          <h1 style={{ fontSize: 26 }}>Este formulario no está disponible</h1>
          <p className="tenue" style={{ marginTop: 12 }}>
            El enlace puede haber sido regenerado o la inscripción ya fue cerrada.
            Consulte a la Coordinación de Extensión en <a href={`mailto:${CORREO}`}>{CORREO}</a>.
          </p>
        </div>
      </Marco>
    )
  }
  if (fallo === 'red') return <Marco><Cargando texto="No pudimos cargar la actividad. Reintente" /></Marco>
  if (!act) return <Marco><Cargando /></Marco>

  const portada = act.portada?.startsWith('http') ? act.portada : portadaDe(act.portada).url
  const credito = act.portada_credito ?? portadaDe(act.portada).credito
  const cerrada = act.estado !== 'publicada'
  const sinCupo = act.cupo > 0 && act.lugares_libres === 0

  return (
    <Marco credito={credito}>
      <div className="tarjeta">
        <div style={{ height: 190, overflow: 'hidden', background: 'var(--md-surface-c-highest)' }}>
          <img src={portada} alt="" className="grayscale"
               style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ padding: '34px 32px 38px' }}>
          <div className="eyebrow">{etiquetaTipo(act.tipo)}</div>
          <h1 className="tipo-display" style={{ marginTop: 8 }}>{act.titulo}</h1>
          {act.descripcion && (
            <p style={{ color: 'var(--tenue-2)', margin: '16px 0 0' }}>{act.descripcion}</p>
          )}
          <div style={{ marginTop: 20, fontSize: 14, display: 'flex', flexDirection: 'column',
                        gap: 4, color: 'var(--tenue-2)' }}>
            <span>{rango(act.fecha_inicio, act.dias)}</span>
            <span>{etiquetaModalidad(act.modalidad)}{act.lugar ? ` — ${act.lugar}` : ''}</span>
            {act.cupo > 0 && !hecho && (
              <span className="tenue">
                {sinCupo
                  ? 'Cupo completo: las nuevas inscripciones quedan en lista de espera.'
                  : `${act.lugares_libres} lugares disponibles de ${act.cupo}.`}
              </span>
            )}
          </div>

          <hr className="rule" style={{ margin: '28px 0' }} />

          {hecho ? (
            <div>
              <h2 style={{ fontSize: 26 }}>
                {hecho.estado === 'en_espera'
                  ? 'Quedó en lista de espera'
                  : 'Su inscripción quedó registrada'}
              </h2>
              <p style={{ color: 'var(--tenue-2)' }}>
                {hecho.estado === 'en_espera'
                  ? 'El cupo está completo. Le avisaremos al correo declarado si se libera un lugar.'
                  : 'Recibirá la confirmación en el correo declarado. El enlace de asistencia se remite veinticuatro horas antes del inicio; el código de sala se anuncia al comenzar cada jornada.'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--tenue)' }}>
                Constancia de consentimiento {hecho.version}, registrada el {hecho.sello}.
              </p>
              <button className="btn btn-secondary" onClick={() => {
                setHecho(null); setValores({})
                setConsents({ tratamiento: false, sensible: false, imagen: false, comunicaciones: false })
              }}>
                Registrar otra persona
              </button>
            </div>
          ) : cerrada ? (
            <p style={{ color: 'var(--rojo-oscuro)' }}>
              La inscripción a esta actividad ya fue cerrada.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {act.campos.map((c) => (
                <CampoPublico key={c.id} campo={c} valor={valores[c.id] ?? ''}
                              onChange={(v) => poner(c.id, v)} />
              ))}

              <div style={{ borderTop: '2px solid var(--regla-fuerte)', paddingTop: 22 }}>
                <h2 className="tipo-titulo">Consentimiento informado</h2>
                <p style={{ fontSize: 14, color: 'var(--tenue-2)', margin: '12px 0 0' }}>
                  {FACULTAD}, con domicilio en Asunción. Responsable del tratamiento:{' '}
                  {RESPONSABLE} — <a href={`mailto:${CORREO}`}>{CORREO}</a>.
                </p>

                <div style={{ marginTop: 14 }}>
                  <Plegado resumen="Leer el aviso completo" cerrar="Ocultar el aviso">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12,
                                  fontSize: 14, color: 'var(--tenue-2)' }}>
                      {act.consentimiento.aviso.map((a) => (
                        <div key={a.rotulo} className="aviso-fila"
                             style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 14 }}>
                          <span className="tenue">{a.rotulo}</span>
                          <span>{a.texto}</span>
                        </div>
                      ))}
                    </div>
                  </Plegado>
                </div>

                <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Casilla
                    marcada={consents.tratamiento}
                    onChange={(v) => { setConsents((s) => ({ ...s, tratamiento: v })); setError('') }}
                    texto={act.consentimiento.tratamiento}
                    marca="(obligatorio)"
                  />
                  {sensibles.length > 0 && (
                    <Casilla
                      marcada={consents.sensible}
                      onChange={(v) => { setConsents((s) => ({ ...s, sensible: v })); setError('') }}
                      texto={act.consentimiento.sensibles}
                      marca={hayDatoSensibleCargado
                        ? '(necesario: usted declaró un dato sensible)'
                        : '(solo si completa ese campo)'}
                    />
                  )}
                  <Casilla
                    marcada={consents.comunicaciones}
                    onChange={(v) => setConsents((s) => ({ ...s, comunicaciones: v }))}
                    texto={act.consentimiento.comunicaciones}
                    marca="(opcional)"
                  />
                </div>

                <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', margin: '18px 0 0' }}>
                  Puede revocar el consentimiento en cualquier momento y ejercer los derechos de
                  acceso, rectificación, oposición, supresión y portabilidad escribiendo a{' '}
                  <a href={`mailto:${CORREO}`}>{CORREO}</a> o desde <a href="/derechos">/derechos</a>.
                  La solicitud se atiende en un plazo máximo de treinta días corridos. También
                  puede reclamar ante la {AUTORIDAD}.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button className="btn btn-primary" style={{ minHeight: 50 }}
                        onClick={() => void enviar()} disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Enviar la inscripción'}
                </button>
                <Aviso>{error}</Aviso>
              </div>
            </div>
          )}
        </div>
      </div>
    </Marco>
  )
}

function Casilla({
  marcada, onChange, texto, marca,
}: { marcada: boolean; onChange: (v: boolean) => void; texto: string; marca: string }) {
  return (
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
      <input type="checkbox" style={{ marginTop: 3, flex: 'none' }}
             checked={marcada} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ fontSize: 14 }}>
        {texto}{' '}
        <span style={{ fontStyle: 'italic', color: 'var(--tenue)' }}>{marca}</span>
      </span>
    </label>
  )
}

function CampoPublico({
  campo, valor, onChange,
}: { campo: Campo; valor: string; onChange: (v: string) => void }) {
  const etiqueta = `${campo.etiqueta || 'Pregunta sin título'}${campo.obligatorio ? ' *' : ''}`
  const idAyuda = `${campo.id}-ayuda`
  const opciones = campo.opciones ?? []

  const control = () => {
    if (campo.tipo === 'parrafo') {
      return <textarea id={campo.id} className="input" style={{ minHeight: 88 }}
                       value={valor} aria-describedby={campo.ayuda ? idAyuda : undefined}
                       onChange={(e) => onChange(e.target.value)} />
    }
    if (campo.tipo === 'lista') {
      return (
        <select id={campo.id} className="input" style={{ minHeight: 46 }} value={valor}
                aria-describedby={campo.ayuda ? idAyuda : undefined}
                onChange={(e) => onChange(e.target.value)}>
          <option value="">Seleccione una opción</option>
          {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    if (campo.tipo === 'unica') {
      return (
        <div role="radiogroup" aria-labelledby={`${campo.id}-rot`}
             style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {opciones.map((o) => (
            <label key={o} style={{ display: 'flex', gap: 10, alignItems: 'center',
                                    minHeight: 44, cursor: 'pointer' }}>
              <input type="radio" name={campo.id} checked={valor === o}
                     onChange={() => onChange(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )
    }
    if (campo.tipo === 'casillas') {
      const marcadas = valor ? valor.split(' | ') : []
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {opciones.map((o) => (
            <label key={o} style={{ display: 'flex', gap: 10, alignItems: 'center',
                                    minHeight: 44, cursor: 'pointer' }}>
              <input type="checkbox" checked={marcadas.includes(o)}
                     onChange={() => onChange(
                       (marcadas.includes(o)
                         ? marcadas.filter((x) => x !== o)
                         : [...marcadas, o]).join(' | '),
                     )} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )
    }
    if (campo.tipo === 'escala') {
      return <Escala id={`${campo.id}-rot`} valor={valor ? Number(valor) : null}
                     onChange={(n) => onChange(String(n))} />
    }
    if (campo.tipo === 'archivo') {
      return <input id={campo.id} className="input" type="file"
                    style={{ minHeight: 46, paddingTop: 10 }}
                    onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')} />
    }
    return <input id={campo.id} className="input" style={{ minHeight: 46 }}
                  type={tipoHtml(campo.tipo)} value={valor}
                  inputMode={campo.tipo === 'cedula' ? 'numeric' : undefined}
                  autoComplete={campo.mapa === 'nombre' ? 'name'
                              : campo.mapa === 'email' ? 'email'
                              : campo.mapa === 'telefono' ? 'tel' : 'off'}
                  aria-describedby={campo.ayuda ? idAyuda : undefined}
                  onChange={(e) => onChange(e.target.value)} />
  }

  const conRadios = campo.tipo === 'unica' || campo.tipo === 'escala'
  return (
    <div className="field">
      {conRadios
        ? <span id={`${campo.id}-rot`} style={{ display: 'block', fontSize: 12, marginBottom: 5,
                                                color: 'var(--md-on-surface-variant)' }}>{etiqueta}</span>
        : <label htmlFor={campo.id}>{etiqueta}</label>}
      {control()}
      {campo.ayuda && <span id={idAyuda} className="ayuda">{campo.ayuda}</span>}
      {campo.sensible && (
        <span className="ayuda" style={{ color: 'var(--rojo-oscuro)' }}>
          Dato sensible ({conOpciones(campo.tipo) ? 'opción' : 'campo'} voluntario):
          se guarda cifrado y requiere el consentimiento expreso de más abajo.
        </span>
      )}
    </div>
  )
}
