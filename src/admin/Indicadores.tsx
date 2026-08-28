import { useEffect, useState } from 'react'
import { indicadores, periodos } from '../data/panel'
import type { Indicadores as Ind } from '../lib/tipos'
import { mesLargo, descargarCSV, hoyAsuncion, numero } from '../lib/formato'
import { Cargando, Aviso, Dato } from '../ui/piezas'

export default function Indicadores() {
  const [meses, setMeses] = useState<string[]>([])
  const [mes, setMes] = useState(hoyAsuncion().slice(0, 7))
  const [ind, setInd] = useState<Ind | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    periodos()
      .then((ps) => {
        const lista = ps.map((p) => p.periodo)
        const actual = hoyAsuncion().slice(0, 7)
        setMeses(lista.includes(actual) ? lista : [actual, ...lista])
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    setInd(null)
    indicadores(mes).then(setInd).catch((e: Error) => setError(e.message))
  }, [mes])

  function exportar() {
    if (!ind) return
    const filas = ind.bloques.flatMap((b) =>
      b.items.map((it) => ({
        bloque: `${b.n}. ${b.titulo}`, indicador: it.label,
        valor: it.valor, unidad: it.unidad, origen: it.origen,
      })))
    descargarCSV(`informe-dtc-${mes}`, filas)
  }

  if (error) return <Aviso>{error}</Aviso>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 24, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '44ch' }}>
          <div className="eyebrow">
            Informe mensual de Extensión y Vinculación — Docente de Tiempo Completo
          </div>
          <h1 style={{ fontSize: 36, lineHeight: 1.1, marginTop: 8, textTransform: 'capitalize' }}>
            {mesLargo(mes)}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <select className="input input-linea" style={{ width: 'auto' }} aria-label="Período"
                  value={mes} onChange={(e) => setMes(e.target.value)}>
            {meses.map((m) => (
              <option key={m} value={m} style={{ textTransform: 'capitalize' }}>{mesLargo(m)}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={exportar} disabled={!ind}>
            Exportar indicadores
          </button>
        </div>
      </div>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />

      {!ind ? <Cargando /> : (
        <>
          <div className="fc-grid" style={{ marginBottom: 34 }}>
            <Dato label="Satisfacción (CSAT)" valor={`${ind.calidad.csat}%`}
                  nota={`sobre ${numero(ind.calidad.respuestas)} evaluaciones`} />
            <Dato label="Recomendación neta (NPS)"
                  valor={ind.calidad.nps > 0 ? `+${ind.calidad.nps}` : String(ind.calidad.nps)}
                  nota="promotores menos detractores" />
            <Dato label="Valoración media" valor={ind.calidad.promedio || '—'}
                  nota="de 1 a 5, seis dimensiones" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
            {ind.bloques.map((b) => (
              <div key={b.n}>
                <h2 style={{ fontSize: 25 }}>{b.n}. {b.titulo}</h2>
                <div className="fc-scroll" style={{ marginTop: 10 }}>
                  <table className="table" style={{ minWidth: 640 }}>
                    <thead>
                      <tr>
                        <th>Indicador</th>
                        <th style={{ textAlign: 'right' }}>Valor</th>
                        <th>Unidad</th><th>Origen del dato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.items.map((it) => (
                        <tr key={it.label}>
                          <td>{it.label}</td>
                          <td className="numeral" style={{ textAlign: 'right',
                                                           fontFamily: 'var(--serif)', fontSize: 18 }}>
                            {it.valor}
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>{it.unidad}</td>
                          <td style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>{it.origen}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, color: 'var(--tenue)', marginTop: 30, maxWidth: '85ch' }}>
            Los bloques 1, 7 y 8 del formulario oficial —datos generales, resumen ejecutivo y
            evidencias— se completan a mano. Los tres indicadores marcados «Carga de la
            Coordinación» se cargan en la tabla de indicadores manuales; el resto se calcula.
          </p>
        </>
      )}
    </div>
  )
}
