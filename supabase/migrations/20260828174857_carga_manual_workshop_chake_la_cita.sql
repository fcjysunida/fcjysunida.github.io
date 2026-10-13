-- Formato oficial 9 del workshop «Cháke la cita» (Zotero + APA 7.ª), remitido por correo.
-- La tabla de estudiantes del formulario se remitió en blanco: la nómina queda pendiente.
do $$
declare
  v_proyecto uuid;
  v_arrose   uuid;
  v_gomez    uuid;
begin
  select id into v_proyecto from proyectos
   where public.unaccent_simple(lower(nombre)) like '%chake la cita%' limit 1;
  if v_proyecto is not null then return; end if;

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

  insert into proyectos (
    nombre, clasificacion, estado, periodo_academico, facultad, carreras, curso,
    localizacion, otras_organizaciones, lider, entregable, proyectos_relacionados,
    fecha_inicio, fecha_fin, horas_reloj, horas_extension, anio, fuente, propuesta
  ) values (
    'Workshop «Cháke la cita» — Reglas fundamentales de escritura académica y gestión bibliográfica',
    'cursos_extracurriculares',
    'aprobado',
    '2025-1',
    'Facultad de Ciencias Jurídicas y Sociales',
    'Derecho',
    'Derecho Informático y Mediación',
    'Facultad de Ciencias Jurídicas y Sociales',
    null,
    'Abg. Leonardo Gómez Berniga, Abg. Victoria Arrose',
    'Los participantes adquirirán conocimientos sobre las normas de citación APA 7.ª edición y el uso '
    'de Zotero como herramienta de gestión bibliográfica, lo que contribuirá a mejorar la calidad y '
    'rigurosidad de sus trabajos académicos.',
    null,
    date '2025-04-10',
    date '2025-04-17',
    4, 2, 2025,
    'Proyecto Extensión Zotero.docx (formato 9, correo)',
    jsonb_build_object(
      'introduccion',
        'El correcto uso de normas de citación académica es un requisito fundamental en la formación '
        'universitaria y la producción de conocimiento. Sin embargo, muchos estudiantes enfrentan '
        'dificultades al aplicar estas normas, lo que puede generar problemas de plagio o errores '
        'formales en sus trabajos. Este workshop busca proporcionar herramientas prácticas para la '
        'escritura académica rigurosa, combinando teoría y práctica en la aplicación de las normas '
        'APA 7.ª edición y el uso de Zotero como gestor bibliográfico.',
      'justificacion',
        'La formación en citación académica y gestión bibliográfica permite mejorar la calidad de los '
        'trabajos de investigación, fortalecer la ética académica y facilitar la producción de documentos '
        'con alto rigor científico. Además, el manejo de herramientas digitales como Zotero optimiza el '
        'proceso de organización y citación de fuentes, brindando a los estudiantes mayor eficiencia en '
        'su labor investigativa.',
      'objetivo_general',
        'Capacitar a estudiantes universitarios en el correcto uso de las normas APA 7.ª edición y en la '
        'gestión bibliográfica con Zotero, mejorando sus habilidades de escritura académica.',
      'metodologia',
        'Dos jornadas. Día 1 (10.04.2025): reglas fundamentales para la escritura académica y normas '
        'APA 7.ª edición, a cargo de María Victoria Arrose Jara. Día 2 (17.04.2025): uso de Zotero para '
        'la gestión bibliográfica, a cargo de Leonardo Gómez Berniga. Cuatro horas reloj equivalentes a '
        'dos horas de extensión universitaria, en el laboratorio de informática con proyectores y '
        'computadoras para la práctica.',
      'detalle',
        'Alcance — Antecedentes: se ha identificado que muchos estudiantes presentan dificultades en la '
        'aplicación de normas de citación, lo que afecta la calidad de sus trabajos y su desempeño '
        'académico. Situación deseada: que los estudiantes apliquen correctamente las normas APA y usen '
        'Zotero para gestionar sus referencias. Población beneficiada — directos: estudiantes de grado '
        'interesados en mejorar su producción académica (se estima una participación de entre 20 y 40); '
        'indirectos: docentes y comunidad académica que recibirán trabajos mejor estructurados y citados. '
        'Metas: al menos el 80 % de los participantes identificará correctamente las normas APA en un '
        'ejercicio práctico y al menos el 70 % logrará crear y gestionar una biblioteca en Zotero. '
        'Medios de verificación: evaluación práctica en el workshop, demostración en vivo y ejercicios. '
        'Créditos académicos solicitados: certificados para estudiantes.',
      'participacion',
        'Docentes: Abg. María Victoria Arrose Jara (Mediación y Resolución de Conflictos) y '
        'Abg. Leonardo Gómez Berniga (Derecho Informático e Introducción a las TICS). '
        'La tabla de estudiantes del formato oficial fue remitida en blanco, por lo que la nómina con '
        'cédula, carrera, ciclo y matrícula está pendiente y el cruce con el padrón no puede realizarse.',
      'fuente_correo',
        'Formato oficial 9 «Proyecto de Extensión» remitido a Extensión Universitaria. '
        'Adjunto: «Proyecto Extensión Zotero.docx».'
    )
  ) returning id into v_proyecto;

  insert into proyecto_docentes (proyecto_id, docente_id, rol) values
    (v_proyecto, v_arrose, 'responsable'),
    (v_proyecto, v_gomez,  'responsable')
  on conflict do nothing;
end $$;;
