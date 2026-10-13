-- Altas de participantes y desglose por condición.

-- ── Desde la actividad vinculada ───────────────────────────────────────────────
-- Trae a quienes se inscribieron por el formulario. Por defecto solo a los que
-- registraron asistencia: participar es haber estado, no haberse anotado.
create or replace function public.proyecto_participantes_desde_actividad(
  p_proyecto uuid, p_solo_asistentes boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare p public.proyectos%rowtype; r record; v_ver jsonb; v_n int := 0; v_ya int := 0;
begin
  select * into p from public.proyectos where id = p_proyecto;
  if not found then raise exception 'El proyecto no existe.'; end if;
  if not (app.es('admin','coordinacion') or p.docente_responsable = auth.uid()
          or p.creado_por = auth.uid()) then
    raise exception 'Su rol no edita este proyecto.';
  end if;
  if p.actividad_id is null then
    raise exception 'El proyecto no tiene una actividad vinculada.';
  end if;

  for r in
    select i.id, i.nombre, i.cedula_hash, i.cedula_mascara, i.matricula, i.carrera,
           i.ciclo, i.condicion, i.institucion,
           (select count(*) from public.asistencias s where s.inscripcion_id = i.id) as jorn
      from public.inscripciones i
     where i.actividad_id = p.actividad_id and i.estado <> 'anulada'
       and i.anonimizada_en is null
  loop
    if p_solo_asistentes and r.jorn = 0 then continue; end if;
    if exists (select 1 from public.proyecto_participantes pp
                where pp.proyecto_id = p_proyecto
                  and (pp.inscripcion_id = r.id
                       or (pp.cedula_hash is not null and pp.cedula_hash = r.cedula_hash))) then
      v_ya := v_ya + 1; continue;
    end if;

    v_ver := app.condicion_en_periodo(r.cedula_hash, r.matricula,
                                      p.fecha_inicio, p.anio, r.condicion);

    insert into public.proyecto_participantes (
      proyecto_id, tipo, nombre, cedula_hash, cedula_mascara, matricula, carrera,
      ciclo, organizacion, condicion, condicion_origen, periodo_verificado,
      inscripcion_id, asistio, jornadas, fuente, orden)
    values (
      p_proyecto,
      case when (v_ver->>'condicion') = 'estudiante' then 'estudiante'::public.tipo_participante
           when (v_ver->>'condicion') = 'docente'    then 'docente'::public.tipo_participante
           else 'externo'::public.tipo_participante end,
      r.nombre, r.cedula_hash, r.cedula_mascara,
      coalesce(v_ver->>'matricula', r.matricula),
      coalesce(v_ver->>'carrera', r.carrera), coalesce(v_ver->>'ciclo', r.ciclo),
      r.institucion,
      (v_ver->>'condicion')::public.condicion_participante,
      v_ver->>'origen', v_ver->>'periodo',
      r.id, r.jorn > 0, r.jorn, 'formulario',
      (select coalesce(max(orden), 0) + 1 from public.proyecto_participantes
        where proyecto_id = p_proyecto));
    v_n := v_n + 1;
  end loop;

  perform public.auditar('participantes_desde_actividad', 'proyectos', p_proyecto, null,
                         jsonb_build_object('agregados', v_n, 'ya_estaban', v_ya));
  return jsonb_build_object('ok', true, 'agregados', v_n, 'ya_estaban', v_ya);
end $$;
revoke execute on function public.proyecto_participantes_desde_actividad(uuid, boolean)
  from public, anon;
grant execute on function public.proyecto_participantes_desde_actividad(uuid, boolean)
  to authenticated;

-- ── Alta por nómina o desde el padrón ──────────────────────────────────────────
-- p_filas: [{"nombre","cedula"?,"matricula"?,"cedula_hash"?,"organizacion"?,
--            "tipo"?,"asistio"?}]
-- `cedula_hash` llega cuando la persona se eligió del buscador del padrón, así
-- no hace falta volver a pedir el documento.
create or replace function public.proyecto_participantes_agregar(
  p_proyecto uuid, p_filas jsonb, p_fuente text default 'nomina')
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.proyectos%rowtype; f jsonb; v_ver jsonb;
  v_hash text; v_doc text; v_n int := 0; v_ya int := 0; v_om int := 0;
begin
  select * into p from public.proyectos where id = p_proyecto;
  if not found then raise exception 'El proyecto no existe.'; end if;
  if not (app.es('admin','coordinacion') or p.docente_responsable = auth.uid()
          or p.creado_por = auth.uid()) then
    raise exception 'Su rol no edita este proyecto.';
  end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    if coalesce(btrim(f->>'nombre'),'') = '' then v_om := v_om + 1; continue; end if;

    v_doc := upper(regexp_replace(coalesce(f->>'cedula',''), '[^0-9A-Za-z]', '', 'g'));
    v_hash := coalesce(nullif(f->>'cedula_hash',''),
                       case when v_doc <> '' then app.hash_cedula(v_doc) else null end);

    if v_hash is not null and exists (
         select 1 from public.proyecto_participantes pp
          where pp.proyecto_id = p_proyecto and pp.cedula_hash = v_hash) then
      v_ya := v_ya + 1; continue;
    end if;

    v_ver := app.condicion_en_periodo(
      v_hash, nullif(btrim(coalesce(f->>'matricula','')),''),
      p.fecha_inicio, p.anio,
      coalesce(nullif(f->>'tipo','')::public.condicion_participante, 'externo'));

    insert into public.proyecto_participantes (
      proyecto_id, tipo, nombre, cedula_hash, cedula_cif, cedula_mascara,
      matricula, carrera, ciclo, organizacion, condicion, condicion_origen,
      periodo_verificado, asistio, fuente, orden)
    values (
      p_proyecto,
      case when (v_ver->>'condicion') = 'estudiante' then 'estudiante'::public.tipo_participante
           when (v_ver->>'condicion') = 'docente'    then 'docente'::public.tipo_participante
           else 'externo'::public.tipo_participante end,
      btrim(f->>'nombre'), v_hash,
      case when v_doc <> '' then app.cifrar(v_doc) else null end,
      case when v_doc <> '' then app.mascara_cedula(v_doc) else null end,
      coalesce(v_ver->>'matricula', nullif(btrim(coalesce(f->>'matricula','')),'')),
      v_ver->>'carrera', v_ver->>'ciclo',
      nullif(btrim(coalesce(f->>'organizacion','')),''),
      (v_ver->>'condicion')::public.condicion_participante,
      v_ver->>'origen', v_ver->>'periodo',
      coalesce((f->>'asistio')::boolean, true), p_fuente,
      (select coalesce(max(orden), 0) + 1 from public.proyecto_participantes
        where proyecto_id = p_proyecto));
    v_n := v_n + 1;
  end loop;

  perform public.auditar('participantes_agregados', 'proyectos', p_proyecto, null,
    jsonb_build_object('fuente', p_fuente, 'agregados', v_n,
                       'ya_estaban', v_ya, 'omitidos', v_om));
  return jsonb_build_object('ok', true, 'agregados', v_n, 'ya_estaban', v_ya,
                            'omitidos', v_om);
end $$;
revoke execute on function public.proyecto_participantes_agregar(uuid, jsonb, text)
  from public, anon;
grant execute on function public.proyecto_participantes_agregar(uuid, jsonb, text)
  to authenticated;

-- ── Reverificación ─────────────────────────────────────────────────────────────
-- Se corre después de importar el padrón de un período viejo: los participantes
-- que estaban como «externos» por falta de datos pasan a su condición real.
create or replace function public.proyecto_participantes_verificar(
  p_proyecto uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r record; v_ver jsonb; v_n int := 0; v_cambios int := 0;
begin
  if not app.es('admin','coordinacion') then
    raise exception 'Su rol no reverifica participantes.';
  end if;
  for r in
    select pp.id, pp.cedula_hash, pp.matricula, pp.condicion, pp.tipo,
           p.fecha_inicio, p.anio
      from public.proyecto_participantes pp
      join public.proyectos p on p.id = pp.proyecto_id
     where p_proyecto is null or pp.proyecto_id = p_proyecto
  loop
    v_ver := app.condicion_en_periodo(r.cedula_hash, r.matricula,
                                      r.fecha_inicio, r.anio,
                                      coalesce(r.condicion, 'externo'));
    update public.proyecto_participantes set
      condicion = (v_ver->>'condicion')::public.condicion_participante,
      condicion_origen = v_ver->>'origen',
      periodo_verificado = v_ver->>'periodo',
      matricula = coalesce(v_ver->>'matricula', matricula),
      carrera = coalesce(v_ver->>'carrera', carrera),
      tipo = case when (v_ver->>'condicion') = 'estudiante' then 'estudiante'::public.tipo_participante
                  when (v_ver->>'condicion') = 'docente'    then 'docente'::public.tipo_participante
                  else tipo end
     where id = r.id;
    v_n := v_n + 1;
    if r.condicion is distinct from (v_ver->>'condicion')::public.condicion_participante then
      v_cambios := v_cambios + 1;
    end if;
  end loop;
  perform public.auditar('participantes_verificados', 'proyectos', p_proyecto, null,
                         jsonb_build_object('revisados', v_n, 'reclasificados', v_cambios));
  return jsonb_build_object('ok', true, 'revisados', v_n, 'reclasificados', v_cambios);
end $$;
revoke execute on function public.proyecto_participantes_verificar(uuid) from public, anon;
grant  execute on function public.proyecto_participantes_verificar(uuid) to authenticated;

-- ── Desglose para el informe ───────────────────────────────────────────────────
create or replace function public.proyecto_desglose(p_proyecto uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total',        count(*),
    'asistieron',   count(*) filter (where asistio),
    'estudiantes',  count(*) filter (where condicion = 'estudiante'),
    'egresados',    count(*) filter (where condicion = 'egresado'),
    'docentes',     count(*) filter (where condicion = 'docente'),
    'externos',     count(*) filter (where condicion = 'externo' or condicion is null),
    'verificados',  count(*) filter (where periodo_verificado is not null),
    'sin_verificar',count(*) filter (where periodo_verificado is null),
    'por_carrera',  coalesce((select jsonb_object_agg(carrera, n) from (
                       select carrera, count(*) n from public.proyecto_participantes
                        where proyecto_id = p_proyecto and carrera is not null
                        group by carrera) x), '{}'::jsonb),
    'por_fuente',   coalesce((select jsonb_object_agg(fuente, n) from (
                       select fuente, count(*) n from public.proyecto_participantes
                        where proyecto_id = p_proyecto group by fuente) y), '{}'::jsonb))
  from public.proyecto_participantes pp
  join public.proyectos p on p.id = pp.proyecto_id
 where pp.proyecto_id = p_proyecto
   and (app.es('admin','coordinacion','secretaria','auditor')
        or p.docente_responsable = auth.uid() or p.creado_por = auth.uid())
$$;
revoke execute on function public.proyecto_desglose(uuid) from public, anon;
grant  execute on function public.proyecto_desglose(uuid) to authenticated;;
