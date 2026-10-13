-- Los indicadores solo miraban `actividades`. Se agregan los proyectos de
-- extensión, con renglones propios para que no se confunda lo registrado en la
-- plataforma con lo que viene de las memorias y los formatos oficiales.
create or replace function indicadores(p_periodo text)
returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare
  v_actividades int; v_asistencias int; v_horas numeric; v_ciudades int;
  v_proyectos int; v_proy_fin int; v_benef_dir int; v_benef_ind int;
  v_instituciones int; v_vinculacion int; v_estudiantes int; v_carreras int;
  v_horas_est numeric; v_act_est int; v_inst_benef int; v_publicaciones int;
  v_alcance int; v_manual jsonb;
  v_eval int; v_csat int; v_nps int; v_prom numeric;
  v_pr_total int; v_pr_fin int; v_pr_horas numeric; v_pr_benef int;
  v_pr_part int; v_pr_est int; v_pr_verif int; v_pr_docentes int;
begin
  if auth.uid() is not null
     and not app.es('admin','coordinacion','secretaria','auditor','docente') then
    raise exception 'Su rol no consulta los indicadores.';
  end if;

  select count(*),
         count(*) filter (where a.tipo = 'proyecto_extension'),
         count(*) filter (where a.tipo = 'proyecto_extension' and a.estado = 'finalizada'),
         count(*) filter (where a.tipo = 'vinculacion'),
         coalesce(sum(a.carreras_involucradas), 0),
         coalesce(sum(a.instituciones_vinculadas), 0)
    into v_actividades, v_proyectos, v_proy_fin, v_vinculacion, v_carreras, v_inst_benef
    from public.actividades a
   where to_char(a.fecha_inicio, 'YYYY-MM') = p_periodo;

  select coalesce(sum(a.horas_academicas), 0) into v_horas
    from public.actividades a
   where to_char(a.fecha_inicio, 'YYYY-MM') = p_periodo
     and a.tipo in ('extension','proyecto_extension');

  select count(*) into v_asistencias
    from public.asistencias s
    join public.jornadas j on j.id = s.jornada_id
    join public.actividades a on a.id = j.actividad_id
   where to_char(a.fecha_inicio, 'YYYY-MM') = p_periodo;

  select count(*) into v_benef_dir
    from public.asistencias s
    join public.jornadas j on j.id = s.jornada_id
    join public.actividades a on a.id = j.actividad_id
   where to_char(a.fecha_inicio, 'YYYY-MM') = p_periodo
     and a.tipo in ('extension','proyecto_extension');

  select count(distinct i.ciudad) filter (where i.ciudad is not null),
         count(distinct i.institucion) filter (where i.institucion is not null),
         count(*) filter (where i.condicion = 'estudiante')
    into v_ciudades, v_instituciones, v_estudiantes
    from public.inscripciones i
    join public.actividades a on a.id = i.actividad_id
   where to_char(a.fecha_inicio, 'YYYY-MM') = p_periodo
     and i.estado <> 'anulada';

  select coalesce(sum(d.publicaciones), 0), coalesce(sum(d.alcance_estimado), 0)
    into v_publicaciones, v_alcance
    from public.difusiones d
    join public.actividades a on a.id = d.actividad_id
   where to_char(a.fecha_inicio, 'YYYY-MM') = p_periodo;
  v_benef_ind := v_alcance;

  -- Proyectos de extensión del período: memorias institucionales y formatos
  -- oficiales 9 y 10. Cuando solo se conoce el año, el proyecto cae en enero.
  select count(*),
         count(*) filter (where p.estado = 'finalizado'),
         coalesce(sum(p.horas_extension), 0),
         coalesce(sum(p.beneficiarios_directos), 0)
    into v_pr_total, v_pr_fin, v_pr_horas, v_pr_benef
    from public.proyectos p
   where to_char(coalesce(p.fecha_inicio, make_date(p.anio, 1, 1)), 'YYYY-MM') = p_periodo;

  select count(*),
         count(*) filter (where pp.tipo = 'estudiante'),
         count(*) filter (where pp.periodo_verificado is not null)
    into v_pr_part, v_pr_est, v_pr_verif
    from public.proyecto_participantes pp
    join public.proyectos p on p.id = pp.proyecto_id
   where to_char(coalesce(p.fecha_inicio, make_date(p.anio, 1, 1)), 'YYYY-MM') = p_periodo;

  select count(distinct pd.docente_id) into v_pr_docentes
    from public.proyecto_docentes pd
    join public.proyectos p on p.id = pd.proyecto_id
   where to_char(coalesce(p.fecha_inicio, make_date(p.anio, 1, 1)), 'YYYY-MM') = p_periodo;

  select count(*),
         case when count(*) = 0 then 0
              else round(100.0 * count(*) filter (where e.global >= 4) / count(*)) end,
         case when count(*) = 0 then 0
              else round(100.0 * (count(*) filter (where e.recomendacion >= 9)
                                - count(*) filter (where e.recomendacion <= 6)) / count(*)) end,
         coalesce(round(avg((e.contenido + e.expositor + e.organizacion
                           + e.recursos + e.aplicabilidad + e.global) / 6.0)::numeric, 2), 0)
    into v_eval, v_csat, v_nps, v_prom
    from public.evaluaciones e
    join public.actividades a on a.id = e.actividad_id
   where to_char(a.fecha_inicio, 'YYYY-MM') = p_periodo;

  select coalesce(sum(a.horas_academicas), 0) into v_horas_est
    from public.asistencias s
    join public.jornadas j on j.id = s.jornada_id
    join public.actividades a on a.id = j.actividad_id
    join public.inscripciones i on i.id = s.inscripcion_id
   where to_char(a.fecha_inicio, 'YYYY-MM') = p_periodo
     and i.condicion = 'estudiante';

  select count(distinct a.id) into v_act_est
    from public.actividades a
    join public.inscripciones i on i.actividad_id = a.id
   where to_char(a.fecha_inicio, 'YYYY-MM') = p_periodo
     and i.condicion = 'estudiante' and i.estado <> 'anulada';

  select coalesce(jsonb_object_agg(m.clave, m.valor), '{}'::jsonb) into v_manual
    from public.indicadores_manuales m where m.periodo = p_periodo;

  return jsonb_build_object(
    'periodo', p_periodo,
    'calidad', jsonb_build_object('respuestas', v_eval, 'csat', v_csat,
                                  'nps', v_nps, 'promedio', v_prom),
    'bloques', jsonb_build_array(
      jsonb_build_object('n','2','titulo','Actividades realizadas','items', jsonb_build_array(
        jsonb_build_object('label','Actividades ejecutadas','valor',v_actividades,'unidad','N°','origen','Actividades del período'),
        jsonb_build_object('label','Participantes alcanzados','valor',v_asistencias,'unidad','N°','origen','Asistencias por jornada'),
        jsonb_build_object('label','Horas de extensión desarrolladas','valor',v_horas + v_pr_horas,'unidad','N°','origen','Carga horaria de actividades y proyectos'),
        jsonb_build_object('label','Cobertura territorial','valor',v_ciudades,'unidad','Comunidades o instituciones','origen','Campo ciudad del formulario'))),
      jsonb_build_object('n','3','titulo','Proyectos de extensión','items', jsonb_build_array(
        jsonb_build_object('label','Proyectos del período','valor',v_pr_total,'unidad','N°','origen','Memorias institucionales y formatos oficiales'),
        jsonb_build_object('label','Proyectos finalizados','valor',v_pr_fin,'unidad','N°','origen','Estado del proyecto'),
        jsonb_build_object('label','Horas de extensión de los proyectos','valor',v_pr_horas,'unidad','N°','origen','Escala del anexo según clasificación'),
        jsonb_build_object('label','Participantes en la nómina','valor',v_pr_part,'unidad','N°','origen','Nómina de los proyectos'),
        jsonb_build_object('label','Participantes verificados en el padrón','valor',v_pr_verif,'unidad','N°','origen','Cruce por cédula o matrícula'),
        jsonb_build_object('label','Docentes responsables','valor',v_pr_docentes,'unidad','N°','origen','Registro de docentes'),
        jsonb_build_object('label','Actividades de la plataforma tipo proyecto','valor',v_proyectos,'unidad','N°','origen','Tipo: proyecto de extensión'),
        jsonb_build_object('label','Beneficiarios directos','valor',greatest(v_benef_dir, v_pr_benef),'unidad','N°','origen','Asistencias o beneficiarios declarados'),
        jsonb_build_object('label','Beneficiarios indirectos','valor',v_benef_ind,'unidad','N°','origen','Alcance de difusión'))),
      jsonb_build_object('n','4','titulo','Vinculación institucional','items', jsonb_build_array(
        jsonb_build_object('label','Instituciones vinculadas','valor',v_instituciones,'unidad','N°','origen','Campo institución'),
        jsonb_build_object('label','Actividades conjuntas desarrolladas','valor',v_vinculacion,'unidad','N°','origen','Tipo: vinculación institucional'),
        jsonb_build_object('label','Convenios apoyados','valor',coalesce((v_manual->>'convenios_apoyados')::numeric,0),'unidad','N°','origen','Carga de la Coordinación'),
        jsonb_build_object('label','Nuevas alianzas generadas','valor',coalesce((v_manual->>'nuevas_alianzas')::numeric,0),'unidad','N°','origen','Carga de la Coordinación'))),
      jsonb_build_object('n','5','titulo','Participación estudiantil','items', jsonb_build_array(
        jsonb_build_object('label','Estudiantes participantes','valor',v_estudiantes + v_pr_est,'unidad','N°','origen','Inscripciones y nóminas de proyecto'),
        jsonb_build_object('label','Carreras involucradas','valor',v_carreras,'unidad','N°','origen','Carreras por actividad'),
        jsonb_build_object('label','Horas de participación estudiantil','valor',v_horas_est,'unidad','N°','origen','Horas por asistencia estudiantil'),
        jsonb_build_object('label','Actividades con participación estudiantil','valor',v_act_est + v_pr_total,'unidad','N°','origen','Inscripciones y nóminas de proyecto'))),
      jsonb_build_object('n','6','titulo','Impacto alcanzado','items', jsonb_build_array(
        jsonb_build_object('label','Beneficiarios totales','valor',v_asistencias + v_pr_part,'unidad','N°','origen','Asistencias y nóminas'),
        jsonb_build_object('label','Instituciones beneficiadas','valor',v_inst_benef,'unidad','N°','origen','Instituciones por actividad'),
        jsonb_build_object('label','Actividades difundidas','valor',v_publicaciones,'unidad','Publicaciones','origen','Registro de difusión'),
        jsonb_build_object('label','Alcance en medios y redes','valor',v_alcance,'unidad','Alcance estimado','origen','Métricas de redes'),
        jsonb_build_object('label','Nivel de satisfacción (CSAT)','valor',v_csat,'unidad','%','origen','Encuesta ISO 10004 — cajas 4 y 5'),
        jsonb_build_object('label','Recomendación neta (NPS)','valor',v_nps,'unidad','puntos','origen','Encuesta ISO 10004 — promotores menos detractores'),
        jsonb_build_object('label','Valoración media del instrumento','valor',v_prom,'unidad','de 1 a 5','origen','Encuesta ISO 10004 — seis dimensiones'),
        jsonb_build_object('label','Evaluaciones recibidas','valor',v_eval,'unidad','N°','origen','Encuesta posterior a la asistencia')))));
end $$;;
