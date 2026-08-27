-- Texto de consentimiento y aviso previo, versión 1.0.
-- Responsable del tratamiento: Abg. Patricia Sequeira — extensionderecho@unida.edu.py
-- Modificar este texto NO se hace con UPDATE: se inserta una versión 1.1 y se
-- cierra la anterior con `vigente_hasta`. Cada inscripción conserva la versión
-- que su titular aceptó (prueba del consentimiento, art. 6.° Ley N° 7593/2025).

insert into public.consentimiento_versiones
  (version, aviso, texto_tratamiento, texto_sensibles, texto_imagen, texto_comunicaciones)
values (
  '1.0',
  jsonb_build_array(
    jsonb_build_object('rotulo','Responsable','texto',
      'Facultad de Ciencias Jurídicas y Sociales — Universidad de la Integración de las Américas, con domicilio en Asunción. Responsable del tratamiento: Abg. Patricia Sequeira. Contacto: extensionderecho@unida.edu.py.'),
    jsonb_build_object('rotulo','Finalidad','texto',
      'Gestión de la inscripción, control de asistencia por jornada, emisión de certificados, evaluación de la satisfacción de la actividad y elaboración de estadísticas institucionales de extensión.'),
    jsonb_build_object('rotulo','Base legal','texto',
      'Consentimiento del titular, artículo 5.° numeral 1 de la Ley N° 7593/2025.'),
    jsonb_build_object('rotulo','Datos que se tratan','texto',
      'Los declarados en este formulario. Los marcados con asterisco son necesarios para inscribirlo; el resto es voluntario.'),
    jsonb_build_object('rotulo','Datos sensibles','texto',
      'Los requerimientos de accesibilidad o salud son datos sensibles conforme al artículo 3.° numeral 7. Su declaración es voluntaria y requiere consentimiento expreso en casilla separada. Omitirlos no impide inscribirse.'),
    jsonb_build_object('rotulo','Uso de imagen','texto',
      'La actividad puede ser fotografiada o grabada para la difusión institucional de la Facultad. Esta autorización está comprendida en el consentimiento general y puede revocarse en cualquier momento escribiendo a extensionderecho@unida.edu.py, sin que ello afecte su inscripción ni su certificado.'),
    jsonb_build_object('rotulo','Evaluación de satisfacción','texto',
      'Al finalizar la actividad se le invita a responder una encuesta breve de satisfacción. Es voluntaria y sus resultados se procesan únicamente de forma agregada y sin identificar a quien responde.'),
    jsonb_build_object('rotulo','Conservación','texto',
      'Los datos identificables se conservan veinticuatro meses desde el cierre de la actividad y luego se anonimizan. Los datos sensibles se eliminan antes.'),
    jsonb_build_object('rotulo','Destinatarios','texto',
      'Dirección, Coordinación de Extensión, Secretaría y el docente responsable de la actividad. No se ceden a terceros ni se transfieren fuera de la República del Paraguay.'),
    jsonb_build_object('rotulo','Decisiones automatizadas','texto',
      'No se elaboran perfiles ni se adoptan decisiones automatizadas sobre su persona.'),
    jsonb_build_object('rotulo','Derechos','texto',
      'Acceso, rectificación, oposición, supresión y portabilidad, además de la revocación del consentimiento en cualquier momento, de forma gratuita y por medios sencillos, a través de extensionderecho@unida.edu.py o de la ruta /derechos. La solicitud se atiende en un plazo máximo de treinta días corridos. Sin perjuicio de la garantía constitucional de habeas data, puede reclamar ante la Agencia Nacional de Protección de Datos Personales.')),
  'Presté mi consentimiento libre, previo, informado e inequívoco para que la Facultad trate los datos declarados con la finalidad de gestionar esta inscripción, el registro de asistencia, la certificación, la evaluación de satisfacción y las estadísticas institucionales de extensión, y autorizo el uso de las fotografías y grabaciones de la actividad en la difusión institucional de la Facultad. Puedo revocar esta última autorización por separado y en cualquier momento, sin afectar mi inscripción.',
  'Consiento de manera expresa el tratamiento de los datos sensibles que declaro en este formulario, con el único fin de garantizar mi participación en condiciones adecuadas.',
  'Comprendido en el consentimiento general: uso de fotografías y grabaciones de la actividad en la difusión institucional de la Facultad, revocable por separado.',
  'Deseo recibir información sobre futuras actividades de extensión de la Facultad.'
)
on conflict (version) do nothing;
