import { useEffect, useState } from 'react'
import { satisfaccionDe, comentariosDe } from '../data/panel'
import type { Satisfaccion } from '../lib/tipos'
import { numero } from '../lib/formato'
import { Cargando, Aviso } from '../ui/piezas'
import { useActividadElegida, Selector } from './SelectorActividad'

const DIMENSIONES: { clave: keyof Satisfaccion; rotulo: string }[] = [
  { clave: 'contenido',     rotulo: 'Pertinencia y calidad del contenido' },
  { clave: 'expositor',     rotulo: 'Desempeño de quien expuso' },
  { clave: 'organizacion',  rotulo: 'Organización y cumplimiento de horarios' },
  { clave: 'recursos',      rotulo: 'Materiales, recursos y ambiente' },
  { clave: 'aplicabilidad', rotulo: 'Utilidad y aplicabilidad de lo aprendido' },
]

export default function Calidad() {
  const { acts, actividad, id, elegir, error } = useActividadElegida()
  const [s, setS] = useState<Satisfaccion | null>(null)
  const [comentarios, setComentarios] = useState<string[]>([])
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (!id) return
    setS(null); setComentarios([])
    satisfaccionDe(id).then(setS).catch((e: Error) => setAviso(e.message))
    comentariosDe(id).then((c) => setComentarios(c.map((x) => x.comentario)))
      .catch(() => setComentarios([]))
  }, [id])

  if (error) return <Aviso>{error}</Aviso>
  if (!acts) return <Cargando />
  if (acts.length === 0) return <p className="tenue">Todavía no hay actividades.</p>

  const tasa = actividad && actividad.asistencias > 0 && s
    ? Math.round((s.respuestas / actividad.asistencias) * 100) : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 24, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '44ch' }}>
          <div className="eyebrow">Calidad percibida — ISO 10004:2018 y ISO 9001:2015 § 9.1.2</div>
          <h1 style={{ fontSize: 32, lineHeight: 1.15, marginTop: 6 }}>{actividad?.titulo ?? '—'}</h1>
        </div>
        <Selector acts={acts} id={id} elegir={elegir} />
      </div>

      <hr className="rule-strong" style={{ margin: '28px 0' }} />
      <Aviso>{aviso}</Aviso>

      {!s ? <Cargando /> : s.respuestas === 0 ? (
        <p className="tenue">
          Todavía no hay evaluaciones. La encuesta se ofrece en el mismo enlace de asistencia,
          después de que la persona registra su presencia.
        </p>
      ) : (
        <>
          <div className="fc-grid" style={{ marginBottom: 38 }}>
            <Cifra label="Satisfacción (CSAT)" valor={`${s.csat}%`}
                   nota="respuestas de 4 y 5 sobre el total" />
            <Cifra label="Recomendación neta (NPS)"
                   valor={s.nps > 0 ? `+${s.nps}` : String(s.nps)}
                   nota={`${s.promotores} promotores · ${s.pasivos} pasivos · ${s.detractores} detractores`} />
            <Cifra label="Valoración media" valor={String(s.promedio ?? '—')}
                   nota="de 1 a 5, seis dimensiones" />
            <Cifra label="Evaluaciones recibidas" valor={numero(s.respuestas)}
                   nota={actividad && actividad.asistencias > 0
                     ? `${tasa}% de las ${actividad.asistencias} asistencias`
                     : 'sobre las asistencias registradas'} />
          </div>

          <h2 style={{ fontSize: 25 }}>Por dimensión</h2>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {DIMENSIONES.map((d) => {
              const v = s[d.clave] as number | null
              return (
                <div key={String(d.clave)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                alignItems: 'baseline', gap: 16 }}>
                    <span style={{ fontSize: 14 }}>{d.rotulo}</span>
                    <span className="numeral" style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>
                      {v ?? '—'}
                    </span>
                  </div>
                  <div className="barra">
                    <span style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <hr className="rule-strong" style={{ margin: '38px 0 20px' }} />
          <h2 style={{ fontSize: 25 }}>Comentarios</h2>
          <p style={{ fontSize: 14, color: 'var(--tenue-2)', maxWidth: '70ch', marginTop: 8 }}>
            Se muestran sin identidad y sin orden cronológico, para que no puedan reconstruirse
            a partir del momento del registro. Son insumo de mejora, no traza de personas.
          </p>
          {comentarios.length === 0 ? (
            <p className="tenue" style={{ marginTop: 16 }}>Sin comentarios escritos.</p>
          ) : (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column' }}>
              {comentarios.map((c, i) => (
                <p key={i} style={{ borderTop: '1px solid var(--regla)', padding: '16px 0',
                                    margin: 0, fontFamily: 'var(--serif)', fontSize: 17 }}>
                  «{c}»
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Cifra({ label, valor, nota }: { label: string; valor: string; nota: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--tenue)' }}>{label}</div>
      <div className="numeral" style={{ fontFamily: 'var(--serif)', fontSize: 42,
                                        lineHeight: 1.05, marginTop: 2 }}>
        {valor}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(32,30,29,0.55)' }}>{nota}</div>
    </div>
  )
}
