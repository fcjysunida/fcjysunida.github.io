/** Visualizaciones en SVG, sin librerías. Cada gráfico lleva su equivalente
 *  accesible: `role="img"` con una descripción que resume lo que muestra, y una
 *  tabla oculta cuando el detalle importa (WCAG 1.1.1 y 1.4.11). */

const PALETA = [
  'var(--md-primary)',
  'var(--md-tertiary)',
  'var(--md-secondary)',
  'var(--md-primary-container)',
  'var(--md-tertiary-container)',
]

export type Punto = { etiqueta: string; valor: number; detalle?: string }

/** Tabla equivalente para lectores de pantalla, fuera del flujo visual. */
function TablaOculta({ titulo, datos }: { titulo: string; datos: Punto[] }) {
  return (
    <table style={{
      position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
      overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
    }}>
      <caption>{titulo}</caption>
      <tbody>
        {datos.map((d) => (
          <tr key={d.etiqueta}><th scope="row">{d.etiqueta}</th><td>{d.valor}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

/** Barras horizontales. Se lee bien con etiquetas largas y pocos valores. */
export function Barras({ titulo, datos, unidad = '' }: {
  titulo: string; datos: Punto[]; unidad?: string
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor))
  return (
    <div style={{ position: 'relative' }}>
      <TablaOculta titulo={titulo} datos={datos} />
      <div role="img" aria-label={`${titulo}. ${datos.map((d) => `${d.etiqueta}: ${d.valor}${unidad}`).join('. ')}`}
           style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {datos.map((d, i) => (
          <div key={d.etiqueta}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12,
                          fontSize: 13, marginBottom: 5 }}>
              <span>{d.etiqueta}</span>
              <span className="numeral" style={{ fontWeight: 600 }}>
                {d.valor}{unidad}
              </span>
            </div>
            <div className="barra">
              <span style={{
                width: `${(d.valor / max) * 100}%`,
                background: PALETA[i % PALETA.length],
                transition: 'width var(--mov-elastico)',
              }} />
            </div>
            {d.detalle && (
              <div className="tenue" style={{ fontSize: 12, marginTop: 3 }}>{d.detalle}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Serie temporal por mes. Área rellena más línea, con la retícula mínima. */
export function Serie({ titulo, datos, alto = 150 }: {
  titulo: string; datos: Punto[]; alto?: number
}) {
  if (datos.length === 0) return null
  const ancho = 640
  const pad = { arriba: 12, abajo: 26, izq: 8, der: 8 }
  const max = Math.max(1, ...datos.map((d) => d.valor))
  const paso = datos.length > 1
    ? (ancho - pad.izq - pad.der) / (datos.length - 1)
    : 0
  const y = (v: number) =>
    pad.arriba + (1 - v / max) * (alto - pad.arriba - pad.abajo)
  const x = (i: number) => pad.izq + i * paso

  const linea = datos.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.valor)}`).join(' ')
  const area = `${linea} L ${x(datos.length - 1)} ${alto - pad.abajo} L ${x(0)} ${alto - pad.abajo} Z`
  const resumen = `${titulo}. ${datos.map((d) => `${d.etiqueta}: ${d.valor}`).join('. ')}`

  return (
    <div style={{ position: 'relative' }}>
      <TablaOculta titulo={titulo} datos={datos} />
      <svg viewBox={`0 0 ${ancho} ${alto}`} width="100%" height={alto}
           role="img" aria-label={resumen} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="degradadoSerie" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--md-primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--md-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={pad.izq} y1={alto - pad.abajo} x2={ancho - pad.der} y2={alto - pad.abajo}
              stroke="var(--md-outline-variant)" strokeWidth="1" />
        <path d={area} fill="url(#degradadoSerie)" />
        <path d={linea} fill="none" stroke="var(--md-primary)" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
        {datos.map((d, i) => (
          <g key={d.etiqueta}>
            <circle cx={x(i)} cy={y(d.valor)} r="4"
                    fill="var(--md-surface)" stroke="var(--md-primary)" strokeWidth="2.5" />
            {(datos.length <= 14 || i % 2 === 0) && (
              <text x={x(i)} y={alto - 8} textAnchor="middle"
                    fontSize="10.5" fill="var(--md-on-surface-variant)">
                {d.etiqueta}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

/** Anillo de avance. Muestra una proporción sobre una meta. */
export function Anillo({ titulo, valor, total, etiqueta }: {
  titulo: string; valor: number; total: number; etiqueta?: string
}) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0
  const r = 52
  const circ = 2 * Math.PI * r
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <svg viewBox="0 0 130 130" width="118" height="118" role="img"
           aria-label={`${titulo}: ${valor} de ${total}, ${Math.round(pct)} por ciento.`}>
        <circle cx="65" cy="65" r={r} fill="none"
                stroke="var(--md-surface-c-highest)" strokeWidth="13" />
        <circle cx="65" cy="65" r={r} fill="none"
                stroke="var(--md-primary)" strokeWidth="13" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * circ} ${circ}`}
                transform="rotate(-90 65 65)"
                style={{ transition: 'stroke-dasharray var(--mov-elastico)' }} />
        <text x="65" y="70" textAnchor="middle" fontSize="26" fontWeight="600"
              fill="var(--md-on-surface)" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(pct)}%
        </text>
      </svg>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{titulo}</div>
        <div className="numeral tenue" style={{ fontSize: 13, marginTop: 2 }}>
          {valor} de {total}
        </div>
        {etiqueta && (
          <div className="tenue" style={{ fontSize: 12, marginTop: 4, maxWidth: '28ch' }}>
            {etiqueta}
          </div>
        )}
      </div>
    </div>
  )
}
