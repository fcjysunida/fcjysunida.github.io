import { Link } from 'react-router-dom'
import { CORREO } from '../lib/institucion'
import Marco from './Marco'

export default function NoEncontrado() {
  return (
    <Marco ancho={560}>
      <div className="eyebrow">Página no encontrada</div>
      <h1 style={{ fontSize: 32, marginTop: 8 }}>Esa dirección no corresponde a nada</h1>
      <p style={{ color: 'var(--tenue-2)', marginTop: 14 }}>
        Los enlaces de inscripción tienen la forma <code>/f/…</code> y los de asistencia,{' '}
        <code>/a/…</code>. Si el suyo dejó de funcionar puede haber sido regenerado: pida el
        vigente a la Coordinación de Extensión, en <a href={`mailto:${CORREO}`}>{CORREO}</a>.
      </p>
      <p style={{ marginTop: 18 }}>
        <Link to="/privacidad">Política de privacidad</Link> ·{' '}
        <Link to="/derechos">Ejercer sus derechos</Link>
      </p>
    </Marco>
  )
}
