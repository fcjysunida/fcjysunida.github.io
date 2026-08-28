import { useEffect, useState } from 'react'
import {
  usuariosPendientes, usuariosListar, asignarRol, activarUsuario, confirmarCorreo,
} from '../data/panel'
import type { UsuarioPendiente, UsuarioPanel } from '../data/panel'
import type { Rol } from '../lib/tipos'
import { ROLES, etiquetaRol } from '../lib/campos'
import { fechaHora } from '../lib/formato'
import { usePermisos } from '../lib/sesion'
import { Cargando, Aviso } from '../ui/piezas'

const QUE_HACE: Record<Rol, string> = {
  admin: 'Todo: cédulas completas, exportación con cédula, retención, configuración y roles.',
  coordinacion: 'Crea actividades y proyectos, ve inscriptos con cédula enmascarada, exporta con motivo.',
  docente: 'Solo sus actividades: asistencia, sus datos sensibles, calidad percibida. No exporta.',
  secretaria: 'Ve y edita inscripciones, cédula completa con motivo, importa el padrón. No configura.',
  auditor: 'Solo lectura: inscriptos con cédula enmascarada, indicadores y registro de auditoría.',
}

export default function Usuarios() {
  const permisos = usePermisos()
  const [pendientes, setPendientes] = useState<UsuarioPendiente[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioPanel[] | null>(null)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  const cargar = () => {
    usuariosListar().then(setUsuarios).catch((e: Error) => setError(e.message))
    if (permisos.configura) {
      usuariosPendientes().then(setPendientes).catch(() => setPendientes([]))
    }
  }
  useEffect(cargar, [permisos.configura])

  async function accion(fn: () => Promise<unknown>, mensaje: string) {
    setError(''); setAviso('')
    try { await fn(); setAviso(mensaje); cargar() }
    catch (e) { setError((e as Error).message) }
  }

  if (error && !usuarios) return <Aviso>{error}</Aviso>
  if (!usuarios) return <Cargando />

  return (
    <div style={{ maxWidth: 980 }}>
      <div className="eyebrow">Acceso al panel</div>
      <h1 style={{ fontSize: 36, lineHeight: 1.12, marginTop: 8 }}>Usuarios y roles</h1>
      <p style={{ maxWidth: '74ch', color: 'var(--tenue-2)', margin: '14px 0 0' }}>
        Quien se registra en el panel queda <strong>sin permisos</strong> hasta que la Dirección
        le asigna un rol. Nadie puede habilitarse a sí mismo, y cada asignación o cambio queda
        asentado en el registro de auditoría.
      </p>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />
      <Aviso>{error}</Aviso>
      <Aviso tono="nota">{aviso}</Aviso>

      {/* ── Pendientes ─────────────────────────────────────────────────── */}
      {permisos.configura && (
        <>
          <h2 style={{ fontSize: 25 }}>
            Cuentas esperando rol
            {pendientes.length > 0 && (
              <span style={{ color: 'var(--rojo)', marginLeft: 10, fontSize: 20 }}>
                {pendientes.length}
              </span>
            )}
          </h2>
          {pendientes.length === 0 ? (
            <p className="tenue" style={{ marginTop: 12 }}>
              No hay cuentas pendientes. Las nuevas aparecen acá apenas alguien se registra
              en <code>/admin</code>.
            </p>
          ) : (
            <div className="fc-scroll" style={{ marginTop: 12 }}>
              <table className="table" style={{ minWidth: 760 }}>
                <thead>
                  <tr><th>Correo</th><th>Nombre</th><th>Registrada</th><th>Correo</th>
                      <th>Asignar rol</th></tr>
                </thead>
                <tbody>
                  {pendientes.map((u) => (
                    <FilaPendiente key={u.id} usuario={u} onAccion={accion} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <hr className="rule-strong" style={{ margin: '32px 0 20px' }} />
        </>
      )}

      {/* ── Habilitados ────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: 25 }}>Cuentas habilitadas</h2>
      <div className="fc-scroll" style={{ marginTop: 12 }}>
        <table className="table" style={{ minWidth: 860 }}>
          <thead>
            <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th /></tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.55 }}>
                <td className="obra">
                  {u.nombre}
                  {u.es_uno_mismo && (
                    <span className="tenue" style={{ fontSize: 12, marginLeft: 6 }}>(usted)</span>
                  )}
                </td>
                <td style={{ fontSize: 13 }}>
                  {u.email}
                  {!u.correo_confirmado && (
                    <span style={{ color: 'var(--rojo-oscuro)', fontSize: 12, display: 'block' }}>
                      correo sin confirmar
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 13 }}>
                  {permisos.configura && !u.es_uno_mismo ? (
                    <select className="input" style={{ minHeight: 30, fontSize: 13 }}
                            value={u.rol} aria-label={`Rol de ${u.nombre}`}
                            onChange={(e) => void accion(
                              () => asignarRol(u.id, e.target.value),
                              `${u.nombre} ahora es ${etiquetaRol(e.target.value as Rol)}.`)}>
                      {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  ) : etiquetaRol(u.rol)}
                </td>
                <td style={{ fontSize: 13 }}>{u.activo ? 'Activa' : 'Desactivada'}</td>
                <td>
                  {permisos.configura && !u.es_uno_mismo && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {!u.correo_confirmado && (
                        <button className="btn btn-ghost" style={{ fontSize: 13 }}
                                onClick={() => void accion(() => confirmarCorreo(u.id),
                                  'Correo confirmado.')}>
                          Confirmar correo
                        </button>
                      )}
                      <button className="btn btn-ghost" style={{ fontSize: 13 }}
                              onClick={() => {
                                if (u.activo && !window.confirm(
                                  `¿Desactivar la cuenta de ${u.nombre}? Dejará de poder entrar.`)) return
                                void accion(() => activarUsuario(u.id, !u.activo),
                                  u.activo ? 'Cuenta desactivada.' : 'Cuenta reactivada.')
                              }}>
                        {u.activo ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Qué puede cada rol ─────────────────────────────────────────── */}
      <hr className="rule-strong" style={{ margin: '36px 0 20px' }} />
      <h2 style={{ fontSize: 25 }}>Qué puede cada rol</h2>
      <div style={{ display: 'grid', gap: 22, marginTop: 16,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {ROLES.map((r) => (
          <div key={r.id} style={{ borderTop: '1px solid var(--regla)', paddingTop: 14 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{r.label}</div>
            <p style={{ fontSize: 14, color: 'var(--tenue-2)', margin: '6px 0 0' }}>
              {QUE_HACE[r.id]}
            </p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 13, color: 'var(--tenue)', marginTop: 20, maxWidth: '80ch' }}>
        El control real está en las políticas de la base, no en esta pantalla: aunque alguien
        manipule el navegador, la base rechaza lo que su rol no admite.
      </p>
    </div>
  )
}

function FilaPendiente({
  usuario, onAccion,
}: {
  usuario: UsuarioPendiente
  onAccion: (fn: () => Promise<unknown>, mensaje: string) => Promise<void>
}) {
  const [rol, setRol] = useState<Rol>('docente')
  return (
    <tr>
      <td style={{ fontSize: 13 }}>{usuario.email}</td>
      <td className="obra">{usuario.nombre || '—'}</td>
      <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{fechaHora(usuario.registrado_en)}</td>
      <td style={{ fontSize: 13 }}>
        {usuario.correo_confirmado ? 'confirmado' : (
          <button className="btn btn-ghost" style={{ fontSize: 13 }}
                  onClick={() => void onAccion(() => confirmarCorreo(usuario.id),
                    'Correo confirmado.')}>
            confirmar
          </button>
        )}
      </td>
      <td>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input" style={{ minHeight: 30, fontSize: 13, width: 'auto' }}
                  value={rol} aria-label={`Rol para ${usuario.email}`}
                  onChange={(e) => setRol(e.target.value as Rol)}>
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <button className="btn btn-secondary" style={{ fontSize: 13 }}
                  onClick={() => void onAccion(
                    () => asignarRol(usuario.id, rol, usuario.nombre),
                    `${usuario.email} habilitado como ${etiquetaRol(rol)}.`)}>
            Habilitar
          </button>
        </div>
      </td>
    </tr>
  )
}
