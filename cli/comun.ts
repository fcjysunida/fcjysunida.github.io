import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import 'dotenv/config'

export const URL = process.env.VITE_SUPABASE_URL ?? ''
export const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? ''
export const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export function argumentos(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (!a.startsWith('--')) continue
    const clave = a.slice(2)
    const sig = argv[i + 1]
    if (sig === undefined || sig.startsWith('--')) out[clave] = true
    else { out[clave] = sig; i++ }
  }
  return out
}

export function exigir(args: Record<string, string | true>, ...claves: string[]): string[] {
  const faltan = claves.filter((c) => typeof args[c] !== 'string')
  if (faltan.length > 0) {
    fatal(`Faltan argumentos: ${faltan.map((f) => '--' + f).join(', ')}`)
  }
  return claves.map((c) => args[c] as string)
}

export function fatal(mensaje: string): never {
  console.error(`\n  ${mensaje}\n`)
  process.exit(1)
}

async function preguntar(texto: string, oculto = false): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true })
  if (oculto) {
    // Silencia el eco para que la contraseña no quede en pantalla ni en el historial.
    const escribir = (stdout as unknown as { write: (s: string) => boolean }).write.bind(stdout)
    ;(stdout as unknown as { write: (s: string) => boolean }).write = (s: string) =>
      (s.includes(texto) ? escribir(s) : true)
    const v = await rl.question(texto)
    ;(stdout as unknown as { write: (s: string) => boolean }).write = escribir
    stdout.write('\n')
    rl.close()
    return v
  }
  const v = await rl.question(texto)
  rl.close()
  return v
}

/**
 * Sesión del operador. La línea de comandos NO usa el service_role: entra como
 * una persona, con su rol, para que cada acción quede atribuida en auditoría.
 * La contraseña se pide por consola y no se guarda en ningún lado.
 */
export async function comoOperador(): Promise<SupabaseClient> {
  if (!URL || !ANON) fatal('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env')
  const cliente = createClient(URL, ANON, { auth: { persistSession: false } })
  const email = process.env.FCJYS_EMAIL ?? (await preguntar('  Correo institucional: '))
  const clave = process.env.FCJYS_PASSWORD ?? (await preguntar('  Contraseña: ', true))
  const { error } = await cliente.auth.signInWithPassword({ email: email.trim(), password: clave })
  if (error) fatal('No pudimos validar esas credenciales.')
  return cliente
}

/** Cliente con service_role. Solo para alta de usuarios y claves del Vault. */
export function comoServicio(): SupabaseClient {
  if (!URL || !SERVICE) {
    fatal('Falta SUPABASE_SERVICE_ROLE_KEY en .env. Se obtiene en el panel de Supabase y nunca se commitea.')
  }
  return createClient(URL, SERVICE, { auth: { persistSession: false } })
}

export function tabla(filas: Record<string, unknown>[]): void {
  if (filas.length === 0) { console.log('  (sin resultados)'); return }
  console.table(filas)
}
