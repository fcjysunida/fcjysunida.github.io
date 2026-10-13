-- III Congreso de Derecho Ambiental, FCJYS UNIDA.
-- Modalidad híbrida, dos jornadas: miércoles 30/09/2026 presencial en la Sede
-- UNIDA y jueves 01/10/2026 virtual, ambas de 18:00 a 21:00.
-- Se replica lo que hace crear_actividad(), con la fila de auditoría escrita a
-- mano porque no hay sesión de panel en este contexto.
do $$
declare
  v_act uuid; v_tf text; v_ta text; v_proy uuid; i int;
  v_campos jsonb;
begin
  if exists (select 1 from actividades where titulo like 'III Congreso de Derecho Ambiental%') then
    return;
  end if;

  v_tf := app.nuevo_token();
  v_ta := app.nuevo_token();

  v_campos := jsonb_build_array(
    jsonb_build_object('id','c1nomb','tipo','texto','etiqueta','Nombre y apellido',
      'obligatorio',true,'mapa','nombre','ayuda','Tal como debe figurar en el certificado'),
    jsonb_build_object('id','c2cedu','tipo','cedula','etiqueta','Cédula de identidad',
      'obligatorio',true,'cifrado',true,'mapa','cedula',
      'ayuda','Se utiliza para validar su asistencia. Se almacena cifrada.'),
    jsonb_build_object('id','c3mail','tipo','email','etiqueta','Correo electrónico',
      'obligatorio',true,'mapa','email','ayuda','Allí se envían la confirmación y el certificado'),
    jsonb_build_object('id','c4tel','tipo','tel','etiqueta','Teléfono o WhatsApp',
      'cifrado',true,'mapa','telefono'),
    jsonb_build_object('id','c5cond','tipo','unica','etiqueta','Condición','obligatorio',true,
      'mapa','condicion','opciones',jsonb_build_array('Estudiante','Docente','Egresado','Externo')),
    jsonb_build_object('id','c6inst','tipo','texto','etiqueta','Institución u organización',
      'mapa','institucion'),
    jsonb_build_object('id','c7carr','tipo','texto','etiqueta','Carrera y semestre','mapa','carrera'),
    jsonb_build_object('id','c8ciud','tipo','texto','etiqueta','Ciudad o departamento','mapa','ciudad'),
    jsonb_build_object('id','c9moda','tipo','unica','etiqueta','Modalidad de participación',
      'obligatorio',true,'mapa','modalidad',
      'opciones',jsonb_build_array('Presencial','Virtual'),
      'ayuda','La jornada del 30 de setiembre es presencial en la Sede UNIDA; la del 1 de octubre es virtual.'),
    jsonb_build_object('id','c10cer','tipo','unica','etiqueta','¿Necesita certificado?',
      'mapa','certificado','opciones',jsonb_build_array('Sí','No')),
    jsonb_build_object('id','c11acc','tipo','parrafo','etiqueta','Requerimientos de accesibilidad',
      'sensible',true,'mapa','accesibilidad',
      'ayuda','Dato sensible. Es voluntario. Solo lo consulta la organización de la actividad.'),
    jsonb_build_object('id','c12dif','tipo','lista','etiqueta','¿Cómo se enteró de la actividad?',
      'mapa','origen_difusion',
      'opciones',jsonb_build_array('Instagram','Correo institucional','WhatsApp','Recomendación','Otro medio')));

  insert into actividades (
    titulo, tipo, descripcion, modalidad, fecha_inicio, dias, cupo, lugar,
    portada, horas_academicas, estado, token_formulario, token_asistencia,
    campos, consentimiento_version_id, carreras_involucradas)
  values (
    'III Congreso de Derecho Ambiental',
    'extension',
    'La Facultad de Ciencias Jurídicas y Sociales de la UNIDA invita al III Congreso de '
    'Derecho Ambiental, en modalidad híbrida. Miércoles 30 de setiembre de 18:00 a 21:00, '
    'presencial en la Sede UNIDA. Jueves 1 de octubre de 18:00 a 21:00, virtual.',
    'hibrida',
    date '2026-09-30',
    2, 200, 'Sede UNIDA — Avda. Venezuela 1353 c/ Tte. Insaurralde, Asunción',
    'juridico', 6, 'publicada', v_tf, v_ta,
    v_campos,
    ((public.consentimiento_vigente())->>'id')::uuid,
    3)
  returning id into v_act;

  for i in 1..2 loop
    insert into jornadas (actividad_id, numero, fecha, codigo_sala)
    values (v_act, i, date '2026-09-30' + (i - 1), app.nuevo_codigo());
  end loop;

  -- Proyecto de extensión que respalda la actividad, con el perfil del art. 11
  -- del Reglamento de Proyección Social y Extensión Universitaria.
  insert into proyectos (
    nombre, clasificacion, estado, periodo_academico, facultad, carreras, curso,
    localizacion, lider, entregable, fecha_inicio, fecha_fin,
    horas_reloj, horas_extension, anio, actividad_id, fuente, propuesta)
  values (
    'III Congreso de Derecho Ambiental',
    'eventos_academicos',
    'aprobado',
    '2026-2',
    'Facultad de Ciencias Jurídicas y Sociales',
    array['Derecho', 'Ciencias Políticas', 'Relaciones Internacionales y Negocios Globales'],
    'Derecho Ambiental',
    'Sede UNIDA, Asunción — jornada virtual el segundo día',
    'Facultad de Ciencias Jurídicas y Sociales — UNIDA',
    'Certificado de participación para asistentes y memoria del congreso.',
    date '2026-09-30', date '2026-10-01',
    6,
    (public.horas_extension_sugeridas('eventos_academicos', 6, 2::smallint) ->> 'horas')::numeric,
    2026, v_act,
    'Alta desde el panel — pieza de difusión del congreso',
    jsonb_build_object(
      'introduccion',
        'Tercera edición del Congreso de Derecho Ambiental de la Facultad de Ciencias '
        'Jurídicas y Sociales. Se desarrolla en modalidad híbrida a lo largo de dos '
        'jornadas: la primera presencial en la Sede UNIDA y la segunda virtual, ampliando '
        'el alcance a participantes del interior y del exterior.',
      'objetivo_general',
        'Divulgar el estado actual del Derecho Ambiental y su aplicación en el Paraguay, '
        'acercando el debate jurídico ambiental a la comunidad universitaria y al público '
        'general.',
      'metodologia',
        'Dos jornadas de tres horas, de 18:00 a 21:00. Miércoles 30 de setiembre de 2026, '
        'presencial en la Sede UNIDA. Jueves 1 de octubre de 2026, virtual. La inscripción '
        'y el registro de asistencia se hacen por la plataforma, con código de sala por '
        'jornada, y al cierre se aplica la encuesta de satisfacción.',
      'participacion',
        'Abierto a estudiantes y egresados de las tres carreras de la Facultad, docentes y '
        'público externo. La condición de cada inscripto se verifica contra el padrón '
        'académico del período.',
      'detalle',
        'Clasificación: evento académico. Según la escala del anexo corresponde 1 hora de '
        'Extensión Universitaria por día de actividad. Cupo previsto: 200 participantes.'))
  returning id into v_proy;

  insert into auditoria (accion, entidad, entidad_id, motivo, detalle)
  values ('alta_actividad', 'actividades', v_act,
          'Alta del III Congreso de Derecho Ambiental a pedido de la Dirección.',
          jsonb_build_object('titulo', 'III Congreso de Derecho Ambiental',
                             'tipo', 'extension', 'proyecto', v_proy,
                             'via', 'migración iii_congreso_de_derecho_ambiental'));
end $$;;
