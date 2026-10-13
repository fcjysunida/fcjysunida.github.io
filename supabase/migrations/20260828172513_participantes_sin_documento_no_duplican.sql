-- Al reimportar un formulario, los participantes sin documento se duplicaban:
-- el control de duplicados miraba solo el HMAC de la cédula, que en ellos es
-- nulo. Ahora, cuando no hay documento, se compara por nombre normalizado
-- dentro del mismo proyecto.

create or replace function public.proyecto_desde_formato(p_datos jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid; v_doc uuid; v_fecha date; v_anio smallint;
  d jsonb; e jsonb; v_ver jsonb; v_doc_num text; v_hash text; v_norm text;
  v_est int := 0; v_docs int := 0; v_ext int := 0; v_nuevo boolean := true;
begin
  if not app.es('admin','coordinacion','secretaria') then
    raise exception 'Su rol no importa proyectos.';
  end if;

  v_fecha := nullif(p_datos->>'fecha_inicio','')::date;
  v_anio  := nullif(p_datos->>'anio','')::smallint;

  select id into v_id from public.proyectos
   where lower(btrim(nombre)) = lower(btrim(p_datos->>'nombre'))
     and anio is not distinct from v_anio;

  if v_id is null then
    insert into public.proyectos (
      nombre, clasificacion, estado, anio, fecha_inicio, fecha_fin,
      periodo_academico, carreras, curso, localizacion, otras_organizaciones,
      lider, tutor, entregable, proyectos_relacionados, horas_reloj,
      beneficiarios_directos, propuesta, fuente, creado_por)
    values (
      btrim(p_datos->>'nombre'),
      coalesce(nullif(p_datos->>'clasificacion','')::public.clasificacion_proyecto,
               'experiencia_conocimiento'),
      coalesce(nullif(p_datos->>'estado','')::public.estado_proyecto, 'finalizado'),
      v_anio, v_fecha, nullif(p_datos->>'fecha_fin','')::date,
      case when v_fecha is not null then app.periodo_de(v_fecha) else null end,
      nullif(btrim(coalesce(p_datos->>'carreras','')),''),
      nullif(btrim(coalesce(p_datos->>'curso','')),''),
      nullif(btrim(coalesce(p_datos->>'localizacion','')),''),
      nullif(btrim(coalesce(p_datos->>'otras_organizaciones','')),''),
      nullif(btrim(coalesce(p_datos->>'lider','')),''),
      nullif(btrim(coalesce(p_datos->>'tutor','')),''),
      nullif(btrim(coalesce(p_datos->>'entregable','')),''),
      nullif(btrim(coalesce(p_datos->>'proyectos_relacionados','')),''),
      coalesce((p_datos->>'horas_reloj')::numeric, 0),
      coalesce(jsonb_array_length(p_datos->'estudiantes'), 0),
      coalesce(p_datos->'propuesta', '{}'::jsonb),
      p_datos->>'archivo', auth.uid())
    returning id into v_id;
  else
    v_nuevo := false;
    update public.proyectos set
      fecha_inicio = coalesce(v_fecha, fecha_inicio),
      fecha_fin = coalesce(nullif(p_datos->>'fecha_fin','')::date, fecha_fin),
      lider = coalesce(nullif(btrim(coalesce(p_datos->>'lider','')),''), lider),
      localizacion = coalesce(nullif(btrim(coalesce(p_datos->>'localizacion','')),''), localizacion),
      entregable = coalesce(nullif(btrim(coalesce(p_datos->>'entregable','')),''), entregable),
      carreras = coalesce(nullif(btrim(coalesce(p_datos->>'carreras','')),''), carreras),
      horas_reloj = greatest(horas_reloj, coalesce((p_datos->>'horas_reloj')::numeric, 0)),
      propuesta = propuesta || coalesce(p_datos->'propuesta', '{}'::jsonb),
      actualizado_en = now()
     where id = v_id;
  end if;

  for d in select * from jsonb_array_elements(coalesce(p_datos->'docentes','[]'::jsonb)) loop
    if coalesce(btrim(d->>'nombre'),'') = '' then continue; end if;
    begin
      v_doc := ((public.docente_registrar(
        d->>'nombre', nullif(d->>'email',''),
        case when coalesce(d->>'catedra','') <> ''
             then array[d->>'catedra'] else '{}'::text[] end,
        nullif(p_datos->>'carreras','')))->>'id')::uuid;
      perform public.proyecto_docente_vincular(v_id, v_doc,
        coalesce(nullif(d->>'rol',''), 'responsable'), nullif(d->>'catedra',''));
      v_docs := v_docs + 1;
    exception when others then
      -- Un rótulo de tabla que se coló no debe voltear la importación entera.
      null;
    end;
  end loop;

  for e in select * from jsonb_array_elements(coalesce(p_datos->'estudiantes','[]'::jsonb)) loop
    if coalesce(btrim(e->>'nombre'),'') = '' then continue; end if;
    v_doc_num := upper(regexp_replace(coalesce(e->>'cedula',''), '[^0-9A-Za-z]', '', 'g'));
    v_hash := case when v_doc_num <> '' then app.hash_cedula(v_doc_num) else null end;
    v_norm := regexp_replace(lower(public.unaccent_simple(btrim(e->>'nombre'))), '[^a-z0-9]', '', 'g');

    -- Con documento se compara por HMAC; sin documento, por nombre normalizado.
    if exists (
      select 1 from public.proyecto_participantes pp
       where pp.proyecto_id = v_id
         and ((v_hash is not null and pp.cedula_hash = v_hash)
              or (v_hash is null
                  and regexp_replace(lower(public.unaccent_simple(pp.nombre)),
                                     '[^a-z0-9]', '', 'g') = v_norm))
    ) then continue; end if;

    v_ver := app.condicion_en_periodo(v_hash, nullif(btrim(coalesce(e->>'matricula','')),''),
                                      v_fecha, v_anio, 'estudiante');

    insert into public.proyecto_participantes (
      proyecto_id, tipo, nombre, cedula_hash, cedula_cif, cedula_mascara,
      matricula, carrera, ciclo, condicion, condicion_origen, periodo_verificado,
      asistio, fuente, orden)
    values (
      v_id, 'estudiante', btrim(e->>'nombre'), v_hash,
      case when v_doc_num <> '' then app.cifrar(v_doc_num) else null end,
      case when v_doc_num <> '' then app.mascara_cedula(v_doc_num) else null end,
      coalesce(nullif(btrim(coalesce(e->>'matricula','')),''), v_ver->>'matricula'),
      coalesce(nullif(btrim(coalesce(e->>'carrera','')),''), v_ver->>'carrera'),
      nullif(btrim(coalesce(e->>'ciclo','')),''),
      (v_ver->>'condicion')::public.condicion_participante,
      v_ver->>'origen', v_ver->>'periodo',
      true, 'formato oficial',
      (select coalesce(max(orden),0)+1 from public.proyecto_participantes
        where proyecto_id = v_id));
    v_est := v_est + 1;
  end loop;

  for e in select * from jsonb_array_elements(coalesce(p_datos->'externos','[]'::jsonb)) loop
    if coalesce(btrim(e->>'nombre'),'') = '' then continue; end if;
    v_norm := regexp_replace(lower(public.unaccent_simple(btrim(e->>'nombre'))), '[^a-z0-9]', '', 'g');
    if exists (select 1 from public.proyecto_participantes pp
                where pp.proyecto_id = v_id
                  and regexp_replace(lower(public.unaccent_simple(pp.nombre)),
                                     '[^a-z0-9]', '', 'g') = v_norm) then continue; end if;
    insert into public.proyecto_participantes (
      proyecto_id, tipo, nombre, organizacion, condicion, condicion_origen,
      asistio, fuente, orden)
    values (v_id, 'externo', btrim(e->>'nombre'), nullif(e->>'organizacion',''),
            'externo', 'declarado en el formulario oficial', true, 'formato oficial',
            (select coalesce(max(orden),0)+1 from public.proyecto_participantes
              where proyecto_id = v_id));
    v_ext := v_ext + 1;
  end loop;

  perform public.auditar(
    case when v_nuevo then 'alta_proyecto' else 'edicion_proyecto' end,
    'proyectos', v_id, null,
    jsonb_build_object('archivo', p_datos->>'archivo', 'formato', p_datos->>'formato',
                       'estudiantes', v_est, 'docentes', v_docs, 'externos', v_ext));

  return jsonb_build_object('ok', true, 'id', v_id, 'nuevo', v_nuevo,
    'estudiantes', v_est, 'docentes', v_docs, 'externos', v_ext);
end $$;
revoke execute on function public.proyecto_desde_formato(jsonb) from public, anon;
grant  execute on function public.proyecto_desde_formato(jsonb) to authenticated;

-- Se eliminan los duplicados que dejó la versión anterior.
delete from public.proyecto_participantes pp
 using public.proyecto_participantes otro
 where pp.proyecto_id = otro.proyecto_id
   and pp.cedula_hash is null and otro.cedula_hash is null
   and regexp_replace(lower(public.unaccent_simple(pp.nombre)), '[^a-z0-9]', '', 'g')
     = regexp_replace(lower(public.unaccent_simple(otro.nombre)), '[^a-z0-9]', '', 'g')
   and pp.orden > otro.orden;

select (select count(*) from public.proyecto_participantes) as participantes;;
