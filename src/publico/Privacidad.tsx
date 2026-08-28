import { useEffect, useState } from 'react'
import { consentimientoVigente } from '../data/publico'
import type { Consentimiento } from '../lib/tipos'
import { CORREO, RESPONSABLE, FACULTAD, AUTORIDAD, LEY, RETENCION_MESES } from '../lib/institucion'
import { Cargando } from '../ui/piezas'
import Marco from './Marco'

const CLAUSULAS = [
  { titulo: 'Identidad del responsable', base: 'Artículo 27 numeral 2',
    texto: `${FACULTAD}, con domicilio en Asunción, es responsable del tratamiento. La responsable designada es la ${RESPONSABLE}. Sus consultas en materia de datos personales se dirigen a ${CORREO}.` },
  { titulo: 'Finalidad determinada', base: 'Artículos 4.° inciso c) y 27 numeral 3',
    texto: 'Los datos se recogen para gestionar la inscripción, registrar la asistencia de cada jornada, emitir certificados, evaluar la satisfacción de la actividad y elaborar las estadísticas institucionales de extensión. No se utilizan para ninguna finalidad incompatible con estas.' },
  { titulo: 'Base legal', base: 'Artículos 5.° numeral 1 y 6.°',
    texto: 'El tratamiento se funda en el consentimiento previo, libre, informado e inequívoco del titular, prestado mediante una acción afirmativa clara y separada del resto del formulario.' },
  { titulo: 'Datos sensibles', base: 'Artículos 3.° numeral 7 y 20 numeral 1',
    texto: 'Los requerimientos de accesibilidad o salud constituyen datos sensibles y solo se tratan con consentimiento expreso, otorgado en una casilla independiente. Quien no desee declararlos puede dejar el campo vacío sin perder la inscripción.' },
  { titulo: 'Uso de imagen', base: 'Artículos 6.° y 27',
    texto: 'La actividad puede ser fotografiada o grabada para la difusión institucional. Esa autorización está comprendida en el consentimiento general del formulario y se registra por separado, de modo que puede revocarse en cualquier momento sin afectar la inscripción ni el certificado.' },
  { titulo: 'Minimización', base: 'Artículo 4.° inciso d)',
    texto: 'Se solicitan únicamente los datos necesarios y proporcionales a la actividad. La cédula se muestra enmascarada en el panel y el registro de asistencia no captura dirección IP, ubicación ni identificación del dispositivo.' },
  { titulo: 'Plazo de conservación', base: 'Artículos 4.° inciso e) y 31 numeral 3',
    texto: `Los datos identificables se conservan ${RETENCION_MESES} meses desde el cierre de la actividad. Vencido el plazo se anonimizan y solo persiste el agregado estadístico necesario para el informe de extensión. Los datos sensibles se eliminan, no se anonimizan.` },
  { titulo: 'Evaluación de satisfacción', base: 'Artículo 4.° incisos c) y d)',
    texto: 'La encuesta posterior a la actividad es voluntaria. Se vincula a la inscripción únicamente para evitar respuestas duplicadas; los resultados y los comentarios se consultan de forma agregada y sin identificar a quien respondió.' },
  { titulo: 'Derechos del titular', base: 'Artículos 26 a 32',
    texto: 'El titular puede solicitar acceso, rectificación, oposición, supresión y portabilidad, así como revocar el consentimiento en cualquier momento y de forma gratuita. La solicitud se atiende en un plazo máximo de treinta días corridos por medios sencillos y sin costo.' },
  { titulo: 'Seguridad e incidentes', base: 'Artículos 16 y 17',
    texto: `Se aplican cifrado en tránsito y en reposo, cifrado de columna para la cédula y los datos sensibles, control de acceso por rol y registro de auditoría inalterable. Ante un incidente de seguridad se notifica a la ${AUTORIDAD} y a las personas afectadas dentro de las setenta y dos horas.` },
  { titulo: 'Reclamo ante la autoridad', base: 'Artículos 34 y 41',
    texto: `Sin perjuicio de la garantía constitucional de habeas data del artículo 135 de la Constitución Nacional, el titular puede reclamar de manera gratuita ante la ${AUTORIDAD}.` },
]

export default function Privacidad() {
  const [c, setC] = useState<Consentimiento | null>(null)
  useEffect(() => { consentimientoVigente().then(setC).catch(() => setC(null)) }, [])

  return (
    <Marco ancho={780}>
      <div className="eyebrow">
        {c ? `Texto vigente — versión ${c.version}` : 'Política de tratamiento de datos'}
      </div>
      <h1 style={{ fontSize: 36, lineHeight: 1.12, marginTop: 8 }}>
        Cláusula de consentimiento y aviso de privacidad
      </h1>
      <p style={{ color: 'var(--tenue-2)', margin: '14px 0 0' }}>
        Redactada según la {LEY} de Protección de Datos Personales en la República del Paraguay.
        Cada inscripción conserva la versión que la persona aceptó, con fecha y hora; una
        modificación de este texto crea una versión nueva y no altera las anteriores.
      </p>
      <hr className="rule-strong" style={{ margin: '28px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {CLAUSULAS.map((cl) => (
          <div key={cl.titulo}>
            <h2 style={{ fontSize: 21 }}>{cl.titulo}</h2>
            <p style={{ color: 'var(--md-on-surface-variant)', margin: '8px 0 0' }}>{cl.texto}</p>
            <div style={{ fontSize: 13, color: 'var(--tenue)', marginTop: 6, fontStyle: 'italic' }}>
              {cl.base}
            </div>
          </div>
        ))}
      </div>
      {!c && <div style={{ marginTop: 24 }}><Cargando texto="Cargando la versión vigente" /></div>}
    </Marco>
  )
}
