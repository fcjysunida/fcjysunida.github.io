delete from norma_articulos;

insert into norma_articulos (norma, orden, numero, epigrafe, texto, ambito) values

 ('cn-1992', 1, 'Artículo 79', 'De las universidades e institutos superiores',
  'La finalidad principal de las universidades y de los institutos superiores será la formación profesional superior, la investigación científica y la tecnológica, así como la extensión universitaria.',
  array['extension']),

 ('ley-4995-2013', 1, 'Artículo 23', 'De los fines de las universidades',
  'Las Universidades tendrán los siguientes fines: […] g. La extensión universitaria.',
  array['extension']),

 ('regl-proyeccion', 1, 'Artículo 1°', 'Objeto',
  'El presente Reglamento tiene como objetivo ordenar y establecer los procedimientos para la elaboración, aprobación, ejecución, supervisión y evaluación de las actividades de proyección social y extensión universitaria en la UNIDA.',
  array['extension']),

 ('regl-proyeccion', 2, 'Artículo 2°', 'Qué es proyección social y qué es extensión',
  'Se consideran actividades de Proyección Social aquellas en que la universidad se vincula directamente con las comunidades de su entorno, captando sus necesidades concretas para buscar su solución; asimismo, la participación en proyectos de desarrollo local y regional. Se consideran actividades de Extensión Universitaria, aquellas por las que la universidad amplía y divulga sus servicios educativos, a favor de quienes no son sus estudiantes regulares, mediante la organización de diplomados, congresos, simposios, cursos extracurriculares, seminarios, talleres, forums, conferencias, charlas y otros, que puedan ser gratuitos o pagados y puedan conducir a un diploma o certificado. La extensión universitaria y la proyección social no deben ser actividades aisladas sino que deben estar interrelacionadas con los procesos de aprendizaje y la investigación.',
  array['extension']),

 ('regl-proyeccion', 3, 'Artículo 3°', 'Iniciativa de las carreras y dependencia del Área',
  'Las actividades de extensión y proyección universitaria se realizan por iniciativa de las Carreras Profesionales; y se planifican, ejecutan y evalúan a través del Área de Proyección Social y Extensión Universitaria, dependiente de la Dirección Académica.',
  array['extension']),

 ('regl-proyeccion', 4, 'Artículo 7°', 'Quiénes participan',
  'Participan en los programas, proyectos y actividades de proyección social y extensión universitaria los profesores y alumnos de las Carreras de la UNIDA.',
  array['extension']),

 ('regl-proyeccion', 5, 'Artículo 8°', 'Responsable de cada actividad',
  'Cada programa, proyecto o actividad de proyección social y extensión universitaria tendrá un Responsable quien se encargará de la formulación, ejecución y presentación de resultados.',
  array['extension']),

 ('regl-proyeccion', 6, 'Artículo 9°', 'El responsable es un docente',
  'El Responsable de la actividad de proyección social y extensión universitaria es un docente, preferentemente a tiempo completo.',
  array['extension', 'docente']),

 ('regl-proyeccion', 7, 'Artículo 11°', 'Perfil que debe tener toda propuesta',
  'En forma general, el perfil de una actividad, proyecto o programa de proyección social o extensión universitaria debe tener los siguientes ítems: a) Título; b) Antecedentes (opcional); c) Justificación; d) Objetivos; e) Potenciales beneficiarios; f) Impacto de la actividad; g) Medios de verificación; h) Cronograma o fechas en que se realiza; i) Participantes en la organización del evento; j) Presupuesto (indicar la fuente de financiamiento).',
  array['extension']),

 ('regl-proyeccion', 8, 'Artículo 13°', 'Aprobación previa',
  'Toda actividad de proyección social y de extensión universitaria, debe tener la aprobación del Área de Proyección Social y Extensión Universitaria de la UNIDA, previa a su ejecución.',
  array['extension']),

 ('regl-proyeccion', 9, 'Artículo 16°', 'Qué no cuenta como extensión',
  'No se califica como actividad de proyección social o de extensión universitaria aquellas organizadas por otras instituciones locales, regionales o nacionales y en los que cualquier docente o funcionario de la UNIDA participe como ponente o asistente.',
  array['extension']),

 ('regl-proyeccion', 10, 'Artículo 19°', 'Informe final de la actividad',
  'Al finalizar la actividad, el docente Responsable presenta al Área de Proyección Social y Extensión Universitaria informes de la actividad, acompañadas de sus respectivas evidencias, los que contendrán los siguientes puntos: Actividad; Fecha(s) de ejecución; Responsable(s); Integrantes (docentes, alumnos); Público beneficiado (N°); Recursos utilizados (Recursos Propios, Otros Recursos); Ingresos generados (utilidad, si lo hubiera).',
  array['extension']),

 ('regl-proyeccion', 11, 'Artículo 20°', 'Evidencias que acompañan el informe',
  'Los informes deben ir acompañados de las evidencias correspondientes, tales como: copia de Resolución que autoriza la actividad, si lo hubiera, afiches, trípticos, copia del certificado expedido, relación de participantes, fotografías, si los hubieran, y otras que el responsable de la actividad crea conveniente adjuntar.',
  array['extension']),

 ('regl-general-2025', 1, 'Artículo 15', 'De los Decanos',
  'Cada facultad está a cargo de un decano, quien gestiona sus aspectos académicos, contando con el apoyo de uno o más coordinadores académicos.',
  array['gobierno']),

 ('regl-general-2025', 2, 'Artículo 120', 'Las pasantías como requisito de egreso',
  'Las pasantías pueden ser desarrolladas dentro de las diferentes carreras como requisito indispensable para el egreso y/o como una actividad complementaria dentro del área de formación del Estudiante.',
  array['pasantia']),

 ('regl-general-2025', 3, 'Artículo 122', 'Tipos de pasantía',
  'Los tipos de pasantías reconocidos por la Universidad son: a) Las que refieren a una participación del estudiante dentro de un proyecto de investigación científica o tecnológica. b) Las que refieren a una participación práctica en un instituto, empresa u organismo con el cual la Universidad tenga un Convenio o el estudiante gestione su ingreso.',
  array['pasantia']),

 ('regl-general-2025', 4, 'Artículo 124', 'Compromisos de las partes y cómputo de horas',
  'Deberán siempre quedar claramente establecidos los compromisos de las partes en cuanto al sitio de trabajo, asignación económica en el caso que corresponda, pólizas de seguros, tiempo de permanencia, instructor de pasantía y/o institucional y cualquier otro que se derive de la pasantía. […] c) La relación entre pasante y empresa o institución. Ésta será una relación eminentemente académica que no produzca estabilidad ni relación de dependencia laboral. d) El tiempo de duración de la pasantía será la cantidad de horas establecidas en la malla curricular de cada Carrera […]. Las horas de pasantías deben ser cumplidas dentro de las unidades convenidas. El no respeto de esta exigencia significará que NO HA SIDO CONCLUIDA, impidiendo la titulación del alumno.',
  array['pasantia']),

 ('regl-pasantia-derecho', 1, 'Art. 05', 'Requisito para el egreso',
  'Las Prácticas Pre-Profesionales y Pasantías constituyen un requisito para el egreso.',
  array['pasantia']),

 ('regl-pasantia-derecho', 2, 'Art. 07', 'Características',
  'Las Prácticas Pre-Profesionales y Pasantías, por su naturaleza, son de carácter práctico y de obligatoriedad para todos los estudiantes de la Carrera de Derecho, sus características son: a) Insustituible, ninguna otra acción la reemplaza. b) Obligatoria, para todos los estudiantes de la carrera a partir del sexto semestre de la misma. c) Integral, porque forma al estudiante en todos los aspectos de la vida profesional: conceptual, procedimental, actitudinal, ética y moral. d) Acumulativa, se registra progresivamente.',
  array['pasantia']),

 ('regl-pasantia-derecho', 3, 'Art. 11', 'Dónde se realizan',
  'Las Prácticas Pre-Profesionales y Pasantías pueden realizarse en un Instituto, Empresa u Organización Pública o Privada, con el cual la Universidad tenga un Convenio o el estudiante gestione su ingreso.',
  array['pasantia']),

 ('regl-pasantia-derecho', 4, 'Art. 14', 'Ficha de evaluación de la unidad receptora',
  'La Unidad receptora de Prácticas Pre-Profesionales y Pasantías tiene la obligación de informar sobre las prácticas realizadas por el estudiante, a través de las fichas de evaluación, cuyo formato es proporcionado por la Coordinación de Pasantías de la Carrera.',
  array['pasantia']),

 ('regl-pasantia-derecho', 5, 'Art. 15', 'Plazo para presentar el informe',
  'El estudiante que realiza la Práctica Pre-Profesional y Pasantía, al finalizar ésta, está obligado a presentar su Informe escrito a la Coordinación de Pasantías, dentro del término máximo de ocho días hábiles, bajo la responsabilidad que establezca la Carrera.',
  array['pasantia']),

 ('regl-pasantia-derecho', 6, 'Art. 16', 'Subsanación de observaciones',
  'De ser observado el Informe, la Coordinación de Pasantía pondrá a conocimiento del pasante, para que dentro del plazo de 8 días, pueda subsanar las observaciones. Pasado este término, el Informe se considerará como no presentado.',
  array['pasantia']),

 ('regl-pasantia-derecho', 7, 'Art. 17', 'Abandono por no presentar el informe',
  'La no presentación de los Informes se considera causal de abandono de las Prácticas Profesionales – Pasantías y, consecuentemente, la anulación de la inscripción de dicha práctica en el registro correspondiente, lo que se comunicará al Coordinador de la Carrera y al Pasante; este último tiene derecho a reinscribirse y empezar las prácticas en un nuevo periodo académico.',
  array['pasantia']),

 ('regl-pasantia-derecho', 8, 'Art. 23', 'Docente asesor',
  'El Coordinador de Pasantía designará un Docente Responsable de la Carrera como asesor de la Pasantía, previa autorización del Decano, quien tendrá a su cargo el acompañamiento de la actividad de los Estudiantes para el cumplimiento de la Práctica Profesional.',
  array['pasantia', 'docente']),

 ('regl-pasantia-derecho', 9, 'Art. 24', 'Sin cursos pendientes',
  'Las Prácticas Pre-Profesionales son actividades curriculares obligatorias e individuales que el estudiante realiza en una organización, empresa o institución privada o pública, en áreas afines al ejercicio de la Carrera Profesional a la que pertenece […]. Para efectos de la realización de las Prácticas Profesionales, los estudiantes no deben tener cursos pendientes.',
  array['pasantia']),

 ('regl-pasantia-derecho', 10, 'Art. 27', 'Informe de conformidad y plazo del acta',
  'Para el proceso de elaboración de las Actas de Prácticas Pre-Profesionales, se deberá contar con el informe de conformidad emitido por el Coordinador de Pasantías a la Coordinación de Carrera, en un plazo máximo de 30 días hábiles de haber concluido las Prácticas Pre-Profesionales; caso contrario, se invalidará la matrícula y el proceso académico administrativo.',
  array['pasantia']),

 ('regl-pasantia-derecho', 11, 'Art. 28', 'Calificación: 40 % empresa, 60 % universidad',
  'Para aprobar una Pasantía, el estudiante deberá haber obtenido un Informe favorable del responsable del organismo receptor en el que se confiera una calificación de por lo menos del 70 % del total. El sistema de Evaluación considera que el 40 % de la calificación total lo evalúa la Empresa y el 60 % la Universidad.',
  array['pasantia']),

 ('regl-pasantia-derecho', 12, 'Art. 29', 'Duración: 264 horas reloj',
  'La duración de las Pasantías debe estar adecuada para el cumplimiento de 264 horas reloj.',
  array['pasantia']),

 ('regl-pasantia-derecho', 13, 'Art. 30', 'Reprobación',
  'Los estudiantes que obtengan la calificación de reprobado, deberán repetir la Práctica Profesional en el semestre académico mediato posterior.',
  array['pasantia']),

 ('regl-pasantia-derecho', 14, 'Art. 34', 'Firma de la ficha de evaluación',
  'Las fichas de evaluación serán firmadas por la autoridad máxima de la Organización y por el Jefe del Área donde realizó su práctica.',
  array['pasantia']),

 ('regl-pasantia-derecho', 15, 'Art. 35', 'Convalidación para egresados',
  'Los egresados que vienen trabajando en alguna Entidad Estatal o Privada, por más de un año, en forma continua o acumulativa, realizando labores afines a la profesión, podrán solicitar la convalidación de las Prácticas Pre-Profesionales mediante una solicitud dirigida al Decano de la Facultad acompañando la certificación correspondiente.',
  array['pasantia']),

 ('regl-pasantia-derecho', 16, 'Art. 36', 'Trámite de la convalidación',
  'Recibida la solicitud, el Decano, en un plazo máximo de 48 horas derivará el expediente al Coordinador de Prácticas Pre-Profesionales, quien, dentro de las 72 horas, emitirá su opinión, observando si el caso lo amerita la convalidación solicitada.',
  array['pasantia']),

 ('regl-evaluacion', 1, 'Artículo 7', 'Formas de evaluación',
  'Son formas de evaluación las pruebas escritas, exámenes orales, trabajos de grupos o individuales, informes de visitas o trabajos de campo, resultados de experiencias de talleres, todo tipo de instituciones donde se hacen pasantías, controles bibliográficos, resultados de aplicación de la metodología de la investigación a trabajos concretos y otras actividades análogas.',
  array['academico', 'pasantia']);;
