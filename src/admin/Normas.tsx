import { useEffect, useMemo, useState } from 'react'
import { listarNormas, listarArticulos } from '../data/panel'
import type { Norma, NormaArticulo } from '../data/panel'
import { Cargando, Aviso } from '../ui/piezas'

const AMBITOS: { id: string; label: string }[] = [
  { id: '',           label: 'Todo el normograma' },
  { id: 'extension',  label: 'Extensión y proyección social' },
  { id: 'pasantia',   label: 'Prácticas y pasantías' },
  { id: 'academico',  label: 'Régimen académico' },
  { id: 'docente',    label: 'Cuerpo docente' },
  { id: 'gobierno',   label: 'Gobierno institucional' },
]

const JERARQUIA: Record<string, string> = {
  constitucion: 'Constitución', ley: 'Ley', estatuto: 'Estatuto',
  reglamento: 'Reglamento', resolucion: 'Resolución', plan: 'Plan',
}

export default function Normas() {
  const [normas, setNormas] = useState<Norma[] | null>(null)
  const [articulos, setArticulos] = useState<NormaArticulo[]>([])
  const [ambito, setAmbito] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([listarNormas(), listarArticulos()])
      .then(([n, a]) => { setNormas(n); setArticulos(a) })
      .catch((e: Error) => setError(e.message))
  }, [])

  const porNorma = useMemo(() => {
    const m = new Map<string, NormaArticulo[]>()
    for (const a of articulos) {
      const lista = m.get(a.norma) ?? []
      lista.push(a)
      m.set(a.norma, lista)
    }
    return m
  }, [articulos])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (normas ?? []).filter((n) => {
      if (ambito && !n.ambito.includes(ambito)) return false
      if (!q) return true
      if (n.titulo.toLowerCase().includes(q)) return true
      return (porNorma.get(n.codigo) ?? []).some(
        (a) => a.texto.toLowerCase().includes(q) || a.numero.toLowerCase().includes(q),
      )
    })
  }, [normas, ambito, busqueda, porNorma])

  if (error) return <Aviso>{error}</Aviso>
  if (!normas) return <Cargando />

  const totalArticulos = visibles.reduce((a, n) => a + (porNorma.get(n.codigo)?.length ?? 0), 0)

  return (
    <div style={{ maxWidth: 940 }}>
      <div className="eyebrow">Marco normativo</div>
      <h1 style={{ fontSize: 36, lineHeight: 1.12, marginTop: 8 }}>Normograma</h1>
      <p style={{ maxWidth: '76ch', color: 'var(--tenue-2)', margin: '14px 0 0' }}>
        Las normas que rigen la extensión universitaria, la proyección social y las
        prácticas preprofesionales, con el articulado pertinente transcrito de la fuente
        publicada. Cada norma enlaza al documento original.
      </p>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end',
                    marginBottom: 28 }}>
        <select className="input" style={{ width: 'auto' }} aria-label="Ámbito"
                value={ambito} onChange={(e) => setAmbito(e.target.value)}>
          {AMBITOS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <input className="input" style={{ width: 260 }} placeholder="Buscar en el articulado"
               value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <span className="tenue" style={{ fontSize: 13 }}>
          {visibles.length} normas · {totalArticulos} artículos
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        {visibles.map((n) => {
          const arts = porNorma.get(n.codigo) ?? []
          return (
            <article key={n.codigo} className="tarjeta" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className="eyebrow" style={{ fontStyle: 'normal' }}>
                  {JERARQUIA[n.jerarquia] ?? n.jerarquia}
                </span>
                {n.anio && <span className="tenue numeral" style={{ fontSize: 13 }}>{n.anio}</span>}
                {!n.vigente && (
                  <span style={{ fontSize: 12, color: 'var(--rojo-oscuro)' }}>derogada</span>
                )}
              </div>

              <h2 style={{ fontSize: 22, lineHeight: 1.25, margin: '4px 0 0' }}>{n.titulo}</h2>
              {n.organo && (
                <div className="tenue" style={{ fontSize: 13, marginTop: 2 }}>{n.organo}</div>
              )}
              {n.sumario && (
                <p style={{ color: 'var(--tenue-2)', fontSize: 14, margin: '10px 0 0',
                            maxWidth: '72ch' }}>{n.sumario}</p>
              )}

              {arts.length > 0 && (
                <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {arts.map((a) => (
                    <div key={a.id} style={{ borderLeft: '2px solid var(--regla-fuerte)',
                                             paddingLeft: 14 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {a.numero}
                        {a.epigrafe && (
                          <span className="tenue" style={{ fontWeight: 400 }}> — {a.epigrafe}</span>
                        )}
                      </div>
                      <blockquote style={{ margin: '5px 0 0', fontFamily: 'var(--serif)',
                                           fontSize: 15.5, lineHeight: 1.55,
                                           maxWidth: '70ch' }}>
                        «{a.texto}»
                      </blockquote>
                    </div>
                  ))}
                </div>
              )}

              {n.sin_texto && (
                <p style={{ marginTop: 16, fontSize: 13.5, color: 'var(--tenue-2)' }}>
                  El PDF publicado es un escaneo sin capa de texto, así que no se transcribe
                  articulado: se enlaza el documento original para consultarlo.
                </p>
              )}

              {n.url && (
                <p style={{ margin: '16px 0 0' }}>
                  <a className="btn btn-ghost" href={n.url} target="_blank" rel="noreferrer">
                    Ver el documento original
                  </a>
                </p>
              )}
            </article>
          )
        })}
      </div>

      {visibles.length === 0 && (
        <p className="tenue">Ninguna norma coincide con esa búsqueda.</p>
      )}
    </div>
  )
}
