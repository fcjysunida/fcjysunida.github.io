import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, rpc } from './supabase'
import type { Rol } from './tipos'

interface Sesion {
  sesion: Session | null
  rol: Rol | null
  nombre: string
  cargando: boolean
  salir: () => Promise<void>
}

const Ctx = createContext<Sesion | null>(null)

/** Cierre por inactividad a los 30 minutos, según docs/SEGURIDAD.md. */
const INACTIVIDAD_MS = 30 * 60 * 1000

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [rol, setRol] = useState<Rol | null>(null)
  const [nombre, setNombre] = useState('')
  const [cargando, setCargando] = useState(true)
  const temporizador = useRef<number>()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      if (!data.session) setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSesion(s)
      if (!s) { setRol(null); setNombre(''); setCargando(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sesion) return
    let vivo = true
    ;(async () => {
      try {
        const r = await rpc<Rol | null>('rol_actual')
        const { data } = await supabase
          .from('usuarios').select('nombre').eq('id', sesion.user.id).maybeSingle()
        if (!vivo) return
        setRol(r)
        setNombre(data?.nombre ?? sesion.user.email ?? '')
      } catch {
        if (vivo) setRol(null)
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [sesion])

  useEffect(() => {
    if (!sesion) return
    const reiniciar = () => {
      window.clearTimeout(temporizador.current)
      temporizador.current = window.setTimeout(() => { void supabase.auth.signOut() }, INACTIVIDAD_MS)
    }
    const eventos = ['pointerdown', 'keydown', 'visibilitychange'] as const
    eventos.forEach((e) => window.addEventListener(e, reiniciar))
    reiniciar()
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, reiniciar))
      window.clearTimeout(temporizador.current)
    }
  }, [sesion])

  const valor = useMemo<Sesion>(
    () => ({ sesion, rol, nombre, cargando, salir: async () => { await supabase.auth.signOut() } }),
    [sesion, rol, nombre, cargando],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSesion(): Sesion {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSesion fuera del proveedor')
  return v
}

/** Permisos derivados del rol. Es conveniencia de interfaz: el control real
 *  vive en las políticas RLS y en los permisos de las funciones. */
export function usePermisos() {
  const { rol } = useSesion()
  const es = (...rs: Rol[]) => (rol ? rs.includes(rol) : false)
  return {
    rol,
    configura:    es('admin'),
    creaActividad: es('admin', 'coordinacion'),
    edita:        es('admin', 'coordinacion', 'secretaria'),
    exporta:      es('admin', 'coordinacion', 'secretaria'),
    exportaCedula: es('admin'),
    veCedula:     es('admin', 'secretaria'),
    veSensibles:  es('admin', 'docente'),
    veAuditoria:  es('admin', 'auditor'),
    veCalidad:    es('admin', 'coordinacion', 'docente'),
    regeneraEnlace: es('admin', 'coordinacion'),
  }
}
