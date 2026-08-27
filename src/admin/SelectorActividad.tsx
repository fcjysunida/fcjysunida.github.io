import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listarActividades } from '../data/panel'
import type { Actividad } from '../lib/tipos'

/** Estado compartido por las vistas que trabajan sobre una actividad.
 *  La elegida viaja en la URL (?a=…) para que el enlace sea compartible. */
export function useActividadElegida() {
  const [params, setParams] = useSearchParams()
  const [acts, setActs] = useState<Actividad[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listarActividades().then(setActs).catch((e: Error) => setError(e.message))
  }, [])

  const id = params.get('a') ?? acts?.[0]?.id ?? ''
  const actividad = acts?.find((a) => a.id === id) ?? null
  const elegir = (nuevo: string) => setParams({ a: nuevo }, { replace: true })

  return { acts, actividad, id, elegir, error, recargar: () => listarActividades().then(setActs) }
}

export function Selector({
  acts, id, elegir,
}: { acts: Actividad[]; id: string; elegir: (v: string) => void }) {
  return (
    <select className="input input-linea" style={{ width: 'auto', maxWidth: 340 }}
            aria-label="Actividad" value={id} onChange={(e) => elegir(e.target.value)}>
      {acts.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}
    </select>
  )
}
