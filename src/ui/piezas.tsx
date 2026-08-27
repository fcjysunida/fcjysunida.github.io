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
    <p
      role={tono === 'error' ? 'alert' : undefined}
      style={{
        margin: '4px 0 0',
        fontSize: 14,
        color: tono === 'error' ? 'var(--rojo-oscuro)' : 'var(--tenue)',
      }}
    >
      {children}
    </p>
  )
}

export function Dato({ label, valor, nota }: { label: string; valor: ReactNode; nota?: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--tenue)' }}>{label}</div>
      <div
        className="numeral"
        style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 46, lineHeight: 1.05, marginTop: 2 }}
      >
        {valor}
      </div>
      {nota && <div style={{ fontSize: 13, color: 'rgba(32,30,29,0.55)' }}>{nota}</div>}
    </div>
  )
}
