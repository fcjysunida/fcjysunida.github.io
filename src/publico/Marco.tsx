import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FACULTAD, RESPONSABLE, CORREO } from '../lib/institucion'

/** Marco de las rutas públicas: cabecera sobria, contenido angosto y pie legal. */
export default function Marco({
  children, ancho = 700, credito,
}: { children: ReactNode; ancho?: number; credito?: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="cinta">
        <div className="limite" style={{ padding: '18px 28px', display: 'flex',
                                         alignItems: 'center', gap: 14 }}>
          <img src="/assets/logo-fcjys.svg" alt={FACULTAD}
               style={{ height: 30, width: 'auto' }} />
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', padding: '44px 20px 80px' }}>
        <div style={{ maxWidth: ancho, margin: '0 auto' }}>
          {children}
          {credito && (
            <p style={{ fontSize: 13, color: 'rgba(32,30,29,0.5)', marginTop: 16 }}>{credito}</p>
          )}
        </div>
      </main>

      <footer style={{ borderTop: '1px solid var(--regla)', background: 'var(--papel)' }}>
        <div className="limite" style={{ padding: '26px 28px', display: 'flex', flexWrap: 'wrap',
                                         gap: 18, justifyContent: 'space-between',
                                         fontSize: 13, color: 'rgba(32,30,29,0.65)' }}>
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
