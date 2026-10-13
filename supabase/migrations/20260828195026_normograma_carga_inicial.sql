insert into normas (codigo, orden, jerarquia, titulo, organo, anio, url, ambito, sumario, sin_texto) values
 ('cn-1992', 1, 'constitucion', 'Constitución Nacional de la República del Paraguay',
  'Convención Nacional Constituyente', 1992,
  'https://www.bacn.gov.py/leyes-paraguayas/1/constitucion-nacional',
  array['extension'],
  'Fija la extensión universitaria como una de las tres finalidades principales de las universidades.', false),

 ('ley-4995-2013', 2, 'ley', 'Ley N° 4995/2013 de Educación Superior',
  'Congreso Nacional', 2013,
  'https://www.bacn.gov.py/leyes-paraguayas/4243/ley-n-4995-de-educacion-superior',
  array['extension'],
  'Enumera los fines de las universidades, entre ellos la extensión universitaria.', false),

 ('res-13-2014', 3, 'resolucion',
  'Resolución Rectoral N° 13/2014 — Reglamento de Proyección Social y Extensión Universitaria',
  'Rectorado UNIDA', 2014,
  'https://www.unida.edu.py/v4/wp-content/uploads/2024/06/REGLAMENTO-DE-PROYECCION-SOCIAL-RES-RECTORAL-13_2014.pdf',
  array['extension'],
  'Resolución rectoral que aprueba el Reglamento de Proyección Social y Extensión Universitaria.', true),

 ('regl-proyeccion', 4, 'reglamento',
  'Reglamento de Proyección Social y Extensión Universitaria',
  'UNIDA — Res. N° 29/19', 2019,
  'https://www.unida.edu.py/v4/wp-content/uploads/2024/06/Reglamento-de-Proyeccion-Social-y-Extension-Universitaria-UNIDA.pdf',
  array['extension'],
  'Norma central de la materia: define proyección social y extensión, la dependencia del Área, el perfil que debe tener toda propuesta, la aprobación previa y el informe final con evidencias.', false),

 ('regl-general-2025', 5, 'reglamento', 'Reglamento General de la UNIDA',
  'UNIDA', 2025,
  'https://www.unida.edu.py/v4/wp-content/uploads/2025/01/REGLAMENTO-GENERAL-UNIDA-2025-1.pdf',
  array['extension', 'pasantia', 'gobierno'],
  'Estructura de gobierno de las facultades y régimen general de pasantías (capítulo XV).', false),

 ('regl-pasantia-derecho', 6, 'reglamento',
  'Reglamento de Práctica y Pasantía para la carrera de Derecho',
  'Facultad de Ciencias Jurídicas y Relaciones Internacionales — UNIDA', 2024,
  'https://www.unida.edu.py/v4/wp-content/uploads/2024/03/Reglamento-de-Practica-y-Pasantia-para-la-carrera-de-Derecho.pdf',
  array['pasantia'],
  'Régimen de las prácticas preprofesionales y pasantías de Derecho: obligatoriedad desde el sexto semestre, 264 horas reloj, evaluación 40/60 con mínimo del 70 %, plazos de informe y convalidación para egresados.', false),

 ('regl-academico', 7, 'reglamento', 'Reglamento Académico de la UNIDA', 'UNIDA', 2024,
  'https://www.unida.edu.py/v4/wp-content/uploads/2024/06/Reglamento-Academico-UNIDA.pdf',
  array['academico'],
  'Régimen académico general. Es una de las bases legales del reglamento de pasantías (art. 6).', true),

 ('regl-interno-fcj', 8, 'reglamento',
  'Reglamento Interno de la Facultad de Ciencias Jurídicas y Relaciones Internacionales',
  'FCJ y RRII — UNIDA', 2026,
  'https://www.unida.edu.py/v4/wp-content/uploads/2026/06/Reglamento-Interno-de-la-Facultad-de-Ciencias-Juridicas-y-RRII.pdf',
  array['gobierno'],
  'Organización interna de la Facultad.', true),

 ('regl-docente', 9, 'reglamento',
  'Reglamento del Docente — Resolución Rectoral N° 053/2021', 'Rectorado UNIDA', 2021,
  'https://www.unida.edu.py/v4/wp-content/uploads/2024/03/REGLAMENTO-DEL-DOCENTE-DE-LA-UNIVERSIDAD-DE-LA-INTEGRACION-DE-LAS-AMERICAS-RESOLUCION-REC-No-053.2021-APROBAR-EL.pdf',
  array['docente'],
  'Derechos y obligaciones del cuerpo docente, incluida su participación en extensión.', true),

 ('regl-evaluacion', 10, 'reglamento', 'Reglamento de Evaluación de la UNIDA', 'UNIDA', 2024,
  'https://www.unida.edu.py/v4/wp-content/uploads/2024/06/Reglamento-de-Evaluacion-UNIDA.pdf',
  array['academico', 'pasantia'],
  'Formas de evaluación admitidas; incluye expresamente las pasantías.', false),

 ('politicas-institucionales', 11, 'plan', 'Políticas Institucionales de la UNIDA', 'UNIDA', 2024,
  'https://www.unida.edu.py/v4/wp-content/uploads/2024/03/Politicas_Institucionales.pdf',
  array['gobierno'], 'Marco de políticas institucionales.', true),

 ('plan-estrategico', 12, 'plan', 'Plan Estratégico Institucional 2021–2030', 'UNIDA', 2021,
  'https://www.unida.edu.py/v4/wp-content/uploads/2024/03/Plan-estrategico-2021-2030.pdf',
  array['gobierno'], 'Objetivos estratégicos de la Universidad para la década.', true)
on conflict (codigo) do update set
  titulo = excluded.titulo, url = excluded.url, sumario = excluded.sumario,
  ambito = excluded.ambito, sin_texto = excluded.sin_texto, orden = excluded.orden;;
