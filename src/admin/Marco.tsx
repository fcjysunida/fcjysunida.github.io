import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useSesion } from '../lib/sesion'
import { etiquetaRol } from '../lib/campos'
import { FACULTAD, RESPONSABLE, CORREO } from '../lib/institucion'
import { InterruptorTema } from '../lib/tema'
import { GRUPOS, grupoDe } from './navegacion'
import { Icono } from '../ui/iconos'
import MenuMovil from './MenuMovil'


export default function MarcoAdmin({ children }: { children: ReactNode }) {
  const { rol, nombre, salir } = useSesion()
  const { pathname } = useLocation()
  const grupoActivo = grupoDe(pathname)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* WCAG 2.4.1: primer elemento enfocable, salta la navegación. */}
      <a className="salto-contenido" href="#principal">Ir al contenido</a>

      <header className="cinta">
        <div className="limite" style={{ paddingTop: 18, display: 'flex', alignItems: 'center',
                                         gap: 18, flexWrap: 'wrap' }}>
          <img className="logo-institucional" src="/assets/logo-fcjys.svg" alt={FACULTAD}
               style={{ height: 34 }} />
          <div style={{ flex: 1, minWidth: 80 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <MenuMovil />
            <InterruptorTema />
            <span className="tenue" style={{ fontSize: 13 }}>
              {nombre}{rol ? ` — ${etiquetaRol(rol)}` : ' — sin rol asignado'}
            </span>
            <button className="btn btn-secondary" onClick={() => void salir()}>Salir</button>
          </div>
        </div>

        <div className="limite" style={{ paddingTop: 14 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '-0.015em' }}>
            Inscripciones y asistencia
          </div>
        </div>

        {/* Primer nivel: seis entradas. Cada grupo lleva a su primera pantalla.
            En pantalla angosta se reemplaza por el botón de menú. */}
        <div className="limite solo-ancho" style={{ paddingTop: 12 }}>
          <nav className="fc-tabs" aria-label="Secciones del panel">
            <NavLink to="/admin" end className="nav-tab">
              <Icono nombre="panel" tam={18} /> Panel
            </NavLink>
            {/* Link y no NavLink: NavLink calcula su propio aria-current contra la
                ruta exacta y pisaría el del grupo. Acá lo marca el grupo activo,
                que puede ser cualquiera de sus pantallas. */}
            {GRUPOS.map((g) => (
              <Link
                key={g.id}
                to={g.items[0]!.a}
                className="nav-tab"
                aria-current={grupoActivo?.id === g.id ? 'page' : undefined}
              >
                <Icono nombre={g.icono} tam={18} /> {g.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Segundo nivel: solo el del grupo en el que uno está. */}
        {grupoActivo && (
          <div className="limite solo-ancho" style={{ paddingTop: 8, paddingBottom: 12 }}>
            <nav className="fc-tabs" aria-label={`Dentro de ${grupoActivo.label}`}>
              {grupoActivo.items.map((it) => (
                <NavLink key={it.a} to={it.a} className="nav-sub" title={it.nota}>
                  <Icono nombre={it.icono} tam={16} /> {it.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
        {!grupoActivo && <div style={{ height: 12 }} />}
      </header>

      <main id="principal" className="limite entra" tabIndex={-1}
            key={pathname}
            style={{ flex: 1, width: '100%', padding: '40px 24px 96px' }}>
        {children}
      </main>

      <footer style={{ borderTop: '1px solid var(--md-outline-variant)',
                       background: 'var(--md-surface-c-low)' }}>
        <div className="limite" style={{ padding: '24px', display: 'flex', flexWrap: 'wrap',
                                         gap: 18, justifyContent: 'space-between',
                                         fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
          <span>{FACULTAD}</span>
          <span>Responsable del tratamiento: {RESPONSABLE} — {CORREO}</span>
        </div>
      </footer>
    </div>
  )
}
