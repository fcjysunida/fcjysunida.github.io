import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSesion } from '../lib/sesion'
import { etiquetaRol } from '../lib/campos'
import { fechaHora } from '../lib/formato'
import { Aviso } from '../ui/piezas'
import { Icono } from '../ui/iconos'

const MINIMO = 12

export default function Perfil() {
  const { rol, nombre, sesion } = useSesion()
  const email = sesion?.user?.email ?? ''

  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  const corta = clave.length > 0 && clave.length < MINIMO
  const distintas = repetida.length > 0 && clave !== repetida
  const puede = clave.length >= MINIMO && clave === repetida && !guardando

  async function cambiar() {
    setError(''); setAviso(''); setGuardando(true)
    try {
      const { error: e } = await supabase.auth.updateUser({ password: clave })
      if (e) throw new Error(e.message)
      setAviso('Contraseña actualizada. La próxima vez entre con la nueva.')
      setClave(''); setRepetida('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="eyebrow">Su cuenta</div>
      <h1 className="tipo-display" style={{ marginTop: 8 }}>Mi perfil</h1>
      <p className="entradilla">
        Los datos de su cuenta y el cambio de contraseña. El rol lo asigna la Dirección
        desde el registro de usuarios: nadie puede cambiarse el suyo.
      </p>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />
      <Aviso>{error}</Aviso>
      <Aviso tono="nota">{aviso}</Aviso>

      <div className="tarjeta" style={{ padding: '20px 22px', marginBottom: 26 }}>
        <div className="tipo-titulo" style={{ marginBottom: 14 }}>Datos de la cuenta</div>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 18px',
                     margin: 0, fontSize: 14 }}>
          <dt className="tipo-nota">Nombre</dt>
          <dd style={{ margin: 0 }}>{nombre || '—'}</dd>
          <dt className="tipo-nota">Correo</dt>
          <dd style={{ margin: 0 }}>{email || '—'}</dd>
          <dt className="tipo-nota">Rol</dt>
          <dd style={{ margin: 0 }}>
            <span className="chip chip-primario">
              {rol ? etiquetaRol(rol) : 'Sin rol asignado'}
            </span>
          </dd>
          {sesion?.user?.last_sign_in_at && (
            <>
              <dt className="tipo-nota">Último ingreso</dt>
              <dd className="numeral" style={{ margin: 0 }}>
                {fechaHora(sesion.user.last_sign_in_at)}
              </dd>
            </>
          )}
        </dl>
      </div>

      <div className="tarjeta" id="clave" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
          <Icono nombre="escudo" tam={20} />
          <div className="tipo-titulo">Cambiar la contraseña</div>
        </div>
        <p className="tipo-nota" style={{ margin: '0 0 16px', maxWidth: '60ch' }}>
          Mínimo {MINIMO} caracteres. Use una que no utilice en otro sitio: esta cuenta
          da acceso a datos personales de estudiantes, y cada consulta queda asentada a
          su nombre.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 380 }}>
          <label className="field">
            <label htmlFor="clave-nueva">Contraseña nueva</label>
            <input id="clave-nueva" className="input" type="password"
                   autoComplete="new-password" value={clave}
                   aria-describedby={corta ? 'clave-corta' : undefined}
                   onChange={(e) => setClave(e.target.value)} />
            {corta && (
              <span id="clave-corta" className="error">
                Le faltan {MINIMO - clave.length} caracteres.
              </span>
            )}
          </label>

          <label className="field">
            <label htmlFor="clave-repetida">Repítala</label>
            <input id="clave-repetida" className="input" type="password"
                   autoComplete="new-password" value={repetida}
                   aria-describedby={distintas ? 'clave-distinta' : undefined}
                   onChange={(e) => setRepetida(e.target.value)} />
            {distintas && (
              <span id="clave-distinta" className="error">No coinciden.</span>
            )}
          </label>

          <div>
            <button className="btn btn-primary" disabled={!puede}
                    onClick={() => void cambiar()}>
              {guardando ? 'Guardando…' : 'Cambiar la contraseña'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
