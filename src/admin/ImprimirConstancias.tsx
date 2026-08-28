import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { certificadosImprimibles } from '../data/panel'
import type { CertificadoImprimible } from '../data/panel'
import { aplicarEtiquetas, partirNombre } from '../publico/Certificado'
import { etiquetaModalidad } from '../lib/campos'
import { basePublica } from '../lib/institucion'
import { fechaCorta } from '../lib/formato'
import type { Modalidad } from '../lib/tipos'
import { Cargando, Aviso } from '../ui/piezas'

/**
 * Pliego de constancias listo para imprimir. El navegador lo convierte en un
 * PDF de una página por constancia con «Guardar como PDF», que es lo mismo que
 * generaría un servidor y además respeta la tipografía y el fondo tal como se
 * ven en pantalla. Para una sola persona, el enlace /c/:codigo hace lo mismo.
 */
export default function ImprimirConstancias() {
  const [params] = useSearchParams()
  const actividadId = params.get('a') ?? ''
  const solo = params.get('pendientes') === '1'
  const [filas, setFilas] = useState<CertificadoImprimible[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!actividadId) { setError('Falta indicar la actividad.'); return }
    certificadosImprimibles(actividadId, solo)
      .then(setFilas).catch((e: Error) => setError(e.message))
  }, [actividadId, solo])

  const hojas = useMemo(() => (filas ?? []).map((c) => {
    const { nombres, apellido } = partirNombre(c.nombre)
    const valores: Record<string, string> = {
      nombres, apellido, nombrecompleto: c.nombre,
      evento: c.evento, fecha: c.fecha_texto, horas: String(c.horas),
      rol: c.rol, modalidad: etiquetaModalidad(c.modalidad as Modalidad),
      lugar: c.lugar ?? '', codigo: c.codigo, jornadas: String(c.jornadas),
      fechaemision: fechaCorta(c.emitido_en),
    }
    return {
      codigo: c.codigo,
      html: c.cuerpo_html ? aplicarEtiquetas(c.cuerpo_html, valores) : '',
      fondo: c.fondo_url, orientacion: c.orientacion,
    }
  }), [filas])

  if (error) return <div style={{ padding: 40 }}><Aviso>{error}</Aviso></div>
  if (!filas) return <div style={{ padding: 40 }}><Cargando /></div>

  return (
    <div style={{ padding: '28px 20px 60px', background: 'var(--fondo)' }}>
      <div className="no-imprimir limite" style={{ marginBottom: 26 }}>
        <div className="eyebrow">Constancias</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.14, marginTop: 8 }}>
          {filas.length === 0
            ? 'No hay constancias para imprimir'
            : `${filas.length} ${filas.length === 1 ? 'constancia' : 'constancias'} para imprimir`}
        </h1>
        <p style={{ maxWidth: '72ch', color: 'var(--tenue-2)', margin: '12px 0 0' }}>
          Use «Imprimir» y elija <strong>Guardar como PDF</strong>: sale un archivo con una
          página por constancia, en A4 apaisado. Para una sola persona, el enlace{' '}
          <code>/c/&lt;código&gt;</code> imprime esa nada más — y sirve además para que
          cualquiera compruebe que es auténtica.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => window.print()}
                  disabled={filas.length === 0}>
            Imprimir o guardar como PDF
          </button>
          <Link className="btn btn-secondary" to={`/admin/certificados?a=${actividadId}`}>
            Volver a las constancias
          </Link>
        </div>
        {filas.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--tenue)', marginTop: 14 }}>
            Enlaces individuales:{' '}
            {filas.slice(0, 4).map((c) => (
              <a key={c.codigo} href={`${basePublica()}/c/${c.codigo}`}
                 style={{ marginRight: 10 }}>{c.codigo}</a>
            ))}
            {filas.length > 4 && `y ${filas.length - 4} más`}
          </p>
        )}
      </div>

      <div className="pliego">
        {hojas.map((h) => (
          <div key={h.codigo}
               className={`hoja ${h.orientacion === 'vertical' ? 'vertical' : ''}`}
               style={h.fondo ? { backgroundImage: `url(${h.fondo})` } : undefined}>
            {!h.fondo && <div className="hoja-marco" />}
            <div dangerouslySetInnerHTML={{ __html: h.html }} />
          </div>
        ))}
      </div>
    </div>
  )
}
