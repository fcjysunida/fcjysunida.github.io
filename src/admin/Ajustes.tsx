import { useEffect, useState } from 'react'
import { estadoCorreo, leerConfiguracion, guardarConfiguracion } from '../data/panel'
import type { EstadoCorreo } from '../lib/tipos'
import { fechaHora, numero } from '../lib/formato'
import { CORREO, RESPONSABLE } from '../lib/institucion'
import { usePermisos } from '../lib/sesion'
import { Cargando, Aviso } from '../ui/piezas'

const CAMPOS: { clave: string; label: string; ayuda: string }[] = [
  { clave: 'correo_remitente', label: 'Dirección remitente',
    ayuda: 'Debe pertenecer a un dominio verificado en el proveedor, con SPF, DKIM y DMARC publicados. Si el dominio no está verificado, el envío se rechaza.' },
  { clave: 'correo_remitente_nombre', label: 'Nombre visible del remitente',
    ayuda: 'Lo que la persona ve en la bandeja de entrada.' },
  { clave: 'correo_responder_a', label: 'Responder a',
    ayuda: 'Dirección donde llegan las respuestas de los participantes.' },
  { clave: 'correo_tope_diario', label: 'Tope diario de envíos',
    ayuda: 'Límite del plan del proveedor. En el plan gratuito de Resend son 100 por día y 3.000 por mes.' },
  { clave: 'dominio_publico', label: 'Dominio público',
    ayuda: 'Base de los enlaces que se reparten en los correos y las constancias.' },
]

const PROVEEDORES: { id: string; label: string; secreto: string; modelo: string; nota: string }[] = [
  { id: 'google', label: 'Google — Gemini', secreto: 'GEMINI_API_KEY', modelo: 'gemini-3-pro',
    nota: 'Se factura con el saldo de Google AI Studio o de Google Cloud.' },
  { id: 'anthropic', label: 'Anthropic — Claude', secreto: 'ANTHROPIC_API_KEY',
    modelo: 'claude-opus-5',
    nota: 'Créditos de la consola de Anthropic. Se factura aparte del plan Max o Pro: la suscripción cubre claude.ai y Claude Code, no la API.' },
  { id: 'openai', label: 'OpenAI — GPT', secreto: 'OPENAI_API_KEY', modelo: 'gpt-5',
    nota: 'Créditos de la plataforma de OpenAI.' },
  { id: 'xai', label: 'xAI — Grok', secreto: 'XAI_API_KEY', modelo: 'grok-4',
    nota: 'Créditos de la consola de xAI. Usa la misma interfaz que OpenAI.' },
]

