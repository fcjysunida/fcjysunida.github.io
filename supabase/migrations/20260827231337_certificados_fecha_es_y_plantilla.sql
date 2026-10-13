-- Dos correcciones en la emisión de certificados:
--
-- 1. `to_char(fecha,'TMMonth')` devolvía «August»: el `lc_time` del servidor no
--    es español y TM depende de eso. Se usa un arreglo propio de meses.
-- 2. La elección de plantilla ordenaba por `(rol = p_rol) desc`, y para la
--    plantilla genérica (rol NULL) esa expresión da NULL. En Postgres, ORDER BY
--    ... DESC pone los NULL primero, así que la genérica le ganaba siempre a la
--    específica. Falta `nulls last`.

create or replace function app.mes_es(p_fecha date)
returns text language sql immutable set search_path = '' as $$
  select (array['enero','febrero','marzo','abril','mayo','junio','julio',
                'agosto','septiembre','octubre','noviembre','diciembre'])
         [extract(month from p_fecha)::int]
$$;

create or replace function app.fecha_larga(p_inicio date, p_dias smallint)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_dias <= 1 then
      extract(day from p_inicio)::int || ' de ' || app.mes_es(p_inicio)
      || ' de ' || extract(year from p_inicio)::int
    when app.mes_es(p_inicio) = app.mes_es(p_inicio + (p_dias - 1)) then
      'del ' || extract(day from p_inicio)::int || ' al '
      || extract(day from p_inicio + (p_dias - 1))::int || ' de '
      || app.mes_es(p_inicio) || ' de ' || extract(year from p_inicio + (p_dias - 1))::int
    else
      'del ' || extract(day from p_inicio)::int || ' de ' || app.mes_es(p_inicio)
      || ' al ' || extract(day from p_inicio + (p_dias - 1))::int || ' de '
      || app.mes_es(p_inicio + (p_dias - 1)) || ' de '
      || extract(year from p_inicio + (p_dias - 1))::int
  end
$$;

create or replace function public.emitir_certificados(
  p_actividad uuid,
  p_rol public.rol_certificado default 'participante',
  p_minimo_jornadas smallint default 1,
  p_plantilla uuid default null,
  p_solo_simulacion boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.actividades%rowtype; r record;
  v_plantilla uuid; v_n int := 0; v_ya int := 0; v_fecha text;
begin
  if not app.es('admin','coordinacion','secretaria') then
    raise exception 'Su rol no emite certificados.';
  end if;
  select * into a from public.actividades where id = p_actividad;
  if not found then raise exception 'La actividad no existe.'; end if;

  -- La plantilla específica del rol le gana a la genérica.
  v_plantilla := coalesce(p_plantilla, (
    select id from public.certificado_plantillas
     where vigente and (rol = p_rol or rol is null)
     order by (rol = p_rol) desc nulls last, creado_en desc
     limit 1));

  v_fecha := app.fecha_larga(a.fecha_inicio, a.dias);

  for r in
    select i.id, i.nombre,
           (select count(*) from public.asistencias s where s.inscripcion_id = i.id) as jornadas
      from public.inscripciones i
     where i.actividad_id = p_actividad
       and i.estado = 'confirmada'
       and i.requiere_certificado
       and i.anonimizada_en is null
  loop
    if r.jornadas < p_minimo_jornadas then continue; end if;
    if exists (select 1 from public.certificados c
                where c.inscripcion_id = r.id and c.rol = p_rol and c.anulado_en is null) then
      v_ya := v_ya + 1; continue;
    end if;
    v_n := v_n + 1;
    if p_solo_simulacion then continue; end if;

    insert into public.certificados (
      inscripcion_id, actividad_id, plantilla_id, codigo, rol,
      nombre, evento, fecha_texto, horas, jornadas, emitido_por)
    values (r.id, p_actividad, v_plantilla, app.codigo_certificado(), p_rol,
            r.nombre, a.titulo, v_fecha, a.horas_academicas, r.jornadas, auth.uid());
  end loop;

  if not p_solo_simulacion then
    perform public.auditar('emision_certificados', 'actividades', p_actividad, null,
      jsonb_build_object('rol', p_rol, 'emitidos', v_n, 'minimo_jornadas', p_minimo_jornadas));
  end if;

  return jsonb_build_object('ok', true, 'simulacion', p_solo_simulacion,
    'a_emitir', v_n, 'ya_tenian', v_ya, 'plantilla', v_plantilla,
    'sin_plantilla', v_plantilla is null);
end $$;
revoke execute on function public.emitir_certificados(
  uuid, public.rol_certificado, smallint, uuid, boolean) from public, anon;
grant execute on function public.emitir_certificados(
  uuid, public.rol_certificado, smallint, uuid, boolean) to authenticated;

-- El correo de confirmación también usaba el mes en inglés indirectamente; se
-- deja la fecha en formato numérico, que no depende de la configuración regional.;
