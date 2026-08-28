import { useRef, useState } from 'react'
import { leerDocumento } from '../data/panel'
import { Icono } from '../ui/iconos'
import { Aviso } from '../ui/piezas'

/** Carga de un proyecto o un informe desde el archivo que remitió la cátedra.
 *
 *  Lo importante es que **no guarda nada**: la lectura vuelve como propuesta y
 *  la persona confirma. Un modelo se equivoca, y en un formato oficial una
 *  fecha mal leída o un estudiante inventado son un problema. Por eso se
 *  muestra qué campos llenó, cuáles quedaron vacíos y qué dijo que no encontró,
 *  antes de tocar el formulario. */
export default function ImportarDocumento<T extends { faltantes?: string[] }>({
  tipo, onLeido, titulo, ayuda,
}: {
  tipo: 'proyecto' | 'informe'
  onLeido: (datos: T) => void
  titulo?: string
  ayuda?: string
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [previa, setPrevia] = useState<{ datos: T; proveedor: string; modelo: string } | null>(null)
  const [archivo, setArchivo] = useState('')
  const entrada = useRef<HTMLInputElement>(null)

  async function elegir(f: File | undefined) {
    if (!f) return
    setError(''); setPrevia(null); setArchivo(f.name); setCargando(true)
    try {
      const r = await leerDocumento<T>(f, tipo)
      setPrevia(r)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  function aplicar() {
    if (!previa) return
    onLeido(previa.datos)
    setPrevia(null); setArchivo('')
    if (entrada.current) entrada.current.value = ''
  }

  const campos = previa
    ? Object.entries(previa.datos as Record<string, unknown>)
        .filter(([k]) => k !== 'faltantes')
    : []
  const conDato = campos.filter(([, v]) =>
    Array.isArray(v) ? v.length > 0 : String(v ?? '').trim() !== '')
  const estudiantes = previa
    ? (previa.datos as unknown as { estudiantes?: unknown[] }).estudiantes ?? []
    : []

  return (
    <div className="tarjeta" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Icono nombre="ia" tam={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tipo-subtitulo">
            {titulo ?? (tipo === 'informe'
              ? 'Cargar desde el informe remitido'
              : 'Cargar desde el proyecto remitido')}
          </div>
          <p className="tipo-nota" style={{ margin: '4px 0 12px' }}>
            {ayuda ?? 'Word, ODT o PDF. Se leen los campos del formato oficial y se ' +
              'proponen para que usted revise. No se guarda nada hasta que confirme.'}
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              ref={entrada}
              id={`archivo-${tipo}`}
              type="file"
              accept=".docx,.odt,.pdf,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text"
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
              onChange={(e) => void elegir(e.target.files?.[0])}
              disabled={cargando}
            />
            <label htmlFor={`archivo-${tipo}`} className="btn btn-tonal"
                   style={{ cursor: cargando ? 'progress' : 'pointer' }}>
              <Icono nombre="subir" tam={18} />
              {cargando ? 'Leyendo el documento…' : 'Elegir un archivo'}
            </label>
            {archivo && !cargando && (
              <span className="tipo-nota" style={{ wordBreak: 'break-all' }}>{archivo}</span>
            )}
          </div>

          <Aviso>{error}</Aviso>

          {previa && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="chip chip-ok">
                  {conDato.length} de {campos.length} campos con dato
                </span>
                {estudiantes.length > 0 && (
                  <span className="chip chip-primario">
                    {estudiantes.length} estudiantes en la nómina
                  </span>
                )}
                <span className="chip">{previa.modelo}</span>
              </div>

              {previa.datos.faltantes && previa.datos.faltantes.length > 0 && (
                <p className="tipo-nota" style={{ margin: '10px 0 0' }}>
                  <strong>No encontró en el documento:</strong>{' '}
                  {previa.datos.faltantes.join(', ')}.
                </p>
              )}

              <details style={{ marginTop: 10 }}>
                <summary className="btn btn-ghost" style={{ padding: 0 }}>
                  Ver lo que leyó, campo por campo
                </summary>
                <div className="fc-scroll" style={{ marginTop: 10, maxHeight: 320 }}>
                  <table className="table">
                    <thead><tr><th>Campo</th><th>Valor leído</th></tr></thead>
                    <tbody>
                      {campos.map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</td>
                          <td style={{ maxWidth: '52ch' }}>
                            {Array.isArray(v)
                              ? (v.length === 0
                                  ? <span className="tenue">—</span>
                                  : <span>{v.length} elemento{v.length === 1 ? '' : 's'}: {
                                      v.map((x) => typeof x === 'string' ? x
                                        : (x as { nombre?: string })?.nombre ?? '—').join(' · ')
                                    }</span>)
                              : String(v ?? '').trim() === ''
                                ? <span className="tenue">—</span>
                                : String(v).slice(0, 400)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={aplicar}>
                  Volcar al formulario
                </button>
                <button className="btn btn-ghost" onClick={() => { setPrevia(null); setArchivo('') }}>
                  Descartar
                </button>
              </div>
              <p className="tipo-nota" style={{ margin: '10px 0 0' }}>
                Se completan los campos del formulario, que sigue sin guardarse. Revise
                especialmente fechas y nómina antes de confirmar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
