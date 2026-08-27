import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { FACULTAD, CORREO } from '../lib/institucion'
import { Aviso } from '../ui/piezas'

export default function Ingreso({ sinRol = false }: { sinRol?: boolean }) {
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setCargando(true)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(), password: clave,
    })
    if (err) setError('No pudimos validar esas credenciales.')
    setCargando(false)
  }

  if (sinRol) {
    return (
      <Pantalla>
        <h1 style={{ fontSize: 26 }}>Su cuenta todavía no tiene rol asignado</h1>
        <p style={{ color: 'var(--tenue-2)', marginTop: 12 }}>
          La Dirección debe habilitarla en el registro de usuarios antes de que pueda
          ver actividades o inscripciones. Escriba a <a href={`mailto:${CORREO}`}>{CORREO}</a>.
        </p>
        <button className="btn btn-secondary" style={{ marginTop: 16 }}
                onClick={() => void supabase.auth.signOut()}>
          Salir
        </button>
      </Pantalla>
    )
  }

  return (
    <Pantalla>
      <div className="eyebrow">Panel de gestión</div>
      <h1 style={{ fontSize: 30, lineHeight: 1.14, marginTop: 8 }}>
        Inscripciones y asistencia
      </h1>
      <p className="tenue" style={{ fontSize: 14, marginTop: 10 }}>
        Acceso restringido al personal de la Facultad. Cada acceso a datos identificables
        queda asentado en el registro de auditoría.
      </p>
      <form onSubmit={(e) => void entrar(e)}
            style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 26 }}>
        <div className="field">
          <label htmlFor="email">Correo institucional</label>
          <input id="email" className="input" type="email" autoComplete="username"
                 style={{ minHeight: 44 }} value={email} required
                 onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="clave">Contraseña</label>
          <input id="clave" className="input" type="password" autoComplete="current-password"
                 style={{ minHeight: 44 }} value={clave} required
                 onChange={(e) => setClave(e.target.value)} />
        </div>
        <button className="btn btn-primary" style={{ minHeight: 46 }} type="submit" disabled={cargando}>
          {cargando ? 'Verificando…' : 'Entrar'}
        </button>
        <Aviso>{error}</Aviso>
      </form>
    </Pantalla>
  )
}

function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="tarjeta" style={{ width: '100%', maxWidth: 420, padding: '34px 32px' }}>
        <img src="/assets/logo-fcjys.svg" alt={FACULTAD}
             style={{ height: 28, width: 'auto', marginBottom: 22 }} />
        {children}
      </div>
    </div>
  )
}
