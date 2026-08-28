import { useState } from 'react'
import type { ReactNode } from 'react'

/** Bloque que nace plegado con un degradado al pie. Se usa para el aviso
 *  previo del art. 27, que es largo y no debe alargar el formulario. */
export function Plegado({
  children, resumen = 'Leer el aviso completo', cerrar = 'Ocultar el aviso', abiertoInicial = false,
}: { children: ReactNode; resumen?: string; cerrar?: string; abiertoInicial?: boolean }) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  return (
    <div className="plegado" data-abierto={abierto}>
      <div className="plegado-cuerpo" aria-hidden={!abierto ? undefined : undefined}>
        {children}
      </div>
      <button
        type="button"
        className="plegado-mando"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        {abierto ? cerrar : resumen}
        <span className="flecha" aria-hidden="true">▾</span>
      </button>
    </div>
  )
}

export function Escala({
  valor, onChange, desde = 1, hasta = 5, rotulos, id,
}: {
  valor: number | null
  onChange: (n: number) => void
  desde?: number
  hasta?: number
  rotulos?: [string, string]
  id?: string
}) {
  const opciones = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)
  return (
    <div>
      <div className={`escala${desde === 0 ? ' escala-nps' : ''}`} role="group" aria-labelledby={id}>
        {opciones.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={valor === n}
            aria-label={`${n} de ${hasta}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      {rotulos && (
        <div className="escala-rotulos">
          <span>{rotulos[0]}</span>
          <span>{rotulos[1]}</span>
        </div>
      )}
    </div>
  )
}

export function Cargando({ texto = 'Cargando' }: { texto?: string }) {
  return (
    <p className="tenue" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
      {texto}…
    </p>
  )
}

export function Aviso({ children, tono = 'error' }: { children: ReactNode; tono?: 'error' | 'nota' }) {
  if (!children) return null
  return (
    <div
      className={tono === 'error' ? 'aviso' : 'aviso aviso-nota'}
      role={tono === 'error' ? 'alert' : 'status'}
      aria-live={tono === 'error' ? 'assertive' : 'polite'}
      style={{ margin: '4px 0 16px' }}
    >
      <span aria-hidden="true" style={{ fontWeight: 700 }}>
        {tono === 'error' ? '!' : 'i'}
      </span>
      <span>{children}</span>
    </div>
  )
}

export function Dato({ label, valor, nota, tono = 'neutro' }: {
  label: string; valor: ReactNode; nota?: ReactNode
  tono?: 'neutro' | 'primario' | 'ok' | 'alerta'
}) {
  const fondo = {
    neutro:   'var(--md-surface-c-low)',
    primario: 'var(--md-primary-container)',
    ok:       'var(--md-tertiary-container)',
    alerta:   'var(--md-error-container)',
  }[tono]
  const texto = {
    neutro:   'var(--md-on-surface)',
    primario: 'var(--md-on-primary-container)',
    ok:       'var(--md-on-tertiary-container)',
    alerta:   'var(--md-on-error-container)',
  }[tono]
  return (
    <div style={{ background: fondo, color: texto, padding: '18px 20px',
                  borderRadius: 'var(--forma-l)' }}>
      <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85 }}>{label}</div>
      <div className="numeral dato-cifra" style={{ marginTop: 4 }}>{valor}</div>
      {nota && <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>{nota}</div>}
    </div>
  )
}

/** Campo de texto con sugerencias. Se puede elegir de la lista o escribir algo
 *  nuevo: `datalist` no restringe, propone. */
export function CampoSugerido({
  etiqueta, valor, onChange, opciones, id, placeholder, ayuda,
}: {
  etiqueta: string; valor: string; onChange: (v: string) => void
  opciones: string[]; id: string; placeholder?: string; ayuda?: string
}) {
  const listaId = `sug-${id}`
  return (
    <label className="field">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        className="input"
        list={listaId}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listaId}>
        {opciones.map((o) => <option key={o} value={o} />)}
      </datalist>
      {ayuda && <span className="ayuda">{ayuda}</span>}
    </label>
  )
}
