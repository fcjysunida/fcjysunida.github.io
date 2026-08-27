import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  asistenciaContexto, registrarAsistencia, evaluacionPendiente, evaluarActividad,
} from '../data/publico'
import type { RespuestasEncuesta } from '../data/publico'
import { diaLargo } from '../lib/formato'
import { CORREO } from '../lib/institucion'
import { Escala, Cargando, Aviso } from '../ui/piezas'
import Marco from './Marco'

type Ctx = { titulo: string; hay_jornada: boolean; jornada: number | null; fecha: string | null }

export default function CheckIn() {
  const { token = '' } = useParams()
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [fallo, setFallo] = useState('')
  const [cedula, setCedula] = useState('')
  const [codigo, setCodigo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [registrado, setRegistrado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [encuesta, setEncuesta] = useState<{ pendiente: boolean; ultima: boolean } | null>(null)

  useEffect(() => {
    asistenciaContexto(token)
      .then((c) => (c.error ? setFallo('no_encontrada') : setCtx(c)))
      .catch(() => setFallo('red'))
  }, [token])

  async function registrar() {
    setError(''); setMensaje(''); setEnviando(true)
    try {
      const r = await registrarAsistencia(token, cedula, codigo)
      if (!r.ok) { setError(r.error ?? 'No se pudo registrar la asistencia.'); return }
      setMensaje(r.mensaje ?? 'Asistencia registrada.')
      setRegistrado(true)
      const e = await evaluacionPendiente(token, cedula)
      setEncuesta({ pendiente: e.pendiente, ultima: e.ultima_jornada })
      setCodigo('')
    } catch {
      setError('No pudimos comunicarnos con el servidor. Vuelva a intentar.')
    } finally {
      setEnviando(false)
    }
  }

  if (fallo === 'no_encontrada') {
    return (
      <Marco ancho={520}>
        <div className="tarjeta" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 25 }}>El enlace no es válido</h1>
          <p className="tenue" style={{ marginTop: 12 }}>
            Puede haber sido regenerado. Pida el enlace vigente al docente responsable o
            escriba a <a href={`mailto:${CORREO}`}>{CORREO}</a>.
          </p>
        </div>
      </Marco>
    )
  }
  if (fallo === 'red') return <Marco ancho={520}><Cargando texto="No pudimos cargar la actividad" /></Marco>
  if (!ctx) return <Marco ancho={520}><Cargando /></Marco>

  return (
    <Marco ancho={520}>
      <div className="tarjeta" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <div className="eyebrow">Registro de asistencia</div>
          <h1 style={{ fontSize: 27, lineHeight: 1.18, marginTop: 6 }}>{ctx.titulo}</h1>
          <div style={{ fontSize: 14, color: 'rgba(32,30,29,0.65)', marginTop: 6 }}>
            {ctx.hay_jornada && ctx.fecha
              ? `Jornada ${ctx.jornada} — ${diaLargo(ctx.fecha)}`
              : 'Hoy no hay jornada activa para esta actividad.'}
          </div>
        </div>

        {!ctx.hay_jornada ? (
          <p className="tenue" style={{ margin: 0 }}>
            El enlace resuelve automáticamente la jornada del día. Vuelva a abrirlo en la
            fecha de la próxima jornada.
          </p>
        ) : registrado ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 20, margin: 0 }}>{mensaje}</p>
            {encuesta?.pendiente ? (
              <Encuesta token={token} cedula={cedula} ultima={encuesta.ultima}
                        alTerminar={() => setEncuesta({ pendiente: false, ultima: encuesta.ultima })} />
            ) : (
              <button className="btn btn-secondary" onClick={() => {
                setRegistrado(false); setCedula(''); setMensaje(''); setEncuesta(null)
              }}>
                Registrar a otra persona
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="ci">Cédula de identidad</label>
              <input id="ci" className="input" style={{ minHeight: 46 }} inputMode="numeric"
                     autoComplete="off" value={cedula}
                     onChange={(e) => { setCedula(e.target.value); setError('') }} />
            </div>
            <div className="field">
              <label htmlFor="cod">Código de sala de esta jornada</label>
              <input id="cod" className="input" inputMode="numeric" maxLength={4} autoComplete="off"
                     style={{ minHeight: 52, letterSpacing: '0.3em',
                              fontFamily: 'var(--serif)', fontSize: 24 }}
                     value={codigo}
                     onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '')); setError('') }} />
              <span className="ayuda">
                Lo anuncia el docente responsable al abrir la jornada. Cambia cada día.
              </span>
            </div>
            <button className="btn btn-primary" style={{ minHeight: 50 }}
                    onClick={() => void registrar()}
                    disabled={enviando || cedula.trim() === '' || codigo.length < 4}>
              {enviando ? 'Registrando…' : 'Registrar asistencia'}
            </button>
            <Aviso>{error}</Aviso>
          </>
        )}

        <p style={{ fontSize: 13, color: 'var(--tenue)', borderTop: '1px solid var(--regla)',
                    paddingTop: 14, margin: 0 }}>
          Solo se verifica la cédula contra la lista de inscriptos. No se registra dirección IP,
          ubicación ni identificación del dispositivo; únicamente la fecha y la hora del registro.
        </p>
      </div>
    </Marco>
  )
}

