import { useEffect, useState } from 'react'
import { listarAuditoria, listarSolicitudes, aplicarRetencion } from '../data/panel'
import type { RegistroAuditoria } from '../lib/tipos'
import { fechaHora, fechaCorta } from '../lib/formato'
import { etiquetaRol } from '../lib/campos'
import { RETENCION_MESES, LEY, CORREO, RESPONSABLE, AUTORIDAD } from '../lib/institucion'
import { usePermisos } from '../lib/sesion'
import { Cargando, Aviso } from '../ui/piezas'

const CONTROLES = [
  { nivel: 'Consentimiento', titulo: 'Registro versionado',
    texto: 'Cada inscripción guarda el identificador de la versión del texto que la persona aceptó, con fecha y hora. Modificar el texto crea una versión nueva y no altera las anteriores; la Facultad conserva así la prueba del consentimiento que la ley le exige.' },
  { nivel: 'Consentimiento', titulo: 'Granular, expreso y revocable',
    texto: 'El consentimiento general reúne el tratamiento de la inscripción y el uso de imagen en la difusión institucional; los datos sensibles y las comunicaciones futuras van en casillas independientes. Ninguna viene premarcada, y el uso de imagen se registra en su propia columna para poder revocarlo sin tocar la inscripción.' },
  { nivel: 'Cifrado', titulo: 'Cédula, teléfono y datos sensibles',
    texto: 'Se guardan cifrados con una clave gestionada en Supabase Vault, que nunca aparece en el repositorio. Se descifran solo por funciones que verifican el rol y dejan constancia. El resto del sistema ve la cédula enmascarada.' },
  { nivel: 'Cifrado', titulo: 'Validación sin descifrado',
    texto: 'El registro de asistencia compara un HMAC de la cédula contra el guardado. Nunca se descifra nada para tomar asistencia, y una filtración de la base no revela cédulas sin la clave del Vault.' },
  { nivel: 'Acceso', titulo: 'Cinco roles con privilegio mínimo',
    texto: 'Dirección, Coordinación de Extensión, docente responsable, Secretaría y auditoría de lectura. El docente accede solo a sus actividades; la auditoría no exporta datos identificables. El control está en las políticas RLS de la base, no en la interfaz.' },
  { nivel: 'Acceso', titulo: 'Superficie pública acotada',
    texto: 'El navegador anónimo no tiene permiso sobre ninguna tabla. Solo puede invocar ocho funciones: leer el consentimiento vigente, leer una actividad por su token, inscribirse, consultar la jornada del día, registrar asistencia, saber si le corresponde evaluar, evaluar y solicitar el ejercicio de un derecho.' },
  { nivel: 'Retención', titulo: 'Borrado programado',
    texto: `Una tarea mensual anonimiza los datos identificables vencidos a los ${RETENCION_MESES} meses del cierre y elimina los sensibles, dejando únicamente el agregado que alimenta el informe de extensión.` },
  { nivel: 'Trazabilidad', titulo: 'Auditoría inalterable',
    texto: 'Toda lectura de cédula o de datos sensibles, edición, exportación con motivo declarado y regeneración de enlaces se asienta en una tabla protegida por disparadores que rechazan cualquier UPDATE o DELETE: no puede editarla ni borrarla nadie, tampoco la Dirección.' },
  { nivel: 'Integridad', titulo: 'Enlaces y códigos rotables',
    texto: 'El enlace de asistencia es único por actividad y el código de sala cambia por jornada. Regenerar el enlace invalida el anterior en el momento. El tanteo del código de cuatro dígitos se corta a los cinco intentos por cédula y jornada.' },
  { nivel: 'Minimización', titulo: 'Sin rastros del dispositivo',
    texto: 'El registro de asistencia guarda fecha y hora, nada más: ni dirección IP, ni ubicación, ni identificación del dispositivo. El límite de tasa se calcula sobre la actividad y el HMAC de la cédula, no sobre la red.' },
  { nivel: 'Calidad', titulo: 'Encuesta agregada',
    texto: 'La evaluación de satisfacción sigue la ISO 10004:2018 y el requisito 9.1.2 de la ISO 9001:2015. Se vincula a la inscripción solo para evitar respuestas duplicadas; el panel accede a promedios, CSAT y NPS, y a los comentarios sin identidad ni orden cronológico.' },
  { nivel: 'Diligencia', titulo: 'Evaluación de impacto y oficial de datos',
    texto: `Antes de publicar un formulario con datos sensibles se completa la evaluación de impacto del artículo 14. La Facultad designa a la ${RESPONSABLE} como punto de contacto en materia de protección de datos: ${CORREO}.` },
]

