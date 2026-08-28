import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type Tema = 'sistema' | 'claro' | 'oscuro'

const CLAVE = 'fcjys-tema'

const Ctx = createContext<{ tema: Tema; poner: (t: Tema) => void }>({
  tema: 'sistema', poner: () => {},
})

function leerGuardado(): Tema {
  if (typeof localStorage === 'undefined') return 'sistema'
  const v = localStorage.getItem(CLAVE)
  return v === 'claro' || v === 'oscuro' ? v : 'sistema'
}

/** Aplica el tema al elemento raíz. Con «sistema» se quita el atributo y manda
 *  la preferencia del sistema operativo, que la hoja de estilos resuelve. */
function aplicar(t: Tema) {
  const raiz = document.documentElement
  if (t === 'sistema') raiz.removeAttribute('data-tema')
  else raiz.setAttribute('data-tema', t)
}

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(leerGuardado)

  useEffect(() => { aplicar(tema) }, [tema])

  const poner = useCallback((t: Tema) => {
    setTema(t)
    if (t === 'sistema') localStorage.removeItem(CLAVE)
    else localStorage.setItem(CLAVE, t)
  }, [])

  return <Ctx.Provider value={{ tema, poner }}>{children}</Ctx.Provider>
}

export const useTema = () => useContext(Ctx)

const OPCIONES: { id: Tema; label: string; icono: string }[] = [
  { id: 'claro',   label: 'Modo claro',                icono: '☀' },
  { id: 'sistema', label: 'Según el sistema operativo', icono: '◐' },
  { id: 'oscuro',  label: 'Modo oscuro',               icono: '☾' },
]

/** Grupo de tres botones con rol radiogroup: el estado se anuncia solo. */
export function InterruptorTema() {
  const { tema, poner } = useTema()
  return (
    <div role="radiogroup" aria-label="Apariencia del sitio"
         style={{ display: 'inline-flex', gap: 2, padding: 3,
                  background: 'var(--md-surface-c-high)',
                  borderRadius: 'var(--forma-completa)' }}>
      {OPCIONES.map((o) => {
        const activo = tema === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={o.label}
            title={o.label}
            onClick={() => poner(o.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 40, minHeight: 38, padding: '0 10px', border: 'none',
              borderRadius: 'var(--forma-completa)', cursor: 'pointer', fontSize: 15,
              background: activo ? 'var(--md-primary)' : 'transparent',
              color: activo ? 'var(--md-on-primary)' : 'var(--md-on-surface-variant)',
              transition: 'background var(--mov-rapido), color var(--mov-rapido)',
            }}
          >
            <span aria-hidden="true">{o.icono}</span>
          </button>
        )
      })}
    </div>
  )
}