export default function Ajustes() {
  const permisos = usePermisos()
  const [cfg, setCfg] = useState<Record<string, string> | null>(null)
  const [cola, setCola] = useState<EstadoCorreo | null>(null)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  const cargar = () => {
    leerConfiguracion().then(setCfg).catch((e: Error) => setError(e.message))
    estadoCorreo().then(setCola).catch(() => setCola(null))
  }
  useEffect(cargar, [])

  async function guardar(clave: string, valor: string) {
    try {
      await guardarConfiguracion(clave, valor)
      setAviso('Guardado.')
      setCfg((c) => (c ? { ...c, [clave]: valor } : c))
    } catch (e) { setError((e as Error).message) }
  }

  if (error) return <Aviso>{error}</Aviso>
  if (!cfg) return <Cargando />

  const activo = cfg.correo_activo === 'true'

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="eyebrow">Ajustes</div>
      <h1 className="tipo-display" style={{ marginTop: 8 }}>Correo saliente</h1>
      <p className="entradilla">
        El sistema no envía en el momento: encola. Una tarea drena la cola cada quince minutos
        respetando el tope diario del proveedor, de modo que un congreso de trescientas personas
        no rompe nada ni se pierde ningún aviso.
      </p>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />
      <Aviso tono="nota">{aviso}</Aviso>

      {cola && (
        <div className="fc-grid" style={{ marginBottom: 34 }}>
          <Cifra label="En cola" valor={numero(cola.pendientes)}
                 nota={cola.proximo ? `próximo intento ${fechaHora(cola.proximo)}` : 'nada pendiente'} />
          <Cifra label="Enviados en 24 h" valor={numero(cola.enviados_24h)}
                 nota={`tope diario ${cfg.correo_tope_diario}`} />
          <Cifra label="Enviados en 30 días" valor={numero(cola.enviados_30d)}
                 nota="el plan gratuito admite 3.000 por mes" />
          <Cifra label="Fallidos" valor={numero(cola.fallidos)}
                 nota="tras cinco intentos con espera creciente" />
        </div>
      )}

      <div style={{ border: '1px solid var(--regla-fuerte)', padding: '18px 20px',
                    marginBottom: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: 16, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>
              El envío está {activo ? 'activo' : 'detenido'}
            </strong>
            <p className="ayuda" style={{ marginTop: 4 }}>
              {activo
                ? 'La cola se drena automáticamente cada quince minutos.'
                : 'Los correos se encolan pero no salen. Actívelo recién cuando el dominio esté verificado en el proveedor.'}
            </p>
          </div>
          {permisos.configura && (
            <button className={activo ? 'btn btn-secondary' : 'btn btn-primary'}
                    onClick={() => void guardar('correo_activo', activo ? 'false' : 'true')}>
              {activo ? 'Detener el envío' : 'Activar el envío'}
            </button>
          )}
        </div>
      </div>

      {CAMPOS.map((c) => (
        <CampoConfig key={c.clave} campo={c} valor={cfg[c.clave] ?? ''}
                     editable={permisos.configura} alGuardar={guardar} />
      ))}

      <hr className="rule-strong" style={{ margin: '36px 0 20px' }} />
      <SeccionIA cfg={cfg} editable={permisos.configura} alGuardar={guardar} />

      <hr className="rule-strong" style={{ margin: '36px 0 20px' }} />
      <h2 className="tipo-titulo">Puesta en marcha del correo</h2>
      <ol style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: 'var(--tenue-2)',
                   maxWidth: '76ch' }}>
        <li>
          Crear una cuenta gratuita en <strong>Resend</strong> (3.000 envíos por mes, 100 por
          día, sin marca del proveedor en el pie del mensaje).
        </li>
        <li>
          Agregar allí el dominio desde el que se enviará y publicar en el DNS los tres
          registros que genera: <strong>SPF</strong>, <strong>DKIM</strong> y{' '}
          <strong>DMARC</strong>. Sin eso, el correo institucional termina en la carpeta de
          no deseados.
        </li>
        <li>
          Cargar la clave del proveedor como secreto de la función de servidor:{' '}
          <code>supabase secrets set RESEND_API_KEY=…</code>
        </li>
        <li>
          Guardar la clave de servicio en la bóveda para que la tarea programada pueda
          invocar el envío: <code>npm run cli -- correo:habilitar</code>
        </li>
        <li>Ajustar arriba el remitente y activar el envío.</li>
      </ol>
      <p style={{ fontSize: 13, color: 'var(--tenue)', marginTop: 16, maxWidth: '76ch' }}>
        El dominio <code>unida.edu.py</code> lo administra la Universidad. Conviene pedir a
        Informática un subdominio propio —por ejemplo <code>extension.unida.edu.py</code>— y
        publicar los registros ahí: la reputación de envío queda aislada del correo
        institucional, y un problema de un lado no arrastra al otro. Las respuestas siguen
        llegando a {RESPONSABLE} en <a href={`mailto:${CORREO}`}>{CORREO}</a>.
      </p>
    </div>
  )
}

function Cifra({ label, valor, nota }: { label: string; valor: string; nota: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--tenue)' }}>{label}</div>
      <div className="numeral" style={{ fontFamily: 'var(--serif)', fontSize: 42,
                                        lineHeight: 1.05, marginTop: 2 }}>{valor}</div>
      <div style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>{nota}</div>
    </div>
  )
}

function CampoConfig({
  campo, valor, editable, alGuardar,
}: {
  campo: { clave: string; label: string; ayuda: string }
  valor: string
  editable: boolean
  alGuardar: (clave: string, valor: string) => Promise<void>
}) {
  const [v, setV] = useState(valor)
  useEffect(() => setV(valor), [valor])
  return (
    <div className="field" style={{ marginBottom: 18 }}>
      <label htmlFor={campo.clave}>{campo.label}</label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input id={campo.clave} className="input" style={{ maxWidth: 380 }} value={v}
               disabled={!editable} onChange={(e) => setV(e.target.value)} />
        {editable && v !== valor && (
          <button className="btn btn-secondary" onClick={() => void alGuardar(campo.clave, v)}>
            Guardar
          </button>
        )}
      </div>
      <span className="ayuda">{campo.ayuda}</span>
    </div>
  )
}

