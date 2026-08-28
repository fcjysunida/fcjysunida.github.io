import type { ReactNode } from 'react'

/** Bloque titulado del formulario oficial. */
export function Bloque({
  titulo, nota, children,
}: { titulo: string; nota?: ReactNode; children: ReactNode }) {
  return (
    <section className="bloque">
      <h2>{titulo}</h2>
      {nota && <p className="bloque-nota">{nota}</p>}
      {children}
    </section>
  )
}

export function Campo({
  etiqueta, valor, onChange, ayuda, ancho, tipo = 'text', placeholder,
}: {
  etiqueta: string; valor: string; onChange: (v: string) => void
  ayuda?: string; ancho?: number | string; tipo?: string; placeholder?: string
}) {
  const id = `c-${etiqueta.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="field" style={{ width: ancho }}>
      <label htmlFor={id}>{etiqueta}</label>
      <input id={id} className="input" type={tipo} value={valor} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
      {ayuda && <span className="ayuda">{ayuda}</span>}
    </div>
  )
}

export function Area({
  etiqueta, valor, onChange, ayuda, alto = 100,
}: {
  etiqueta: string; valor: string; onChange: (v: string) => void
  ayuda?: string; alto?: number
}) {
  const id = `a-${etiqueta.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="field">
      <label htmlFor={id}>{etiqueta}</label>
      <textarea id={id} className="input" style={{ minHeight: alto }} value={valor}
                onChange={(e) => onChange(e.target.value)} />
      {ayuda && <span className="ayuda">{ayuda}</span>}
    </div>
  )
}

/** Lista de líneas de texto que se agregan y quitan (objetivos, metas, anexos). */
export function Lineas({
  etiqueta, valores, onChange, placeholder,
}: {
  etiqueta: string; valores: string[]; onChange: (v: string[]) => void; placeholder?: string
}) {
  return (
    <div className="field">
      <label>{etiqueta}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {valores.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontFamily: 'var(--serif)', color: 'var(--tenue)',
                           minWidth: 20, paddingTop: 8 }}>{i + 1}</span>
            <input className="input" value={v} placeholder={placeholder}
                   onChange={(e) => onChange(valores.map((x, j) => (j === i ? e.target.value : x)))} />
            <button className="btn btn-ghost" style={{ fontSize: 13 }} title="Quitar"
                    onClick={() => onChange(valores.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
      </div>
      <button className="btn btn-secondary" style={{ marginTop: 10 }}
              onClick={() => onChange([...valores, ''])}>Agregar</button>
    </div>
  )
}

/** Tabla de filas repetibles con columnas fijas. */
export function Filas<T extends Record<string, string>>({
  etiqueta, columnas, valores, onChange, vacia,
}: {
  etiqueta: string
  columnas: [keyof T & string, string][]
  valores: T[]
  onChange: (v: T[]) => void
  vacia: T
}) {
  return (
    <div className="field">
      <label>{etiqueta}</label>
      <div className="fc-scroll">
        <table className="matriz" style={{ minWidth: 60 * columnas.length + 120 }}>
          <thead>
            <tr>
              {columnas.map(([k, r]) => <th key={k}>{r}</th>)}
              <th style={{ width: 70 }} />
            </tr>
          </thead>
          <tbody>
            {valores.map((fila, i) => (
              <tr key={i}>
                {columnas.map(([k]) => (
                  <td key={k}>
                    <input value={fila[k] ?? ''} aria-label={k}
                           onChange={(e) => onChange(valores.map((f, j) =>
                             (j === i ? { ...f, [k]: e.target.value } : f)))} />
                  </td>
                ))}
                <td>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }}
                          onClick={() => onChange(valores.filter((_, j) => j !== i))}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-secondary" style={{ marginTop: 10 }}
              onClick={() => onChange([...valores, { ...vacia }])}>Agregar fila</button>
    </div>
  )
}

/** Cuadro rubro × fuente del presupuesto y de la rendición. */
export function Matriz({
  etiqueta, filas, columnas, valores, onChange, nota,
}: {
  etiqueta: string
  filas: readonly (readonly [string, string])[]
  columnas: readonly (readonly [string, string])[]
  valores: Record<string, Record<string, string>>
  onChange: (v: Record<string, Record<string, string>>) => void
  nota?: string
}) {
  const set = (f: string, c: string, v: string) =>
    onChange({ ...valores, [f]: { ...(valores[f] ?? {}), [c]: v } })
  return (
    <div className="field">
      <label>{etiqueta}</label>
      {nota && <span className="ayuda" style={{ marginBottom: 8 }}>{nota}</span>}
      <div className="fc-scroll">
        <table className="matriz" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 210 }}>Rubro</th>
              {columnas.map(([k, r]) => <th key={k}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.map(([fk, fr]) => (
              <tr key={fk}>
                <th scope="row" style={{ fontWeight: 400, fontFamily: 'var(--sans)' }}>{fr}</th>
                {columnas.map(([ck]) => (
                  <td key={ck}>
                    <input inputMode="numeric" aria-label={`${fr} — ${ck}`}
                           value={valores[fk]?.[ck] ?? ''}
                           onChange={(e) => set(fk, ck, e.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Cuadro de créditos académicos: casillas por destinatario. */
export function Casillas({
  etiqueta, filas, columnas, valores, onChange,
}: {
  etiqueta: string
  filas: readonly (readonly [string, string])[]
  columnas: readonly (readonly [string, string])[]
  valores: Record<string, Record<string, boolean>>
  onChange: (v: Record<string, Record<string, boolean>>) => void
}) {
  const set = (f: string, c: string, v: boolean) =>
    onChange({ ...valores, [f]: { ...(valores[f] ?? {}), [c]: v } })
  return (
    <div className="field">
      <label>{etiqueta}</label>
      <div className="fc-scroll">
        <table className="matriz" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 180 }} />
              {columnas.map(([k, r]) => <th key={k}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.map(([fk, fr]) => (
              <tr key={fk}>
                <th scope="row" style={{ fontWeight: 400, fontFamily: 'var(--sans)' }}>{fr}</th>
                {columnas.map(([ck, cr]) => (
                  <td key={ck} style={{ textAlign: 'center' }}>
                    <input type="checkbox" aria-label={`${fr} — ${cr}`}
                           checked={valores[fk]?.[ck] ?? false}
                           onChange={(e) => set(fk, ck, e.target.checked)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