// ── Encuesta de satisfacción ───────────────────────────────────────────────────
// Instrumento según ISO 10004:2018 y requisito 9.1.2 de ISO 9001:2015:
// seis dimensiones en escala Likert de cinco puntos, CSAT sobre la valoración
// general y NPS de cero a diez. Voluntaria, anónima en el informe, una sola vez.

const DIMENSIONES: { clave: keyof RespuestasEncuesta; rotulo: string }[] = [
  { clave: 'contenido',     rotulo: 'Pertinencia y calidad del contenido' },
  { clave: 'expositor',     rotulo: 'Desempeño de quien expuso' },
  { clave: 'organizacion',  rotulo: 'Organización y cumplimiento de los horarios' },
  { clave: 'recursos',      rotulo: 'Materiales, recursos y ambiente' },
  { clave: 'aplicabilidad', rotulo: 'Utilidad y aplicabilidad de lo aprendido' },
  { clave: 'global',        rotulo: 'Satisfacción general con la actividad' },
]

function Encuesta({
  token, cedula, ultima, alTerminar,
}: { token: string; cedula: string; ultima: boolean; alTerminar: () => void }) {
  const [v, setV] = useState<Partial<RespuestasEncuesta>>({})
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [gracias, setGracias] = useState('')

  const completa = DIMENSIONES.every((d) => typeof v[d.clave] === 'number')
    && typeof v.recomendacion === 'number'

  async function enviar() {
    setError(''); setEnviando(true)
    try {
      const r = await evaluarActividad(token, cedula, {
        ...(v as RespuestasEncuesta), comentario: comentario.trim() || undefined,
      })
      if (!r.ok) { setError(r.error ?? 'No se pudo registrar la evaluación.'); return }
      setGracias(r.mensaje ?? 'Gracias por su evaluación.')
    } catch {
      setError('No pudimos comunicarnos con el servidor. Vuelva a intentar.')
    } finally {
      setEnviando(false)
    }
  }

  if (gracias) {
    return (
      <div style={{ borderTop: '2px solid var(--regla-fuerte)', paddingTop: 20 }}>
        <p style={{ fontFamily: 'var(--serif)', fontSize: 19, margin: 0 }}>{gracias}</p>
        <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={alTerminar}>
          Cerrar
        </button>
      </div>
    )
  }

  return (
    <div style={{ borderTop: '2px solid var(--regla-fuerte)', paddingTop: 22,
                  display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="eyebrow">Evaluación de la actividad</div>
        <h2 style={{ fontSize: 22, marginTop: 6 }}>
          {ultima ? '¿Cómo resultó la actividad?' : '¿Cómo viene resultando la actividad?'}
        </h2>
        <p className="tenue" style={{ fontSize: 14, margin: '8px 0 0' }}>
          Es voluntaria, lleva menos de un minuto y se responde una sola vez. Los resultados
          se procesan de forma agregada: en el informe no consta quién respondió qué.
        </p>
      </div>

      {DIMENSIONES.map((d) => (
        <div key={d.clave} className="field">
          <span id={`e-${d.clave}`} style={{ display: 'block', fontSize: 14, marginBottom: 2 }}>
            {d.rotulo}
          </span>
          <Escala id={`e-${d.clave}`} valor={(v[d.clave] as number) ?? null}
                  rotulos={['Muy insatisfecho', 'Muy satisfecho']}
                  onChange={(n) => { setV((s) => ({ ...s, [d.clave]: n })); setError('') }} />
        </div>
      ))}

      <div className="field">
        <span id="e-nps" style={{ display: 'block', fontSize: 14, marginBottom: 2 }}>
          ¿Qué tan probable es que recomiende esta actividad a un colega o compañero?
        </span>
        <Escala id="e-nps" desde={0} hasta={10} valor={v.recomendacion ?? null}
                rotulos={['Nada probable', 'Muy probable']}
                onChange={(n) => { setV((s) => ({ ...s, recomendacion: n })); setError('') }} />
      </div>

      <div className="field">
        <label htmlFor="e-com">¿Qué mejoraría? (opcional)</label>
        <textarea id="e-com" className="input" style={{ minHeight: 80 }} maxLength={800}
                  value={comentario} onChange={(e) => setComentario(e.target.value)} />
      </div>

      <button className="btn btn-primary" style={{ minHeight: 48 }}
              onClick={() => void enviar()} disabled={!completa || enviando}>
        {enviando ? 'Enviando…' : 'Enviar la evaluación'}
      </button>
      <Aviso>{error}</Aviso>
      <button className="btn btn-ghost" onClick={alTerminar}>
        Prefiero no responder
      </button>
    </div>
  )
}
