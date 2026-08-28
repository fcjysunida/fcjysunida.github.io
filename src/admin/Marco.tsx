import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useSesion } from '../lib/sesion'
import { etiquetaRol } from '../lib/campos'
import { FACULTAD, RESPONSABLE, CORREO } from '../lib/institucion'

const PESTANAS = [
  { a: '/admin',                 label: 'Panel', exacta: true },
  { a: '/admin/nueva',           label: 'Nueva actividad' },
  { a: '/admin/inscripciones',   label: 'Inscripciones' },
  { a: '/admin/asistencia',      label: 'Asistencia' },
  { a: '/admin/indicadores',     label: 'Estadísticas' },
  { a: '/admin/calidad',         label: 'Calidad' },
  { a: '/admin/certificados',    label: 'Constancias' },
  { a: '/admin/proyectos',       label: 'Proyectos' },
  { a: '/admin/padron',          label: 'Padrón' },
  { a: '/admin/extension',       label: 'Horas de extensión' },
  { a: '/admin/seguridad',       label: 'Protección de datos' },
  { a: '/admin/usuarios',        label: 'Usuarios' },
  { a: '/admin/ajustes',         label: 'Ajustes' },
]

export default function MarcoAdmin({ children }: { children: ReactNode }) {
  const { rol, nombre, salir } = useSesion()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="cinta">
        <div className="limite" style={{ paddingTop: 20, display: 'flex', alignItems: 'center',
                                         gap: 18, flexWrap: 'wrap' }}>
          <img src="/assets/logo-fcjys.svg" alt={FACULTAD} style={{ height: 36, width: 'auto' }} />
          <div style={{ flex: 1, minWidth: 120 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13 }}>
            <span className="tenue">
              {nombre}{rol ? ` — ${etiquetaRol(rol)}` : ' — sin rol asignado'}
            </span>
            <button className="btn btn-ghost" onClick={() => void salir()}>Salir</button>
          </div>
        </div>
        <div className="limite" style={{ paddingTop: 14 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 19, letterSpacing: '-0.01em' }}>
            Inscripciones y asistencia
          </div>
        </div>
        <div className="limite" style={{ paddingTop: 12 }}>
          <nav className="fc-tabs">
            {PESTANAS.map((p) => (
              <NavLink key={p.a} to={p.a} end={p.exacta} className="nav-tab">{p.label}</NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="limite" style={{ flex: 1, width: '100%', padding: '44px 28px 96px' }}>
        {children}
      </main>

      <footer style={{ borderTop: '1px solid var(--regla)', background: 'var(--papel)' }}>
        <div className="limite" style={{ padding: '26px 28px', display: 'flex', flexWrap: 'wrap',
                                         gap: 18, justifyContent: 'space-between',
                                         fontSize: 13, color: 'rgba(32,30,29,0.65)' }}>
          <span>{FACULTAD}</span>
          <span>Responsable del tratamiento: {RESPONSABLE} — {CORREO}</span>
        </div>
      </footer>
    </div>
  )
}
