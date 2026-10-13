-- Carga manual de horas para una persona del padrón. El motivo es obligatorio:
-- estas horas no tienen respaldo de asistencia en la plataforma y la única
-- trazabilidad posible es dejar escrito en qué se basa la acreditación.
create or replace function horas_extension_agregar(
  p_padron_id uuid,
  p_horas     numeric,
  p_periodo   text default null,
  p_motivo    text default null,
  p_detalle   text default null,
  p_origen    text default 'historica',
  p_proyecto  uuid default null
) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare r public.padron%rowtype; v_id uuid;
begin
  if not app.es('admin', 'coordinacion') then
    raise exception 'Solo la Dirección y la Coordinación acreditan horas de extensión.';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Indique el motivo: estas horas no tienen respaldo en la plataforma.';
  end if;
  if p_horas is null or p_horas <= 0 then
    raise exception 'Las horas deben ser mayores que cero.';
  end if;
  if p_origen not in ('historica', 'ajuste') then
    raise exception 'Origen inválido: use «historica» o «ajuste».';
  end if;

  select * into r from public.padron where id = p_padron_id;
  if not found then raise exception 'La persona no figura en el padrón.'; end if;

  insert into public.horas_extension (
    cedula_hash, matricula, nombre, periodo, horas, origen,
    proyecto_id, detalle, motivo, cargado_por)
  values (
    r.cedula_hash, r.matricula, r.nombre,
    coalesce(nullif(btrim(p_periodo), ''), r.periodo),
    p_horas, p_origen, p_proyecto, nullif(btrim(p_detalle), ''),
    btrim(p_motivo), auth.uid())
  returning id into v_id;

  perform public.auditar('horas_extension_acreditadas', 'padron', p_padron_id, btrim(p_motivo),
    jsonb_build_object('horas', p_horas, 'origen', p_origen,
                       'periodo', coalesce(nullif(btrim(p_periodo), ''), r.periodo)));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Acreditación por egreso. A quien ya tiene título se le reconocen las horas
-- que le faltan para la meta, imputadas a su período de egreso, porque el
-- título prueba que cumplió el requisito aunque la plataforma no lo registre.
-- No se le inventa participación en proyectos concretos: se acredita el saldo,
-- que es lo que efectivamente consta.
create or replace function horas_extension_acreditar_egresados(
  p_cohortes text[] default array['2020', '2021'],
  p_motivo   text    default 'Acreditación por egreso: el título prueba el cumplimiento del requisito de Extensión Universitaria, anterior a esta plataforma.',
  p_dry_run  boolean default true
) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  v_meta numeric := app.meta_horas_extension();
  v_filas jsonb; v_n int := 0; v_horas numeric := 0;
begin
  if not app.es('admin', 'coordinacion') then
    raise exception 'Solo la Dirección y la Coordinación acreditan horas de extensión.';
  end if;

  create temporary table pendientes on commit drop as
  select e.clave, e.cedula_hash, e.matricula, e.nombre, e.cohorte,
         e.periodo, e.horas_total, (v_meta - e.horas_total) as faltan
    from public.extension_personas e
   where e.condicion = 'egresado'
     and e.cohorte = any (p_cohortes)
     and e.horas_total < v_meta;

  select count(*), coalesce(sum(faltan), 0) into v_n, v_horas from pendientes;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', nombre, 'matricula', matricula, 'cohorte', cohorte,
           'periodo_egreso', periodo, 'tenia', horas_total, 'se_acreditan', faltan)
           order by nombre), '[]'::jsonb)
    into v_filas from pendientes;

  if p_dry_run then
    return jsonb_build_object('simulacion', true, 'meta', v_meta,
      'personas', v_n, 'horas', v_horas, 'detalle', v_filas);
  end if;

  insert into public.horas_extension (
    cedula_hash, matricula, nombre, periodo, horas, origen, motivo, detalle, cargado_por)
  select cedula_hash, matricula, nombre, periodo, faltan, 'historica', p_motivo,
         'Saldo acreditado para alcanzar la meta de ' || v_meta || ' horas de la carrera.',
         auth.uid()
    from pendientes;

  perform public.auditar('horas_extension_acreditadas_por_egreso', 'padron', null, p_motivo,
    jsonb_build_object('cohortes', p_cohortes, 'meta', v_meta,
                       'personas', v_n, 'horas', v_horas));

  return jsonb_build_object('simulacion', false, 'meta', v_meta,
    'personas', v_n, 'horas', v_horas, 'detalle', v_filas);
end $$;

revoke execute on function horas_extension_agregar(uuid, numeric, text, text, text, text, uuid) from public, anon;
revoke execute on function horas_extension_acreditar_egresados(text[], text, boolean) from public, anon;
grant execute on function horas_extension_agregar(uuid, numeric, text, text, text, text, uuid) to authenticated;
grant execute on function horas_extension_acreditar_egresados(text[], text, boolean) to authenticated;;
