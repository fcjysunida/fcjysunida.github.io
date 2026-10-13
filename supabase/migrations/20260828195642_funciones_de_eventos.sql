create or replace function evento_guardar(p_datos jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_id uuid; v_nuevo boolean := false;
begin
  if not app.es('admin', 'coordinacion', 'secretaria') then
    raise exception 'Su rol no registra eventos de vinculación.';
  end if;

  v_id := nullif(p_datos->>'id', '')::uuid;

  if v_id is null then
    insert into public.eventos (
      titulo, tipo, fecha, fecha_fin, lugar, organizacion, carreras, vinculo,
      resumen, informe, informe_en, beneficiarios, certifica, horas_reloj,
      docente_responsable, proyecto_id, creado_por)
    values (
      btrim(p_datos->>'titulo'),
      coalesce(nullif(p_datos->>'tipo', ''), 'otro')::public.tipo_evento,
      (p_datos->>'fecha')::date,
      nullif(p_datos->>'fecha_fin', '')::date,
      nullif(btrim(coalesce(p_datos->>'lugar', '')), ''),
      nullif(btrim(coalesce(p_datos->>'organizacion', '')), ''),
      coalesce(array(select jsonb_array_elements_text(p_datos->'carreras')), '{}'),
      coalesce(array(select jsonb_array_elements_text(p_datos->'vinculo')), '{}'),
      nullif(btrim(coalesce(p_datos->>'resumen', '')), ''),
      nullif(btrim(coalesce(p_datos->>'informe', '')), ''),
      nullif(p_datos->>'informe_en', '')::date,
      nullif(p_datos->>'beneficiarios', '')::int,
      coalesce((p_datos->>'certifica')::boolean, false),
      nullif(p_datos->>'horas_reloj', '')::numeric,
      nullif(p_datos->>'docente_responsable', '')::uuid,
      nullif(p_datos->>'proyecto_id', '')::uuid,
      auth.uid())
    returning id into v_id;
    v_nuevo := true;
  else
    update public.eventos set
      titulo       = coalesce(nullif(btrim(coalesce(p_datos->>'titulo', '')), ''), titulo),
      tipo         = coalesce(nullif(p_datos->>'tipo', '')::public.tipo_evento, tipo),
      fecha        = coalesce(nullif(p_datos->>'fecha', '')::date, fecha),
      fecha_fin    = coalesce(nullif(p_datos->>'fecha_fin', '')::date, fecha_fin),
      lugar        = coalesce(nullif(btrim(coalesce(p_datos->>'lugar', '')), ''), lugar),
      organizacion = coalesce(nullif(btrim(coalesce(p_datos->>'organizacion', '')), ''), organizacion),
      carreras     = coalesce(nullif(array(select jsonb_array_elements_text(p_datos->'carreras')), '{}'), carreras),
      vinculo      = coalesce(nullif(array(select jsonb_array_elements_text(p_datos->'vinculo')), '{}'), vinculo),
      resumen      = coalesce(nullif(btrim(coalesce(p_datos->>'resumen', '')), ''), resumen),
      informe      = coalesce(nullif(btrim(coalesce(p_datos->>'informe', '')), ''), informe),
      informe_en   = coalesce(nullif(p_datos->>'informe_en', '')::date, informe_en),
      beneficiarios = coalesce(nullif(p_datos->>'beneficiarios', '')::int, beneficiarios),
      certifica    = coalesce((p_datos->>'certifica')::boolean, certifica),
      horas_reloj  = coalesce(nullif(p_datos->>'horas_reloj', '')::numeric, horas_reloj),
      docente_responsable = coalesce(nullif(p_datos->>'docente_responsable', '')::uuid, docente_responsable),
      proyecto_id  = coalesce(nullif(p_datos->>'proyecto_id', '')::uuid, proyecto_id),
      actualizado_en = now()
     where id = v_id;
    if not found then raise exception 'El evento no existe.'; end if;
  end if;

  perform public.auditar(
    case when v_nuevo then 'evento_registrado' else 'evento_actualizado' end,
    'eventos', v_id, null, jsonb_build_object('titulo', p_datos->>'titulo'));

  return jsonb_build_object('ok', true, 'id', v_id, 'nuevo', v_nuevo);
end $$;

-- Nómina del evento. Verifica la condición contra el padrón del período del
-- evento, igual que en los proyectos.
create or replace function evento_participantes_agregar(
  p_evento uuid, p_filas jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  e public.eventos%rowtype; f jsonb; v_ver jsonb;
  v_hash text; v_doc text; v_n int := 0; v_ya int := 0; v_om int := 0;
begin
  if not app.es('admin', 'coordinacion', 'secretaria') then
    raise exception 'Su rol no edita la nómina de un evento.';
  end if;
  select * into e from public.eventos where id = p_evento;
  if not found then raise exception 'El evento no existe.'; end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    if coalesce(btrim(f->>'nombre'), '') = '' then v_om := v_om + 1; continue; end if;

    v_doc  := upper(regexp_replace(coalesce(f->>'cedula', ''), '[^0-9A-Za-z]', '', 'g'));
    v_hash := case when v_doc <> '' then app.hash_cedula(v_doc) else null end;

    if exists (select 1 from public.evento_participantes ep
                where ep.evento_id = p_evento
                  and ((v_hash is not null and ep.cedula_hash = v_hash)
                    or (v_hash is null
                        and public.unaccent_simple(lower(ep.nombre))
                            = public.unaccent_simple(lower(btrim(f->>'nombre')))))) then
      v_ya := v_ya + 1; continue;
    end if;

    v_ver := app.condicion_en_periodo(
      v_hash, nullif(btrim(coalesce(f->>'matricula', '')), ''),
      e.fecha, extract(year from e.fecha)::int,
      coalesce(nullif(f->>'tipo', '')::public.condicion_participante, 'externo'));

    insert into public.evento_participantes (
      evento_id, tipo, nombre, cedula_hash, cedula_cif, cedula_mascara,
      matricula, carrera, organizacion, condicion, condicion_origen,
      periodo_verificado, asistio, orden)
    values (
      p_evento,
      case when (v_ver->>'condicion') = 'estudiante' then 'estudiante'::public.tipo_participante
           when (v_ver->>'condicion') = 'docente'    then 'docente'::public.tipo_participante
           else 'externo'::public.tipo_participante end,
      btrim(f->>'nombre'), v_hash,
      case when v_doc <> '' then app.cifrar(v_doc) else null end,
      case when v_doc <> '' then app.mascara_cedula(v_doc) else null end,
      coalesce(v_ver->>'matricula', nullif(btrim(coalesce(f->>'matricula', '')), '')),
      v_ver->>'carrera',
      nullif(btrim(coalesce(f->>'organizacion', '')), ''),
      (v_ver->>'condicion')::public.condicion_participante,
      v_ver->>'origen', v_ver->>'periodo',
      coalesce((f->>'asistio')::boolean, true),
      (select coalesce(max(orden), 0) + 1 from public.evento_participantes
        where evento_id = p_evento));
    v_n := v_n + 1;
  end loop;

  perform public.auditar('evento_participantes_agregados', 'eventos', p_evento, null,
    jsonb_build_object('agregados', v_n, 'ya_estaban', v_ya, 'omitidos', v_om));
  return jsonb_build_object('ok', true, 'agregados', v_n, 'ya_estaban', v_ya, 'omitidos', v_om);
end $$;

revoke execute on function evento_guardar(jsonb) from public, anon;
revoke execute on function evento_participantes_agregar(uuid, jsonb) from public, anon;
grant execute on function evento_guardar(jsonb) to authenticated;
grant execute on function evento_participantes_agregar(uuid, jsonb) to authenticated;;
