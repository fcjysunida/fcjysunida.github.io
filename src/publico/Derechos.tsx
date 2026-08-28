import { useState } from 'react'
import { solicitarDerecho } from '../data/publico'
import { CORREO, RESPONSABLE, AUTORIDAD } from '../lib/institucion'
import { Aviso } from '../ui/piezas'
import Marco from './Marco'

const TIPOS = [
  { id: 'acceso',        label: 'Acceso',        nota: 'Saber qué datos suyos trata la Facultad.' },
  { id: 'rectificacion', label: 'Rectificación', nota: 'Corregir un dato inexacto o incompleto.' },
  { id: 'oposicion',     label: 'Oposición',     nota: 'Oponerse al tratamiento. Cesa en diez días hábiles.' },
  { id: 'supresion',     label: 'Supresión',     nota: 'Pedir que se borren sus datos.' },
  { id: 'portabilidad',  label: 'Portabilidad',  nota: 'Recibir sus datos en un formato reutilizable.' },
  { id: 'revocacion',    label: 'Revocación',    nota: 'Retirar un consentimiento ya prestado, incluido el uso de imagen.' },
]

export default function Derechos() {
  const [tipo, setTipo] = useState('acceso')
  const [email, setEmail] = useState('')
  const [detalle, setDetalle] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [hecho, setHecho] = useState<string | null>(null)

  async function enviar() {
    setError(''); setEnviando(true)
    try {
      const r = await solicitarDerecho(tipo, email.trim(), detalle)
      if (!r.ok) { setError(r.error ?? 'No se pudo registrar la solicitud.'); return }
      setHecho(new Date(r.vence_en ?? Date.now()).toLocaleDateString('es-PY', {
        day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Asuncion',
      }))
    } catch {
      setError('No pudimos comunicarnos con el servidor. Vuelva a intentar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Marco ancho={640}>
      <div className="eyebrow">Derechos del titular — artículos 26 a 33</div>
      <h1 className="tipo-display" style={{ marginTop: 8 }}>
        Acceso, rectificación, oposición, supresión, portabilidad y revocación
      </h1>
      <p style={{ color: 'var(--tenue-2)', margin: '14px 0 0' }}>
        El trámite es gratuito y se atiende en un plazo máximo de treinta días corridos. La
        oposición al tratamiento se hace efectiva dentro de los diez días hábiles. Sin perjuicio
        de esta vía, puede reclamar ante la {AUTORIDAD} o escribir directamente a la{' '}
        {RESPONSABLE}: <a href={`mailto:${CORREO}`}>{CORREO}</a>.
      </p>
      <hr className="rule-strong" style={{ margin: '28px 0' }} />

      {hecho ? (
        <div className="tarjeta" style={{ padding: 28 }}>
          <h2 className="tipo-titulo">Su solicitud quedó registrada</h2>
          <p style={{ color: 'var(--tenue-2)', marginTop: 10 }}>
            Recibirá la respuesta en el correo declarado. El plazo máximo de atención vence
            el {hecho}. Si no obtiene respuesta puede reclamar ante la {AUTORIDAD}.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div className="field">
            <span id="rot-tipo" style={{ display: 'block', fontSize: 12, marginBottom: 8,
                                         color: 'var(--md-on-surface-variant)' }}>
              ¿Qué derecho desea ejercer?
            </span>
            <div role="radiogroup" aria-labelledby="rot-tipo"
                 style={{ display: 'flex', flexDirection: 'column' }}>
              {TIPOS.map((t) => (
                <label key={t.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
                                           padding: '12px 0', cursor: 'pointer',
                                           borderTop: '1px solid var(--regla)' }}>
                  <input type="radio" name="tipo" style={{ marginTop: 3, flex: 'none' }}
                         checked={tipo === t.id} onChange={() => setTipo(t.id)} />
                  <span>
                    <strong style={{ fontWeight: 600 }}>{t.label}</strong>
                    <span className="ayuda">{t.nota}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Correo electrónico con el que se inscribió *</label>
            <input id="email" className="input" type="email" autoComplete="email"
                   style={{ minHeight: 46 }} value={email}
                   onChange={(e) => { setEmail(e.target.value); setError('') }} />
            <span className="ayuda">
              Se usa únicamente para responderle y para localizar sus inscripciones.
            </span>
          </div>

          <div className="field">
            <label htmlFor="detalle">Detalle de la solicitud</label>
            <textarea id="detalle" className="input" style={{ minHeight: 100 }} maxLength={1500}
                      value={detalle} onChange={(e) => setDetalle(e.target.value)}
                      placeholder="Indique, si corresponde, la actividad y el dato al que se refiere." />
          </div>

          <button className="btn btn-primary" style={{ minHeight: 48 }}
                  onClick={() => void enviar()} disabled={enviando || email.trim() === ''}>
            {enviando ? 'Enviando…' : 'Enviar la solicitud'}
          </button>
          <Aviso>{error}</Aviso>
        </div>
      )}
    </Marco>
  )
}
