-- Carga manual del proyecto «Derecho en un minuto». El informe remitido por correo
-- es una memoria en prosa, no el formato oficial 10, y por eso el importador lo rechaza.
-- Los datos se transcriben del documento; los ocho participantes no figuran nominados
-- en el informe, así que quedan por cargar cuando la cátedra remita la nómina.
do $$
declare
  v_proyecto uuid;
  v_docente  uuid;
begin
  select id into v_docente from docentes
   where public.unaccent_simple(lower(nombre)) like '%paciello%' limit 1;

  if v_docente is null then
    insert into docentes (nombre, catedras)
    values ('Abg. Margarita Paciello', array['Derecho en un minuto'])
    returning id into v_docente;
  end if;

  select id into v_proyecto from proyectos
   where public.unaccent_simple(lower(nombre)) = 'derecho en un minuto' limit 1;

  if v_proyecto is null then
    insert into proyectos (
      nombre, clasificacion, estado, periodo_academico, facultad, carreras,
      localizacion, lider, entregable, fecha_inicio, fecha_fin,
      anio, fuente, propuesta
    ) values (
      'Derecho en un minuto',
      'experiencia_conocimiento',
      'finalizado',
      '2026-1',
      'Facultad de Ciencias Jurídicas y Sociales',
      'Derecho',
      'Universidad de la Integración de las Américas — Asunción',
      'Abg. Margarita Paciello',
      'Contenidos jurídicos breves de divulgación elaborados y socializados por los estudiantes',
      date '2026-04-10',
      date '2026-07-20',
      2026,
      'INFORME DE PROYECTO DE EXTENSIÓN 2026 -1.docx (correo, carga manual)',
      jsonb_build_object(
        'introduccion',
          'El proyecto «Derecho en un minuto» tuvo como finalidad acercar conocimientos jurídicos '
          'a la comunidad mediante la presentación de contenidos breves, claros y accesibles. '
          'La iniciativa permitió a los estudiantes transformar conocimientos jurídicos en mensajes '
          'comprensibles para la ciudadanía, favoreciendo la divulgación del Derecho y fortaleciendo '
          'sus competencias de investigación, comunicación, síntesis y trabajo colaborativo.',
        'objetivo_general',
          'Acercar conocimientos jurídicos a la comunidad mediante contenidos breves, claros y accesibles, '
          'fortaleciendo en los estudiantes las competencias de investigación, comunicación y síntesis.',
        'metodologia',
          'Ocho estudiantes de la carrera de Derecho trabajaron en grupo distribuyendo responsabilidades '
          'a lo largo de ocho etapas: selección de los temas jurídicos; investigación y recopilación de '
          'información; análisis y verificación de los contenidos; organización y síntesis; elaboración '
          'de los materiales de divulgación; preparación de las presentaciones; socialización de los '
          'contenidos jurídicos; y evaluación del trabajo realizado. El período de investigación se '
          'extendió durante tres meses desde el inicio del proyecto.',
        'detalle',
          'Resultados alcanzados: integración de los conocimientos de la formación académica con una '
          'experiencia concreta de extensión; desarrollo de un proceso de investigación jurídica de tres '
          'meses; fortalecimiento de las habilidades comunicativas; promoción del trabajo colaborativo '
          'entre los ocho integrantes; elaboración de contenidos jurídicos breves, claros y accesibles; '
          'difusión de conocimientos relacionados con el Derecho; y generación de un espacio de '
          'vinculación entre la Universidad y la comunidad.',
        'participacion',
          'Ocho estudiantes de la carrera de Derecho. El informe no los nomina individualmente: '
          'la nómina con cédula y matrícula está pendiente de remisión por la cátedra, de modo que '
          'el cruce con el padrón académico no puede realizarse todavía.',
        'fuente_correo',
          'Remitido por la Abg. Margarita Paciello a Extensión Universitaria. Adjuntos: '
          '«INFORME DE PROYECTO DE EXTENSIÓN 2026 -1.docx» y «fotos del proyecto.docx» (5 fotografías).'
      )
    ) returning id into v_proyecto;

    insert into proyecto_docentes (proyecto_id, docente_id, rol)
    values (v_proyecto, v_docente, 'responsable')
    on conflict do nothing;
  end if;
end $$;

-- Cátedras y correo de los docentes, según lo que consta en la documentación remitida.
update docentes
   set catedras = array['Derecho Mercantil', 'Planificación y Gestión de las Políticas Públicas'],
       email    = coalesce(email, 'mmibarras@gmail.com')
 where public.unaccent_simple(lower(nombre)) like '%ibarra silvero%';

-- «Análisis de Problemas Públicos» corresponde a la carrera de Ciencias Políticas;
-- el importador había tomado el nombre de la cátedra como si fuera la carrera.
update proyectos
   set carreras          = 'Ciencias Políticas',
       curso             = 'Planificación y Gestión de las Políticas Públicas',
       periodo_academico = coalesce(periodo_academico, '2026-1')
 where public.unaccent_simple(lower(nombre)) like 'analisis de problemas publicos%';

update proyectos
   set periodo_academico = coalesce(periodo_academico, '2026-1')
 where public.unaccent_simple(lower(nombre)) like 'visita academica al centro de documentacion%';;
