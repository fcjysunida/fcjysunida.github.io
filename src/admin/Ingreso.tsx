import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { FACULTAD, CORREO } from '../lib/institucion'
import { Aviso } from '../ui/piezas'

export default function Ingreso({ sinRol = false }: { sinRol?: boolean }) {
  const [modo, setModo] = useState<'entrar' | 'registrarse'>('entrar')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [nota, setNota] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setNota(''); setCargando(true)

    if (modo === 'registrarse') {
      if (clave.length < 10) {
        setError('La contraseña debe tener al menos diez caracteres.')
        setCargando(false); return
      }
      // La cuenta nace sin rol: la Dirección la habilita después. Así el alta
      // no necesita la clave de servicio y nadie se asigna permisos a sí mismo.
      const { error: err } = await supabase.auth.signUp({
        email: email.trim(), password: clave,
        options: { data: { nombre: nombre.trim() } },
      })
      if (err) {
        setError(err.message.includes('already')
          ? 'Ya existe una cuenta con ese correo. Ingrese con su contraseña.'
          : 'No pudimos crear la cuenta.')
      } else {
        setNota('Cuenta creada. Si el correo pide confirmación, revise su bandeja. ' +
                'Después, la Dirección debe asignarle un rol para que pueda entrar.')
        setModo('entrar')
      }
      setCargando(false); return
    }

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
        {modo === 'entrar' ? 'Inscripciones y asistencia' : 'Crear una cuenta'}
      </h1>
      <p className="tenue" style={{ fontSize: 14, marginTop: 10 }}>
        {modo === 'entrar'
          ? 'Acceso restringido al personal de la Facultad. Cada acceso a datos identificables queda asentado en el registro de auditoría.'
          : 'La cuenta se crea sin permisos: la Dirección le asigna el rol después. Nadie puede habilitarse a sí mismo.'}
      </p>
      <form onSubmit={(e) => void entrar(e)}
            style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 26 }}>
        {modo === 'registrarse' && (
          <div className="field">
            <label htmlFor="nombre">Nombre y apellido</label>
            <input id="nombre" className="input" autoComplete="name"
                   style={{ minHeight: 44 }} value={nombre} required
                   onChange={(e) => setNombre(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Correo institucional</label>
          <input id="email" className="input" type="email" autoComplete="username"
                 style={{ minHeight: 44 }} value={email} required
                 onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="clave">Contraseña</label>
          <input id="clave" className="input" type="password"
                 autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                 style={{ minHeight: 44 }} value={clave} required
                 onChange={(e) => setClave(e.target.value)} />
          {modo === 'registrarse' && (
            <span className="ayuda">Al menos diez caracteres.</span>
          )}
        </div>
        <button className="btn btn-primary" style={{ minHeight: 46 }} type="submit" disabled={cargando}>
          {cargando ? 'Verificando…' : modo === 'entrar' ? 'Entrar' : 'Crear la cuenta'}
        </button>
        <Aviso>{error}</Aviso>
        <Aviso tono="nota">{nota}</Aviso>
        <button type="button" className="btn btn-ghost"
                onClick={() => { setModo(modo === 'entrar' ? 'registrarse' : 'entrar')
                                 setError(''); setNota('') }}>
          {modo === 'entrar' ? 'No tengo cuenta todavía' : 'Ya tengo cuenta'}
        </button>
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
