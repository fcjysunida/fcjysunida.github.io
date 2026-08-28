import { useEffect, useMemo, useState } from 'react'
import {
  listarInscripciones, editarInscripcion, exportarInscripciones, cedulaDe, sensiblesDe,
} from '../data/panel'
import type { Inscripcion, EstadoInscripcion } from '../lib/tipos'
import { descargarCSV, fechaHora } from '../lib/formato'
import { usePermisos } from '../lib/sesion'
import { Cargando, Aviso } from '../ui/piezas'
import { useActividadElegida, Selector } from './SelectorActividad'

const ESTADOS: { id: EstadoInscripcion; label: string }[] = [
  { id: 'confirmada', label: 'Confirmada' },
  { id: 'en_espera',  label: 'En espera' },
  { id: 'anulada',    label: 'Anulada' },
]
const CONDICIONES: Record<string, string> = {
  estudiante: 'Estudiante', docente: 'Docente', egresado: 'Egresado', externo: 'Externo',
}

export default function Inscripciones() {
  const { acts, actividad, id, elegir, error } = useActividadElegida()
  const permisos = usePermisos()
  const [filas, setFilas] = useState<Inscripcion[] | null>(null)
  const [filtro, setFiltro] = useState('')
  const [aviso, setAviso] = useState('')
  const [editando, setEditando] = useState<Inscripcion | null>(null)
  const [revelada, setRevelada] = useState<Record<string, string>>({})

  const recargar = () => {
    if (!id) return
    setFilas(null)
    listarInscripciones(id).then(setFilas).catch((e: Error) => setAviso(e.message))
  }
  useEffect(recargar, [id])

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return filas ?? []
    return (filas ?? []).filter((i) =>
      `${i.nombre} ${i.email} ${i.institucion ?? ''} ${i.ciudad ?? ''}`.toLowerCase().includes(q))
  }, [filas, filtro])

  const activas = (filas ?? []).filter((i) => i.estado !== 'anulada').length

  async function exportar() {
    const motivo = window.prompt(
      'La exportación queda asentada en el registro de auditoría.\n¿Con qué motivo la solicita?',
      'certificación',
    )
    if (!motivo || motivo.trim() === '') return
    let incluirCedula = false
    if (permisos.exportaCedula) {
      incluirCedula = window.confirm(
        'La exportación nace sin cédula, por minimización.\n\n' +
        'Aceptar: incluir la cédula completa (queda registrado).\n' +
        'Cancelar: exportar con la cédula enmascarada.',
      )
    }
    try {
      const datos = await exportarInscripciones(id, motivo.trim(), incluirCedula)
      if (datos.length === 0) { setAviso('No hay inscripciones para exportar.'); return }
      descargarCSV(`inscripciones-${actividad?.titulo.slice(0, 40) ?? id}`, datos)
      setAviso('')
    } catch (e) { setAviso((e as Error).message) }
  }

  async function revelarCedula(i: Inscripcion) {
    const motivo = window.prompt(
      'Ver la cédula completa queda asentado en auditoría con su usuario y rol.\n¿Motivo?',
    )
    if (!motivo || motivo.trim() === '') return
    try {
      const v = await cedulaDe(i.id, motivo.trim())
      setRevelada((s) => ({ ...s, [i.id]: v ?? '—' }))
    } catch (e) { setAviso((e as Error).message) }
  }

  async function verSensibles(i: Inscripcion) {
    const motivo = window.prompt('Consultar datos sensibles queda asentado en auditoría.\n¿Motivo?')
    if (!motivo || motivo.trim() === '') return
    try {
      const d = await sensiblesDe(i.id, motivo.trim())
      const otras = Object.entries(d.respuestas ?? {})
        .map(([k, v]) => `${k}: ${v}`).join('\n')
      window.alert(
        `Datos sensibles de ${i.nombre}\n\n` +
        `Accesibilidad: ${d.accesibilidad ?? '—'}\n` +
        `Teléfono: ${d.telefono ?? '—'}` + (otras ? `\n${otras}` : ''),
      )
    } catch (e) { setAviso((e as Error).message) }
  }

  if (error) return <Aviso>{error}</Aviso>
  if (!acts) return <Cargando />
  if (acts.length === 0) return <p className="tenue">Todavía no hay actividades.</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 24, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '40ch' }}>
          <div className="eyebrow">Inscripciones</div>
          <h1 className="tipo-display">
            {actividad?.titulo ?? '—'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Selector acts={acts} id={id} elegir={elegir} />
          <input className="input input-linea" style={{ width: 190 }} value={filtro}
                 aria-label="Buscar inscripto" placeholder="Buscar inscripto"
                 onChange={(e) => setFiltro(e.target.value)} />
          {permisos.exporta && (
            <button className="btn btn-secondary" onClick={() => void exportar()}>Exportar</button>
          )}
        </div>
      </div>

      <hr className="rule-strong" style={{ margin: '28px 0 8px' }} />
      <Aviso>{aviso}</Aviso>

      {!filas ? <Cargando /> : filas.length === 0 ? (
        <p className="tenue" style={{ marginTop: 20 }}>Esta actividad todavía no tiene inscripciones.</p>
      ) : (
        <>
          <div className="fc-scroll">
            <table className="table" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th>Nombre</th><th>Cédula</th><th>Correo</th><th>Condición</th>
                  <th>Matrícula</th><th>Institución</th><th>Cert.</th>
                  <th style={{ textAlign: 'right' }}>Asist.</th><th>Estado</th><th />
                </tr>
              </thead>
              <tbody>
                {visibles.map((i) => (
                  <tr key={i.id}>
                    <td className="obra">{i.nombre}</td>
                    <td className="numeral" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                      {revelada[i.id] ?? i.cedula_mascara ?? '—'}
                      {permisos.veCedula && !revelada[i.id] && (
                        <button className="btn btn-ghost" style={{ fontSize: 12, marginLeft: 6 }}
                                onClick={() => void revelarCedula(i)}>ver</button>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>{i.email}</td>
                    <td style={{ fontSize: 13 }} title={i.condicion_origen ?? undefined}>
                      {CONDICIONES[i.condicion] ?? i.condicion}
                      {i.verificado_en_padron && (
                        <span title="Verificado contra el padrón académico"
                              style={{ color: 'var(--rojo-oscuro)', marginLeft: 4 }}>✓</span>
                      )}
                      {i.condicion_declarada && i.condicion_declarada !== i.condicion && (
                        <span className="tenue" style={{ display: 'block', fontSize: 12 }}>
                          declaró {CONDICIONES[i.condicion_declarada] ?? i.condicion_declarada}
                        </span>
                      )}
                    </td>
                    <td className="numeral" style={{ fontSize: 13 }}>{i.matricula ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{i.institucion ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{i.requiere_certificado ? 'Sí' : 'No'}</td>
                    <td className="numeral" style={{ textAlign: 'right' }}>{i.jornadas_asistidas}</td>
                    <td style={{ fontSize: 13 }}>
                      {ESTADOS.find((e) => e.id === i.estado)?.label ?? i.estado}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {permisos.edita && (
                          <button className="btn btn-ghost" style={{ fontSize: 13 }}
                                  onClick={() => setEditando(i)}>Editar</button>
                        )}
                        {permisos.edita && i.estado !== 'anulada' && (
                          <button className="btn btn-ghost" style={{ fontSize: 13 }}
                                  onClick={() => {
                                    if (!window.confirm(`¿Anular la inscripción de ${i.nombre}?`)) return
                                    void editarInscripcion(i.id, { estado: 'anulada' })
                                      .then(recargar).catch((e: Error) => setAviso(e.message))
                                  }}>Anular</button>
                        )}
                        {i.declaro_sensibles && permisos.veSensibles && (
                          <button className="btn btn-ghost" style={{ fontSize: 13 }}
                                  onClick={() => void verSensibles(i)}>Sensibles</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 13, color: 'var(--tenue)', marginTop: 16, maxWidth: '85ch' }}>
            {activas} inscripciones activas de {filas.length} registradas.{' '}
            {filas.filter((i) => i.verificado_en_padron).length} verificadas contra el padrón
            académico (marcadas con ✓); el resto conserva la condición declarada.{' '}
            {permisos.veCedula
              ? 'La cédula se muestra enmascarada; revelarla exige declarar un motivo y queda en auditoría.'
              : 'La cédula se muestra enmascarada conforme al principio de minimización; su rol no accede al valor completo.'}{' '}
            La exportación exige declarar un motivo y también se audita.
          </p>
        </>
      )}

      {editando && (
        <Editor inscripcion={editando} alCerrar={() => setEditando(null)}
                alGuardar={(cambios) => {
                  void editarInscripcion(editando.id, cambios)
                    .then(() => { setEditando(null); recargar() })
                    .catch((e: Error) => { setAviso(e.message); setEditando(null) })
                }} />
      )}
    </div>
  )
}

function Editor({
  inscripcion, alCerrar, alGuardar,
}: {
  inscripcion: Inscripcion
  alCerrar: () => void
  alGuardar: (c: { nombre: string; email: string; estado: EstadoInscripcion }) => void
}) {
  const [nombre, setNombre] = useState(inscripcion.nombre)
  const [email, setEmail] = useState(inscripcion.email)
  const [estado, setEstado] = useState<EstadoInscripcion>(inscripcion.estado)

  return (
    <div role="dialog" aria-modal="true" aria-label="Editar inscripción"
         onClick={(e) => { if (e.target === e.currentTarget) alCerrar() }}
         style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--md-inverse-surface) 55%, transparent)', zIndex: 40,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="tarjeta" style={{ padding: 30, width: '100%', maxWidth: 460,
                                        display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 className="tipo-titulo">Editar inscripción</h2>
        <div className="field">
          <label htmlFor="e-nombre">Nombre y apellido</label>
          <input id="e-nombre" className="input" value={nombre}
                 onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="e-email">Correo electrónico</label>
          <input id="e-email" className="input" type="email" value={email}
                 onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="e-estado">Estado</label>
          <select id="e-estado" className="input" value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoInscripcion)}>
            {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => alGuardar({ nombre, email, estado })}>
            Guardar
          </button>
          <button className="btn btn-secondary" onClick={alCerrar}>Cancelar</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--tenue)', margin: 0 }}>
          La modificación se asienta en el registro de auditoría con usuario, rol y los campos
          alcanzados. Inscripción registrada el {fechaHora(inscripcion.creado_en)}.
        </p>
      </div>
    </div>
  )
}
