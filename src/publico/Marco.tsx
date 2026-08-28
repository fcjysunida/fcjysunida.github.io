import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FACULTAD, RESPONSABLE, CORREO } from '../lib/institucion'
import { InterruptorTema } from '../lib/tema'

/** Marco de las rutas públicas: cabecera sobria, contenido angosto y pie legal. */
export default function Marco({
  children, ancho = 700, credito,
}: { children: ReactNode; ancho?: number; credito?: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <a className="salto-contenido" href="#principal">Ir al contenido</a>

      <header className="cinta">
        <div className="limite" style={{ padding: '16px 24px', display: 'flex',
                                         alignItems: 'center', gap: 14 }}>
          <img className="logo-institucional" src="/assets/logo-fcjys.svg" alt={FACULTAD}
               style={{ height: 30 }} />
          <div style={{ flex: 1 }} />
          <InterruptorTema />
        </div>
      </header>

      <main id="principal" tabIndex={-1}
            style={{ flex: 1, width: '100%', padding: '44px 20px 80px' }}>
        <div style={{ maxWidth: ancho, margin: '0 auto' }}>
          {children}
          {credito && (
            <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', marginTop: 16 }}>{credito}</p>
          )}
        </div>
      </main>

      <footer style={{ borderTop: '1px solid var(--md-outline-variant)',
                       background: 'var(--md-surface-c-low)' }}>
        <div className="limite" style={{ padding: '26px 28px', display: 'flex', flexWrap: 'wrap',
                                         gap: 18, justifyContent: 'space-between',
                                         fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
          <span>{FACULTAD}</span>
          <span>
            Responsable del tratamiento: {RESPONSABLE} — <a href={`mailto:${CORREO}`}>{CORREO}</a>
          </span>
          <span style={{ display: 'flex', gap: 16 }}>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/derechos">Sus derechos</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