export default function Seguridad() {
  const permisos = usePermisos()
  const [audit, setAudit] = useState<RegistroAuditoria[] | null>(null)
  const [solicitudes, setSolicitudes] = useState<Record<string, unknown>[]>([])
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (permisos.veAuditoria) {
      listarAuditoria().then(setAudit).catch((e: Error) => setAviso(e.message))
    } else { setAudit([]) }
    listarSolicitudes().then((s) => setSolicitudes(s as Record<string, unknown>[])).catch(() => setSolicitudes([]))
  }, [permisos.veAuditoria])

  async function retencion(simulacion: boolean) {
    try {
      const r = await aplicarRetencion(RETENCION_MESES, simulacion)
      setAviso(simulacion
        ? `Simulación: ${r.alcanzadas ?? 0} inscripciones alcanzadas por el plazo de ${r.meses} meses.`
        : `Se anonimizaron ${r.anonimizadas ?? 0} inscripciones y se eliminaron sus datos sensibles.`)
    } catch (e) { setAviso((e as Error).message) }
  }

  return (
    <div>
      <div className="eyebrow">Gobierno de datos</div>
      <h1 className="tipo-display" style={{ marginTop: 8, maxWidth: '30ch' }}>
        Protección de datos y seguridad de la información
      </h1>
      <p style={{ maxWidth: '68ch', color: 'var(--tenue-2)', margin: '14px 0 0' }}>
        Controles vigentes en el sistema, con su fundamento en la {LEY}. Ante un incidente de
        seguridad se notifica a la {AUTORIDAD} y a las personas afectadas dentro de las setenta
        y dos horas.
      </p>
      <hr className="rule-strong" style={{ margin: '28px 0' }} />

      <div style={{ display: 'grid', gap: 30,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {CONTROLES.map((c) => (
          <div key={c.titulo} style={{ borderTop: '1px solid var(--regla)', paddingTop: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--rojo-oscuro)' }}>{c.nivel}</div>
            <h2 className="tipo-titulo" style={{ marginTop: 4 }}>{c.titulo}</h2>
            <p style={{ fontSize: 14, color: 'var(--md-on-surface-variant)', margin: '8px 0 0' }}>{c.texto}</p>
          </div>
        ))}
      </div>

      {/* ── Retención ─────────────────────────────────────────────────── */}
      {permisos.configura && (
        <>
          <hr className="rule-strong" style={{ margin: '36px 0 20px' }} />
          <h2 className="tipo-titulo">Aplicación de la retención</h2>
          <p style={{ fontSize: 14, color: 'var(--tenue-2)', maxWidth: '70ch', marginTop: 8 }}>
            Alcanza a las inscripciones de actividades cerradas o finalizadas hace más de{' '}
            {RETENCION_MESES} meses. La simulación no modifica nada; la aplicación es
            irreversible y queda asentada en auditoría.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => void retencion(true)}>
              Simular
            </button>
            <button className="btn btn-primary" onClick={() => {
              if (!window.confirm(
                'La anonimización es irreversible: se pierden nombre, cédula, correo, teléfono ' +
                'y los datos sensibles de las inscripciones vencidas.\n\n¿Aplicar la retención?',
              )) return
              void retencion(false)
            }}>
              Aplicar la retención
            </button>
          </div>
        </>
      )}

      <Aviso tono="nota">{aviso}</Aviso>

      {/* ── Solicitudes de derechos ───────────────────────────────────── */}
      <hr className="rule-strong" style={{ margin: '36px 0 20px' }} />
      <h2 className="tipo-titulo">Solicitudes de derechos</h2>
      {solicitudes.length === 0 ? (
        <p className="tenue" style={{ marginTop: 12 }}>
          Sin solicitudes pendientes. Las que lleguen por <code>/derechos</code> aparecen acá con
          su plazo de treinta días corridos.
        </p>
      ) : (
        <div className="fc-scroll" style={{ marginTop: 10 }}>
          <table className="table" style={{ minWidth: 720 }}>
            <thead>
              <tr><th>Recibida</th><th>Tipo</th><th>Correo</th><th>Estado</th><th>Vence</th></tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => (
                <tr key={String(s.id)}>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {fechaCorta(String(s.recibida_en))}
                  </td>
                  <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{String(s.tipo)}</td>
                  <td style={{ fontSize: 13 }}>{String(s.email)}</td>
                  <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{String(s.estado)}</td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {fechaCorta(String(s.vence_en))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Auditoría ─────────────────────────────────────────────────── */}
      <hr className="rule-strong" style={{ margin: '36px 0 20px' }} />
      <h2 className="tipo-titulo">Registro de auditoría</h2>
      {!permisos.veAuditoria ? (
        <p className="tenue" style={{ marginTop: 12 }}>
          El registro de auditoría lo consultan la Dirección y el rol de auditoría.
        </p>
      ) : !audit ? <Cargando /> : audit.length === 0 ? (
        <p className="tenue" style={{ marginTop: 12 }}>Sin movimientos registrados.</p>
      ) : (
        <div className="fc-scroll" style={{ marginTop: 10 }}>
          <table className="table" style={{ minWidth: 820 }}>
            <thead>
              <tr><th>Fecha y hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Motivo</th></tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="numeral" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {fechaHora(a.ocurrio_en)}
                  </td>
                  <td style={{ fontSize: 13 }}>{a.usuarios?.email ?? 'sistema'}</td>
                  <td style={{ fontSize: 13 }}>
                    {a.rol ? etiquetaRol(a.rol) : 'tarea programada'}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {a.accion.replace(/_/g, ' ')}
                    {a.entidad ? ` — ${a.entidad}` : ''}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--tenue)' }}>{a.motivo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
