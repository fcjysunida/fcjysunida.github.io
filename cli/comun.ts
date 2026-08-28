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
  if (!oculto) {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true })
    const v = await rl.question(texto)
    rl.close()
    return v
  }
  // Lectura sin eco. No se usa readline: redibuja la línea entera —el prompt
  // incluido— en cada tecla, así que cualquier filtro sobre lo que se escribe
  // termina dejando pasar la contraseña. Acá se lee stdin en crudo y no se
  // imprime nada de lo tecleado.
  return new Promise<string>((resolve, reject) => {
    stdout.write(texto)
    const crudoAntes = stdin.isRaw === true
    stdin.setRawMode?.(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let buffer = ''
    const cerrar = () => {
      stdin.removeListener('data', alTeclear)
      stdin.setRawMode?.(crudoAntes)
      stdin.pause()
      stdout.write('\n')
    }
    const alTeclear = (trozo: string) => {
      for (const c of trozo) {
        if (c === '\r' || c === '\n' || c === '\u0004') { cerrar(); resolve(buffer); return }
        if (c === '\u0003') { cerrar(); reject(new Error('Cancelado.')); return }
        if (c === '\u007f' || c === '\b') { buffer = buffer.slice(0, -1); continue }
        if (c >= ' ') buffer += c
      }
    }
    stdin.on('data', alTeclear)
  })
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
    fatal(
      'Falta SUPABASE_SERVICE_ROLE_KEY en .env.\n\n' +
      '  Dónde se obtiene:\n' +
      '    https://supabase.com/dashboard/project/mpsajgoycmmciobnnmjy/settings/api-keys\n' +
      '    → pestaña «API Keys» → fila `service_role` → «Reveal» → copiar.\n\n' +
      '  Después, en el archivo .env de este repositorio:\n' +
      '    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...\n\n' +
      '  Esa clave se saltea la RLS: no se commitea, no se pega en el navegador\n' +
      '  y no se comparte. .env ya está en .gitignore.',
    )
  }
  return createClient(URL, SERVICE, { auth: { persistSession: false } })
}

export function tabla(filas: Record<string, unknown>[]): void {
  if (filas.length === 0) { console.log('  (sin resultados)'); return }
  console.table(filas)
}
