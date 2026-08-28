import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { certificadoPorCodigo } from '../data/publico'
import type { CertificadoPublico } from '../lib/tipos'
import { fechaHora } from '../lib/formato'
import { etiquetaModalidad } from '../lib/campos'
import { CORREO, FACULTAD } from '../lib/institucion'
import { Cargando, Aviso } from '../ui/piezas'
import Marco from './Marco'

/** Reemplaza <<Etiqueta>> por su valor. Misma sintaxis que usaba Autocrat.
 *  La sustitución es de texto plano: nada de lo que venga en los datos se
 *  interpreta como HTML. */
export function aplicarEtiquetas(plantilla: string, valores: Record<string, string>): string {
  return plantilla.replace(/&lt;&lt;\s*([\wÁÉÍÓÚÑáéíóúñ]+)\s*&gt;&gt;|<<\s*([\wÁÉÍÓÚÑáéíóúñ]+)\s*>>/g,
    (_todo, a: string | undefined, b: string | undefined) => {
      const clave = (a ?? b ?? '').toLowerCase()
      const v = valores[clave]
      if (v === undefined) return ''
      return v.replace(/[&<>"]/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c))
    })
}

const ROLES_EN_CONSTANCIA: Record<string, string> = {
  participante: 'participante', disertante: 'disertante', organizador: 'organizador',
  tutor: 'tutor', panelista: 'panelista', moderador: 'moderador',
}

/** «María Fernanda Ayala» → nombres «María Fernanda», apellido «Ayala». */
export function partirNombre(completo: string): { nombres: string; apellido: string } {
  const t = completo.trim().split(/\s+/)
  if (t.length === 1) return { nombres: t[0] ?? '', apellido: '' }
  return { nombres: t.slice(0, -1).join(' '), apellido: t[t.length - 1] ?? '' }
}

export default function Certificado() {
  const { codigo = '' } = useParams()
  const ir = useNavigate()
  const [c, setC] = useState<CertificadoPublico | null>(null)
  const [fallo, setFallo] = useState('')
  const [buscado, setBuscado] = useState(codigo)

  useEffect(() => {
    if (!codigo) { setFallo('vacio'); return }
    setFallo('')
    certificadoPorCodigo(codigo)
      .then((r) => (r.error ? setFallo(r.error) : setC(r)))
      .catch(() => setFallo('red'))
  }, [codigo])

  if (!codigo || fallo === 'vacio' || fallo === 'no_encontrado') {
    return (
      <Marco ancho={560}>
        <div className="eyebrow">Verificación de constancias</div>
        <h1 style={{ fontSize: 32, marginTop: 8 }}>
          {fallo === 'no_encontrado' ? 'Ese código no corresponde a ninguna constancia'
                                     : 'Compruebe una constancia'}
        </h1>
        <p style={{ color: 'var(--tenue-2)', marginTop: 14 }}>
          Ingrese el código impreso al pie del documento. Tiene la forma{' '}
          <strong>FCJ-XXXX-XXXX</strong>.
        </p>
        <form style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}
              onSubmit={(e) => { e.preventDefault(); if (buscado.trim()) ir(`/c/${buscado.trim()}`) }}>
          <input className="input" style={{ maxWidth: 260, minHeight: 46,
                                            fontFamily: 'var(--serif)', fontSize: 19,
                                            letterSpacing: '0.08em' }}
                 value={buscado} aria-label="Código de verificación"
                 placeholder="FCJ-XXXX-XXXX"
                 onChange={(e) => setBuscado(e.target.value.toUpperCase())} />
          <button className="btn btn-primary" type="submit">Comprobar</button>
        </form>
        <p style={{ fontSize: 13, color: 'var(--tenue)', marginTop: 24 }}>
          Ante cualquier duda escriba a <a href={`mailto:${CORREO}`}>{CORREO}</a>.
        </p>
      </Marco>
    )
  }

  if (fallo === 'demasiados_intentos') {
    return <Marco ancho={560}><Aviso>Demasiados intentos con ese código. Aguarde diez minutos.</Aviso></Marco>
  }
  if (fallo) return <Marco ancho={560}><Cargando texto="No pudimos comprobar el código" /></Marco>
  if (!c) return <Marco ancho={560}><Cargando /></Marco>

  const { nombres, apellido } = partirNombre(c.nombre)
  const valores: Record<string, string> = {
    nombres, apellido, nombrecompleto: c.nombre,
    evento: c.evento, fecha: c.fecha, horas: String(c.horas),
    // Los valores crudos del esquema («hibrida») no van en un documento oficial.
    rol: ROLES_EN_CONSTANCIA[c.rol] ?? c.rol,
    modalidad: etiquetaModalidad(c.modalidad as Parameters<typeof etiquetaModalidad>[0]),
    lugar: c.lugar ?? '',
    codigo: c.codigo, jornadas: String(c.jornadas),
    fechaemision: new Date(c.emitido_en).toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' }),
  }
  const html = c.plantilla ? aplicarEtiquetas(c.plantilla.cuerpo_html, valores) : ''

  return (
    <Marco ancho={1180}>
      <div className="no-imprimir" style={{ marginBottom: 24 }}>
        <div className="eyebrow">Constancia verificada</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                      gap: 20, flexWrap: 'wrap', marginTop: 8 }}>
          <div>
            <h1 style={{ fontSize: 28, lineHeight: 1.15 }}>{c.evento}</h1>
            <p style={{ color: 'var(--tenue-2)', margin: '8px 0 0' }}>
              Emitida a nombre de <strong>{c.nombre}</strong> el{' '}
              {fechaHora(c.emitido_en)}. Código {c.codigo}.
            </p>
            <div style={{ marginTop: 12 }}>
              <span className={`sello ${c.valido ? 'sello-valido' : 'sello-anulado'}`}>
                {c.valido ? '✓ Constancia válida' : '✕ Constancia anulada'}
              </span>
            </div>
          </div>
          {c.valido && (
            <button className="btn btn-primary" onClick={() => window.print()}>
              Descargar o imprimir
            </button>
          )}
        </div>
      </div>

      {c.valido && c.plantilla && (
        <div className="hoja-marco-exterior">
          <div className={`hoja ${c.plantilla.orientacion === 'vertical' ? 'vertical' : ''}`}
               style={c.plantilla.fondo_url
                 ? { backgroundImage: `url(${c.plantilla.fondo_url})` } : undefined}>
            {!c.plantilla.fondo_url && <div className="hoja-marco" />}
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      )}

      {!c.valido && (
        <p style={{ color: 'var(--rojo-oscuro)' }}>
          Esta constancia fue anulada
          {c.anulado_en ? ` el ${fechaHora(c.anulado_en)}` : ''} y no tiene validez.
          Consulte a la Coordinación de Extensión en <a href={`mailto:${CORREO}`}>{CORREO}</a>.
        </p>
      )}

      <p className="no-imprimir" style={{ fontSize: 13, color: 'var(--tenue)', marginTop: 20 }}>
        Esta página confirma la autenticidad del documento contra los registros de {FACULTAD}.
        No revela ningún dato personal del titular más allá de lo que la propia constancia
        muestra.
      </p>
    </Marco>
  )
}