/** Elección del proveedor de la redacción asistida. */
function SeccionIA({
  cfg, editable, alGuardar,
}: {
  cfg: Record<string, string>
  editable: boolean
  alGuardar: (clave: string, valor: string) => Promise<void>
}) {
  const proveedor = cfg.ia_proveedor ?? 'google'
  const activa = cfg.ia_activa !== 'false'
  const elegido = PROVEEDORES.find((p) => p.id === proveedor) ?? PROVEEDORES[0]!
  const [modelo, setModelo] = useState(cfg.ia_modelo ?? elegido.modelo)
  useEffect(() => setModelo(cfg.ia_modelo ?? elegido.modelo), [cfg.ia_modelo, elegido.modelo])

  return (
    <>
      <h2 className="tipo-titulo">Redacción asistida de informes</h2>
      <p style={{ maxWidth: '74ch', color: 'var(--tenue-2)', margin: '10px 0 0' }}>
        El botón «Redactar un borrador» del editor de informes arma un texto con la estructura
        del formato oficial a partir de lo cargado del proyecto y de las cifras reales de
        participación. Elija con qué servicio: los cuatro reciben el mismo pedido y devuelven
        lo mismo, y cada uno se factura por su cuenta.
      </p>

      <div style={{ display: 'grid', gap: 16, marginTop: 20,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        {PROVEEDORES.map((p) => {
          const puesto = p.id === proveedor
          return (
            <button key={p.id} type="button" disabled={!editable}
                    onClick={() => void alGuardar('ia_proveedor', p.id)
                      .then(() => alGuardar('ia_modelo', p.modelo))}
                    style={{ textAlign: 'left', cursor: editable ? 'pointer' : 'default',
                             background: puesto ? 'var(--papel)' : 'transparent',
                             border: `1px solid ${puesto ? 'var(--rojo)' : 'var(--regla)'}`,
                             borderTopWidth: puesto ? 3 : 1, padding: '14px 16px' }}>
              <div className="tipo-titulo">
                {p.label}{puesto && <span style={{ color: 'var(--rojo)', fontSize: 13 }}> · en uso</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--tenue-2)', marginTop: 6 }}>{p.nota}</div>
              <div className="ayuda" style={{ marginTop: 8 }}>
                Clave: <code>{p.secreto}</code>
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end',
                    marginTop: 22 }}>
        <div className="field" style={{ minWidth: 240 }}>
          <label htmlFor="ia-modelo">Identificador del modelo</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input id="ia-modelo" className="input" style={{ maxWidth: 240 }} value={modelo}
                   disabled={!editable} onChange={(e) => setModelo(e.target.value)} />
            {editable && modelo !== (cfg.ia_modelo ?? '') && (
              <button className="btn btn-secondary"
                      onClick={() => void alGuardar('ia_modelo', modelo)}>Guardar</button>
            )}
          </div>
          <span className="ayuda">
            Sugerido para {elegido.label}: <code>{elegido.modelo}</code>. Los proveedores
            renuevan y retiran modelos: si deja de funcionar, verifique el identificador
            vigente en su documentación.
          </span>
        </div>
        {editable && (
          <button className={activa ? 'btn btn-secondary' : 'btn btn-primary'}
                  onClick={() => void alGuardar('ia_activa', activa ? 'false' : 'true')}>
            {activa ? 'Desactivar la redacción asistida' : 'Activar la redacción asistida'}
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, color: 'var(--tenue)', marginTop: 16, maxWidth: '76ch' }}>
        La clave nunca se guarda en la base ni viaja al navegador: va en los secretos de la
        función de servidor. Cárguela con{' '}
        <code>supabase secrets set {elegido.secreto}=…</code>. Cada borrador generado queda
        registrado con proveedor, modelo y tokens consumidos, para poder controlar el gasto.
      </p>
    </>
  )
}
