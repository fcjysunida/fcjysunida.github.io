-- Alta o edición de una pasantía. Identifica a la persona por su fila del padrón.
create or replace function pasantia_guardar(p_datos jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare r public.padron%rowtype; v_id uuid; v_nuevo boolean := false;
begin
  if not app.es('admin', 'coordinacion', 'secretaria') then
    raise exception 'Su rol no registra pasantías.';
  end if;

  v_id := nullif(p_datos->>'id', '')::uuid;

  if v_id is null then
    select * into r from public.padron where id = (p_datos->>'padron_id')::uuid;
    if not found then raise exception 'La persona no figura en el padrón.'; end if;

    insert into public.pasantias (
      cedula_hash, matricula, nombre, carrera, periodo, semestre, modalidad, estado,
      organizacion, area, con_convenio, fecha_inicio, fecha_fin, horas, docente_asesor,
      ficha_recibida, ficha_firmada, nota_empresa, nota_universidad,
      informe_presentado_en, informe_observado_en, informe_subsanado_en,
      conformidad_en, acta_en, convalidacion_solicitada_en, convalidacion_resuelta_en,
      certificacion, motivo, observaciones, creado_por)
    values (
      r.cedula_hash, r.matricula, r.nombre, r.carrera,
      coalesce(nullif(p_datos->>'periodo', ''), r.periodo),
      nullif(p_datos->>'semestre', '')::smallint,
      coalesce(nullif(p_datos->>'modalidad', ''), 'curricular')::public.modalidad_pasantia,
      coalesce(nullif(p_datos->>'estado', ''), 'inscrita')::public.estado_pasantia,
      nullif(btrim(coalesce(p_datos->>'organizacion', '')), ''),
      nullif(btrim(coalesce(p_datos->>'area', '')), ''),
      coalesce((p_datos->>'con_convenio')::boolean, false),
      nullif(p_datos->>'fecha_inicio', '')::date,
      nullif(p_datos->>'fecha_fin', '')::date,
      coalesce((p_datos->>'horas')::numeric, 0),
      nullif(p_datos->>'docente_asesor', '')::uuid,
      coalesce((p_datos->>'ficha_recibida')::boolean, false),
      coalesce((p_datos->>'ficha_firmada')::boolean, false),
      nullif(p_datos->>'nota_empresa', '')::numeric,
      nullif(p_datos->>'nota_universidad', '')::numeric,
      nullif(p_datos->>'informe_presentado_en', '')::date,
      nullif(p_datos->>'informe_observado_en', '')::date,
      nullif(p_datos->>'informe_subsanado_en', '')::date,
      nullif(p_datos->>'conformidad_en', '')::date,
      nullif(p_datos->>'acta_en', '')::date,
      nullif(p_datos->>'convalidacion_solicitada_en', '')::date,
      nullif(p_datos->>'convalidacion_resuelta_en', '')::date,
      nullif(btrim(coalesce(p_datos->>'certificacion', '')), ''),
      nullif(btrim(coalesce(p_datos->>'motivo', '')), ''),
      nullif(btrim(coalesce(p_datos->>'observaciones', '')), ''),
      auth.uid())
    returning id into v_id;
    v_nuevo := true;
  else
    update public.pasantias set
      periodo       = coalesce(nullif(p_datos->>'periodo', ''), periodo),
      semestre      = coalesce(nullif(p_datos->>'semestre', '')::smallint, semestre),
      modalidad     = coalesce(nullif(p_datos->>'modalidad', '')::public.modalidad_pasantia, modalidad),
      estado        = coalesce(nullif(p_datos->>'estado', '')::public.estado_pasantia, estado),
      organizacion  = coalesce(nullif(btrim(coalesce(p_datos->>'organizacion', '')), ''), organizacion),
      area          = coalesce(nullif(btrim(coalesce(p_datos->>'area', '')), ''), area),
      con_convenio  = coalesce((p_datos->>'con_convenio')::boolean, con_convenio),
      fecha_inicio  = coalesce(nullif(p_datos->>'fecha_inicio', '')::date, fecha_inicio),
      fecha_fin     = coalesce(nullif(p_datos->>'fecha_fin', '')::date, fecha_fin),
      horas         = coalesce((p_datos->>'horas')::numeric, horas),
      docente_asesor = coalesce(nullif(p_datos->>'docente_asesor', '')::uuid, docente_asesor),
      ficha_recibida = coalesce((p_datos->>'ficha_recibida')::boolean, ficha_recibida),
      ficha_firmada  = coalesce((p_datos->>'ficha_firmada')::boolean, ficha_firmada),
      nota_empresa     = coalesce(nullif(p_datos->>'nota_empresa', '')::numeric, nota_empresa),
      nota_universidad = coalesce(nullif(p_datos->>'nota_universidad', '')::numeric, nota_universidad),
      informe_presentado_en = coalesce(nullif(p_datos->>'informe_presentado_en', '')::date, informe_presentado_en),
      informe_observado_en  = coalesce(nullif(p_datos->>'informe_observado_en', '')::date, informe_observado_en),
      informe_subsanado_en  = coalesce(nullif(p_datos->>'informe_subsanado_en', '')::date, informe_subsanado_en),
      conformidad_en = coalesce(nullif(p_datos->>'conformidad_en', '')::date, conformidad_en),
      acta_en        = coalesce(nullif(p_datos->>'acta_en', '')::date, acta_en),
      convalidacion_solicitada_en = coalesce(nullif(p_datos->>'convalidacion_solicitada_en', '')::date, convalidacion_solicitada_en),
      convalidacion_resuelta_en   = coalesce(nullif(p_datos->>'convalidacion_resuelta_en', '')::date, convalidacion_resuelta_en),
      certificacion  = coalesce(nullif(btrim(coalesce(p_datos->>'certificacion', '')), ''), certificacion),
      motivo         = coalesce(nullif(btrim(coalesce(p_datos->>'motivo', '')), ''), motivo),
      observaciones  = coalesce(nullif(btrim(coalesce(p_datos->>'observaciones', '')), ''), observaciones),
      actualizado_en = now()
     where id = v_id;
    if not found then raise exception 'La pasantía no existe.'; end if;
  end if;

  perform public.auditar(
    case when v_nuevo then 'pasantia_registrada' else 'pasantia_actualizada' end,
    'pasantias', v_id, nullif(btrim(coalesce(p_datos->>'motivo', '')), ''),
    jsonb_build_object('estado', p_datos->>'estado', 'modalidad', p_datos->>'modalidad'));

  return jsonb_build_object('ok', true, 'id', v_id, 'nuevo', v_nuevo);
end $$;

-- Convalidación por egreso (art. 35). El título prueba que la pasantía se
-- cumplió: se deja registro individual de cada caso, con su fundamento.
create or replace function pasantia_convalidar_egresados(
  p_cohortes text[] default null,
  p_motivo   text    default 'Convalidación por egreso (art. 35 del Reglamento de Práctica y Pasantía): el título acredita el cumplimiento del requisito, anterior a esta plataforma.',
  p_dry_run  boolean default true
) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_n int := 0; v_filas jsonb;
begin
  if not app.es('admin', 'coordinacion') then
    raise exception 'Solo la Dirección y la Coordinación convalidan pasantías.';
  end if;

  create temporary table pend on commit drop as
  select pp.cedula_hash, pp.matricula, pp.nombre, pp.carrera, pp.periodo, pp.cohorte
    from public.pasantias_personas pp
   where pp.condicion = 'egresado'
     and not pp.cumple
     and (p_cohortes is null or pp.cohorte = any (p_cohortes));

  select count(*) into v_n from pend;
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', nombre, 'matricula', matricula, 'cohorte', cohorte,
           'periodo_egreso', periodo) order by nombre), '[]'::jsonb)
    into v_filas from pend;

  if p_dry_run then
    return jsonb_build_object('simulacion', true, 'personas', v_n, 'detalle', v_filas);
  end if;

  insert into public.pasantias (
    cedula_hash, matricula, nombre, carrera, periodo,
    modalidad, estado, horas, motivo, certificacion,
    convalidacion_resuelta_en, creado_por)
  select cedula_hash, matricula, nombre, carrera, periodo,
         'convalidacion', 'convalidada',
         app.parametro('pasantia_horas_meta', 264),
         p_motivo,
         'Título de grado otorgado por la UNIDA.',
         current_date, auth.uid()
    from pend;

  perform public.auditar('pasantias_convalidadas_por_egreso', 'pasantias', null, p_motivo,
    jsonb_build_object('cohortes', p_cohortes, 'personas', v_n));

  return jsonb_build_object('simulacion', false, 'personas', v_n, 'detalle', v_filas);
end $$;

revoke execute on function pasantia_guardar(jsonb) from public, anon;
revoke execute on function pasantia_convalidar_egresados(text[], text, boolean) from public, anon;
revoke execute on function app.parametro(text, numeric) from public, anon;
grant execute on function pasantia_guardar(jsonb) to authenticated;
grant execute on function pasantia_convalidar_egresados(text[], text, boolean) to authenticated;;
