import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../lib/sesion'
import { etiquetaRol } from '../lib/campos'
import { Icono } from '../ui/iconos'

/** Iniciales para el avatar: primera letra del nombre y del apellido. */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase()
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase()
}

/** Menú de la cuenta. En la cabecera solo queda el avatar; el nombre, el rol y
 *  las acciones viven adentro. Antes ocupaban toda la barra y competían con la
 *  navegación, que es lo que uno mira. */
export default function MenuUsuario() {
  const { rol, nombre, sesion, salir } = useSesion()
  const email = sesion?.user?.email ?? ''
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setAbierto(false); boton.current?.focus() }
    }
    const alClicar = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('keydown', alTeclear)
    document.addEventListener('mousedown', alClicar)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('mousedown', alClicar)
    }
  }, [abierto])

  const etiqueta = nombre || email || 'Cuenta'

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <button
        ref={boton}
        type="button"
        className="avatar"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={`Cuenta de ${etiqueta}. Abrir el menú`}
        onClick={() => setAbierto((v) => !v)}
      >
        <span aria-hidden="true">{iniciales(etiqueta)}</span>
      </button>

      {abierto && (
        <div id={id} role="menu" className="menu-cuenta">
          <div className="menu-cuenta-ficha">
            <div className="tipo-subtitulo">{etiqueta}</div>
            {email && nombre && <div className="tipo-nota">{email}</div>}
            <div style={{ marginTop: 6 }}>
              <span className="chip chip-primario">
                {rol ? etiquetaRol(rol) : 'Sin rol asignado'}
              </span>
            </div>
          </div>

          <hr className="rule" style={{ margin: '10px 0' }} />

          <Link to="/admin/perfil" role="menuitem" className="menu-cuenta-item"
                onClick={() => setAbierto(false)}>
            <Icono nombre="personas" tam={18} /> Mi perfil
          </Link>
          <Link to="/admin/perfil#clave" role="menuitem" className="menu-cuenta-item"
                onClick={() => setAbierto(false)}>
            <Icono nombre="escudo" tam={18} /> Cambiar la contraseña
          </Link>

          <hr className="rule" style={{ margin: '10px 0' }} />

          <button type="button" role="menuitem" className="menu-cuenta-item"
                  onClick={() => void salir()}>
            <Icono nombre="subir" tam={18} style={{ transform: 'rotate(90deg)' }} />
            Salir
          </button>
        </div>
      )}
    </div>
  )
}
