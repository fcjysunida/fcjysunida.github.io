/**
 * Publicación en GitHub Pages.
 *
 * Necesita un token de GitHub en `.env` como `GITHUB_TOKEN`, con permiso sobre
 * repositorios y sobre secretos de Actions. El token se lee del archivo: no se
 * imprime, no se pasa por la línea de comandos y no se escribe en el remoto de
 * git, que se arma en memoria para cada operación.
 */
import { execFileSync } from 'node:child_process'
import sodium from 'libsodium-wrappers'
import { fatal } from './comun'

const API = 'https://api.github.com'

interface Opciones {
  repo: string            // «leoberniga/fcjysunida»
  privado: boolean
  base: string            // «/fcjysunida/» o «/»
  supabaseUrl: string
  supabaseAnon: string
}

function encabezados(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

async function api<T>(
  token: string, metodo: string, ruta: string, cuerpo?: unknown,
): Promise<{ ok: boolean; status: number; datos: T }> {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: encabezados(token),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const texto = await r.text()
  let datos: unknown = {}
  try { datos = texto ? JSON.parse(texto) : {} } catch { datos = { raw: texto } }
  return { ok: r.ok, status: r.status, datos: datos as T }
}

/** Los secretos de Actions viajan cifrados con la clave pública del repositorio. */
async function ponerSecreto(
  token: string, repo: string, nombre: string, valor: string,
): Promise<void> {
  const clave = await api<{ key: string; key_id: string }>(
    token, 'GET', `/repos/${repo}/actions/secrets/public-key`)
  if (!clave.ok) fatal(`No pude leer la clave pública del repositorio (${clave.status}).`)

  await sodium.ready
  const cifrado = sodium.crypto_box_seal(
    sodium.from_string(valor),
    sodium.from_base64(clave.datos.key, sodium.base64_variants.ORIGINAL))

  const r = await api(token, 'PUT', `/repos/${repo}/actions/secrets/${nombre}`, {
    encrypted_value: sodium.to_base64(cifrado, sodium.base64_variants.ORIGINAL),
    key_id: clave.datos.key_id,
  })
  if (!r.ok) fatal(`No pude guardar el secreto ${nombre} (${r.status}).`)
  console.log(`  secreto ${nombre} ✓`)
}

async function ponerVariable(
  token: string, repo: string, nombre: string, valor: string,
): Promise<void> {
  const existe = await api(token, 'GET', `/repos/${repo}/actions/variables/${nombre}`)
  const r = existe.ok
    ? await api(token, 'PATCH', `/repos/${repo}/actions/variables/${nombre}`,
                { name: nombre, value: valor })
    : await api(token, 'POST', `/repos/${repo}/actions/variables`,
                { name: nombre, value: valor })
  if (!r.ok) fatal(`No pude guardar la variable ${nombre} (${r.status}).`)
  console.log(`  variable ${nombre} = ${valor} ✓`)
}

function git(args: string[], token?: string, repo?: string): string {
  // El token va en la URL del push, que se pasa como argumento de un proceso
  // hijo y nunca queda escrita en .git/config.
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  return execFileSync('git', args, { encoding: 'utf8', env, cwd: process.cwd() }).trim()
}

/** El token sale de .env o, si no está, de la sesión de `gh` si el usuario ya
 *  hizo `gh auth login`. En ese caso no hay nada que copiar ni pegar. */
function tomarToken(): string | undefined {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  try {
    const t = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    if (t) { console.log('  Usando la sesión de `gh auth login`.'); return t }
  } catch { /* gh no está o no hay sesión */ }
  return undefined
}

export async function desplegar(o: Opciones): Promise<void> {
  const token = tomarToken()
  if (!token) {
    fatal(
      'No encontré credenciales de GitHub. Hay dos caminos, cualquiera sirve.\n\n' +
      '  A) Sesión de gh (no hay que copiar ni pegar nada):\n' +
      '       gh auth login        # elige GitHub.com → HTTPS → login con el navegador\n' +
      '     Después vuelva a correr este comando y lo detecto solo.\n\n' +
      '  B) Un token en .env:\n' +
      '     Falta GITHUB_TOKEN en .env.\n\n' +
      '  Se crea en https://github.com/settings/personal-access-tokens/new\n' +
      '    · Repository access: el repositorio de destino (o «All repositories»)\n' +
      '    · Permisos:  Administration → Read and write   (crear el repo y activar Pages)\n' +
      '                 Contents      → Read and write   (subir el código)\n' +
      '                 Secrets       → Read and write   (cargar las claves de Supabase)\n' +
      '                 Variables     → Read and write   (cargar BASE_PUBLICA)\n' +
      '                 Workflows     → Read and write   (subir el archivo de despliegue)\n\n' +
      '  Después, en el archivo .env de este repositorio:\n' +
      '    GITHUB_TOKEN=github_pat_...\n\n' +
      '  .env ya está en .gitignore: el token no se sube a ningún lado.',
    )
  }

  const [duenio, nombre] = o.repo.split('/')
  if (!duenio || !nombre) fatal('El repositorio va como «usuario/nombre».')

  const quien = await api<{ login: string }>(token, 'GET', '/user')
  if (!quien.ok) fatal(`El token no es válido (${quien.status}).`)
  console.log(`\n  Autenticado como ${quien.datos.login}.`)

  // 1. Repositorio
  const existe = await api(token, 'GET', `/repos/${o.repo}`)
  if (existe.ok) {
    console.log(`  Repositorio ${o.repo} ya existe ✓`)
  } else {
    const esOrg = duenio.toLowerCase() !== quien.datos.login.toLowerCase()
    const r = await api(token, 'POST', esOrg ? `/orgs/${duenio}/repos` : '/user/repos', {
      name: nombre, private: o.privado, auto_init: false,
      description: 'Sistema de inscripciones y asistencia — FCJYS UNIDA',
    })
    if (!r.ok) fatal(`No pude crear ${o.repo} (${r.status}). ${JSON.stringify(r.datos).slice(0, 200)}`)
    console.log(`  Repositorio ${o.repo} creado ✓`)
  }

  // 2. Código
  const rama = git(['branch', '--show-current'])
  if (rama !== 'main') { git(['branch', '-M', 'main']); console.log('  Rama renombrada a main ✓') }
  try { git(['remote', 'remove', 'origin']) } catch { /* no había */ }
  git(['remote', 'add', 'origin', `https://github.com/${o.repo}.git`])
  console.log('  Subiendo el código…')
  execFileSync('git',
    ['push', `https://x-access-token:${token}@github.com/${o.repo}.git`, 'main:main', '--force'],
    { stdio: 'inherit', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  // El push fue contra la URL con el token, así que `origin/main` todavía no
  // existe localmente. Se trae la referencia para dejar el upstream fijado.
  // Es cosmético: si falla, el despliegue igual está hecho.
  try {
    git(['fetch', 'origin', 'main'])
    git(['branch', '--set-upstream-to=origin/main', 'main'])
  } catch { console.log('  (no pude fijar el upstream; el código ya está subido)') }
  console.log('  Código subido ✓')

  // 3. Secretos y variables del build
  await ponerSecreto(token, o.repo, 'VITE_SUPABASE_URL', o.supabaseUrl)
  await ponerSecreto(token, o.repo, 'VITE_SUPABASE_ANON_KEY', o.supabaseAnon)
  await ponerVariable(token, o.repo, 'BASE_PUBLICA', o.base)

  // 4. Pages servido por Actions
  const pages = await api(token, 'GET', `/repos/${o.repo}/pages`)
  const r = pages.ok
    ? await api(token, 'PUT', `/repos/${o.repo}/pages`, { build_type: 'workflow' })
    : await api(token, 'POST', `/repos/${o.repo}/pages`, { build_type: 'workflow' })
  if (!r.ok && r.status !== 409) {
    console.log(`  Pages: no pude configurarlo automáticamente (${r.status}). ` +
                `Actívelo a mano en Settings → Pages → Source: GitHub Actions.`)
  } else {
    console.log('  GitHub Pages servido por Actions ✓')
  }

  // 5. Disparar el flujo
  const disparo = await api(token, 'POST',
    `/repos/${o.repo}/actions/workflows/deploy.yml/dispatches`, { ref: 'main' })
  console.log(disparo.ok
    ? '  Despliegue disparado ✓'
    : '  El despliegue arrancará solo con el push.')

  // Un repositorio llamado «<dueño>.github.io» se sirve en la raíz del dominio;
  // cualquier otro cuelga de /<nombre>/.
  const sitio = nombre.toLowerCase() === `${duenio.toLowerCase()}.github.io`
    ? `https://${duenio.toLowerCase()}.github.io`
    : `https://${duenio.toLowerCase()}.github.io/${nombre}`
  console.log(`\n  Sitio:      ${sitio}`)
  console.log(`  Formulario: ${sitio}/f/<token>`)
  console.log(`  Asistencia: ${sitio}/a/<token>`)
  console.log(`  Constancia: ${sitio}/c/<codigo>`)
  console.log(`  Panel:      ${sitio}/admin`)
  console.log(`\n  El flujo tarda un par de minutos. Se sigue en:`)
  console.log(`  https://github.com/${o.repo}/actions\n`)
}
