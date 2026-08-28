import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GRUPOS, grupoDe } from './navegacion'
import { Icono } from '../ui/iconos'

/** Menú de pantalla angosta. En vez de desbordar seis grupos y sus catorce
 *  pantallas, se abre un panel con todo el árbol.
 *
 *  Se cierra con Escape y al navegar, el foco vuelve al botón, y mientras está
 *  abierto el resto de la página queda fuera del orden de tabulación gracias a
 *  `inert`. El fondo se bloquea para que no haga scroll por detrás. */
export default function MenuMovil() {
  const [abierto, setAbierto] = useState(false)
  const { pathname } = useLocation()
  const grupoActivo = grupoDe(pathname)
  const boton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()

  // Se cierra al cambiar de ruta.
  useEffect(() => { setAbierto(false) }, [pathname])

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setAbierto(false); boton.current?.focus() }
    }
    document.addEventListener('keydown', alTeclear)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // El primer enlace toma el foco al abrir.
    panel.current?.querySelector<HTMLElement>('a')?.focus()
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflow
    }
  }, [abierto])

  return (
    <>
      <button
        ref={boton}
        type="button"
        className="btn btn-secondary solo-angosto"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
      >
        <Icono nombre={abierto ? 'mas' : 'panel'} tam={18} />
        {abierto ? 'Cerrar' : 'Menú'}
      </button>

      {abierto && (
        <>
          <div className="velo" onClick={() => setAbierto(false)} aria-hidden="true" />
          <div
            id={id}
            ref={panel}
            className="menu-movil"
            role="dialog"
            aria-modal="true"
            aria-label="Secciones del panel"
          >
            <Link to="/admin" className="menu-movil-item">
              <Icono nombre="panel" tam={20} />
              <span><strong>Panel</strong></span>
            </Link>

            {GRUPOS.map((g) => (
              <section key={g.id} className="menu-movil-grupo">
                <h2 className="menu-movil-titulo">
                  <Icono nombre={g.icono} tam={17} /> {g.label}
                </h2>
                {g.items.map((it) => (
                  <Link
                    key={it.a}
                    to={it.a}
                    className="menu-movil-item"
                    aria-current={pathname === it.a ? 'page' : undefined}
                  >
                    <Icono nombre={it.icono} tam={20} />
                    <span>
                      <strong>{it.label}</strong>
                      {it.nota && <em>{it.nota}</em>}
                    </span>
                  </Link>
                ))}
              </section>
            ))}

            {grupoActivo && (
              <p className="tipo-nota" style={{ margin: '8px 4px 0' }}>
                Está en {grupoActivo.label}.
              </p>
            )}
          </div>
        </>
      )}
    </>
  )
}
