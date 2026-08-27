import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !clave) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Copie .env.example a .env.',
  )
}

// La clave anónima es pública por diseño: todo el control está en las políticas
// RLS y en los permisos de ejecución de las funciones del esquema.
export const supabase = createClient(url, clave, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Sesión corta: la política de seguridad exige cierre por inactividad.
    storageKey: 'fcjys.sesion',
  },
  global: { headers: { 'x-aplicacion': 'fcjysunida' } },
})

/** Envuelve una llamada RPC y devuelve el jsonb ya tipado. */
export async function rpc<T>(
  nombre: string,
  parametros: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(nombre, parametros)
  if (error) throw new Error(error.message)
  return data as T
}
