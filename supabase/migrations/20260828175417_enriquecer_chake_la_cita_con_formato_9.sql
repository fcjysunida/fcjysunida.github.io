-- El workshop «Cháke la cita» ya estaba cargado desde la memoria institucional.
-- Acá se le incorpora el formato oficial 9 remitido por correo, que aporta las
-- fechas exactas, las horas, la clasificación y el texto de la propuesta.
do $$
declare
  v_proyecto uuid;
  v_arrose   uuid;
  v_gomez    uuid;
begin
  select id into v_proyecto from proyectos
   where public.unaccent_simple(lower(nombre)) like '%chake la cita%' limit 1;
  if v_proyecto is null then return; end if;

  select id into v_arrose from docentes
   where public.unaccent_simple(lower(nombre)) like '%arrose%' limit 1;
  if v_arrose is null then
    insert into docentes (nombre, catedras)
    values ('Abg. María Victoria Arrose Jara', array['Mediación y Resolución de Conflictos'])
    returning id into v_arrose;
  end if;

  select id into v_gomez from docentes
   where public.unaccent_simple(lower(nombre)) like '%gomez berniga%' limit 1;
  if v_gomez is null then
    insert into docentes (nombre, catedras, email)
    values ('Abg. Leonardo Gómez Berniga',
            array['Derecho Informático', 'Introducción a las TICS'],
            'extensionderecho@unida.edu.py')
    returning id into v_gomez;
  end if;

  update proyectos set
    clasificacion   = 'cursos_extracurriculares',
    carreras        = coalesce(carreras, 'Derecho'),
    curso           = coalesce(curso, 'Derecho Informático y Mediación'),
    localizacion    = coalesce(localizacion, 'Facultad de Ciencias Jurídicas y Sociales'),
    lider           = coalesce(lider, 'Abg. Leonardo Gómez Berniga, Abg. Victoria Arrose'),
    fecha_inicio    = coalesce(fecha_inicio, date '2025-04-10'),
    fecha_fin       = coalesce(fecha_fin,    date '2025-04-17'),
    horas_reloj     = coalesce(horas_reloj, 4),
    horas_extension = coalesce(horas_extension, 2),
    entregable      = coalesce(entregable,
      'Los participantes adquirirán conocimientos sobre las normas de citación APA 7.ª edición y el uso '
      'de Zotero como herramienta de gestión bibliográfica, lo que contribuirá a mejorar la calidad y '
      'rigurosidad de sus trabajos académicos.'),
    fuente = fuente || ' + Proyecto Extensión Zotero.docx (formato 9, correo)',
    propuesta = coalesce(propuesta, '{}'::jsonb) || jsonb_build_object(
      'justificacion',
        'La formación en citación académica y gestión bibliográfica permite mejorar la calidad de los '
        'trabajos de investigación, fortalecer la ética académica y facilitar la producción de documentos '
        'con alto rigor científico. Además, el manejo de herramientas digitales como Zotero optimiza el '
        'proceso de organización y citación de fuentes.',
      'objetivo_general',
        'Capacitar a estudiantes universitarios en el correcto uso de las normas APA 7.ª edición y en la '
        'gestión bibliográfica con Zotero, mejorando sus habilidades de escritura académica.',
      'metodologia',
        'Dos jornadas. Día 1 (10.04.2025): reglas fundamentales para la escritura académica y normas APA '
        '7.ª edición, a cargo de María Victoria Arrose Jara. Día 2 (17.04.2025): uso de Zotero para la '
        'gestión bibliográfica, a cargo de Leonardo Gómez Berniga. Cuatro horas reloj equivalentes a dos '
        'horas de extensión universitaria, en el laboratorio de informática.',
      'participacion',
        'Docentes: Abg. María Victoria Arrose Jara (Mediación y Resolución de Conflictos) y Abg. Leonardo '
        'Gómez Berniga (Derecho Informático e Introducción a las TICS). Población beneficiada estimada '
        'entre 20 y 40 estudiantes de grado. La tabla de estudiantes del formato oficial fue remitida en '
        'blanco, por lo que la nómina con cédula y matrícula está pendiente y el cruce con el padrón '
        'académico no puede realizarse.',
      'fuente_correo',
        'Formato oficial 9 «Proyecto de Extensión» remitido a Extensión Universitaria. '
        'Adjunto: «Proyecto Extensión Zotero.docx». Metas: 80 % de los participantes identifica '
        'correctamente las normas APA y 70 % logra crear y gestionar una biblioteca en Zotero. '
        'Créditos académicos solicitados: certificados para estudiantes.')
  where id = v_proyecto;

  insert into proyecto_docentes (proyecto_id, docente_id, rol) values
    (v_proyecto, v_arrose, 'responsable'),
    (v_proyecto, v_gomez,  'responsable')
  on conflict do nothing;
end $$;;
