-- Alta de períodos, importación del padrón y recruce de inscripciones.

create or replace function public.periodo_academico_guardar(
  p_codigo text, p_desde date, p_hasta date)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not app.es('admin','coordinacion','secretaria') then
    raise exception 'Su rol no administra los períodos académicos.';
  end if;
  insert into public.periodos_academicos (codigo, anio, semestre, desde, hasta)
  values (p_codigo, split_part(p_codigo,'-',1)::smallint,
          split_part(p_codigo,'-',2)::smallint, p_desde, p_hasta)
  on conflict (codigo) do update set desde = excluded.desde, hasta = excluded.hasta;
  perform public.auditar('periodo_academico', 'periodos_academicos', null, null,
                         jsonb_build_object('codigo', p_codigo));
  return jsonb_build_object('ok', true, 'codigo', p_codigo);
end $$;
revoke execute on function public.periodo_academico_guardar(text, date, date) from public, anon;
grant  execute on function public.periodo_academico_guardar(text, date, date) to authenticated;

-- p_filas: [{"nombre":"...","cedula":"...","matricula":"...","carrera":"...","ciclo":"..."}]
-- La cédula se cifra y se convierte a HMAC acá dentro: la planilla en claro no
-- queda en la base ni pasa por el navegador del panel.
create or replace function public.padron_importar(
  p_periodo text, p_condicion public.condicion_academica, p_filas jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  f jsonb; v_ced text; v_hash text;
  v_alta int := 0; v_actualizadas int := 0; v_omitidas int := 0;
begin
  if not app.es('admin','secretaria') then
    raise exception 'Su rol no importa el padrón académico.';
  end if;
  if not exists (select 1 from public.periodos_academicos where codigo = p_periodo) then
    raise exception 'El período % no existe. Créelo primero con periodo_academico_guardar().', p_periodo;
  end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    v_ced := regexp_replace(coalesce(f->>'cedula',''), '[^0-9A-Za-z]', '', 'g');
    if v_ced = '' or coalesce(btrim(f->>'nombre'),'') = '' then
      v_omitidas := v_omitidas + 1;
      continue;
    end if;
    v_hash := app.hash_cedula(v_ced);

    insert into public.padron (periodo, condicion, nombre, cedula_hash, cedula_cif,
                               cedula_mascara, matricula, carrera, ciclo, cargado_por)
    values (p_periodo, p_condicion, btrim(f->>'nombre'), v_hash, app.cifrar(v_ced),
            app.mascara_cedula(v_ced), nullif(btrim(coalesce(f->>'matricula','')),''),
            nullif(btrim(coalesce(f->>'carrera','')),''),
            nullif(btrim(coalesce(f->>'ciclo','')),''), auth.uid())
    on conflict (periodo, cedula_hash) do update
      set nombre = excluded.nombre, condicion = excluded.condicion,
          matricula = coalesce(excluded.matricula, public.padron.matricula),
          carrera   = coalesce(excluded.carrera,   public.padron.carrera),
          ciclo     = coalesce(excluded.ciclo,     public.padron.ciclo);

    if found then v_actualizadas := v_actualizadas + 1; else v_alta := v_alta + 1; end if;
  end loop;

  perform public.auditar('padron_importado', 'padron', null, null,
    jsonb_build_object('periodo', p_periodo, 'condicion', p_condicion,
                       'filas', jsonb_array_length(p_filas), 'omitidas', v_omitidas));

  return jsonb_build_object('ok', true, 'periodo', p_periodo, 'condicion', p_condicion,
    'procesadas', v_alta + v_actualizadas, 'omitidas', v_omitidas,
    'total_periodo', (select count(*) from public.padron where periodo = p_periodo));
end $$;
revoke execute on function public.padron_importar(text, public.condicion_academica, jsonb) from public, anon;
grant  execute on function public.padron_importar(text, public.condicion_academica, jsonb) to authenticated;

-- ── Recruce ────────────────────────────────────────────────────────────────────
-- Se corre después de importar el padrón, para que las inscripciones ya
-- registradas queden clasificadas con el dato verificado y no con el declarado.
create or replace function public.recruzar_padron(p_actividad uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r record; v jsonb; v_n int := 0; v_cambios int := 0;
begin
  if not app.es('admin','coordinacion','secretaria') then
    raise exception 'Su rol no recruza el padrón.';
  end if;

  for r in
    select i.id, i.cedula_hash, i.condicion, i.condicion_declarada, a.fecha_inicio
      from public.inscripciones i
      join public.actividades a on a.id = i.actividad_id
     where i.anonimizada_en is null
       and (p_actividad is null or i.actividad_id = p_actividad)
  loop
    v := app.condicion_verificada(
           r.cedula_hash, r.fecha_inicio,
           coalesce(r.condicion_declarada, r.condicion));
    update public.inscripciones set
      condicion_declarada = coalesce(condicion_declarada, r.condicion),
      condicion       = (v->>'condicion')::public.condicion_participante,
      matricula       = v->>'matricula',
      ciclo           = v->>'ciclo',
      carrera         = coalesce(v->>'carrera', carrera),
      padron_periodo  = v->>'periodo',
      condicion_origen = v->>'origen'
     where id = r.id;
    v_n := v_n + 1;
    if (v->>'condicion')::public.condicion_participante <> r.condicion then
      v_cambios := v_cambios + 1;
    end if;
  end loop;

  perform public.auditar('recruce_padron', 'inscripciones', p_actividad, null,
    jsonb_build_object('revisadas', v_n, 'reclasificadas', v_cambios));
  return jsonb_build_object('ok', true, 'revisadas', v_n, 'reclasificadas', v_cambios);
end $$;
revoke execute on function public.recruzar_padron(uuid) from public, anon;
grant  execute on function public.recruzar_padron(uuid) to authenticated;

-- ── Resumen del padrón ─────────────────────────────────────────────────────────
create or replace function public.padron_resumen()
returns table (periodo text, desde date, hasta date, estudiantes bigint, egresados bigint)
language sql stable security definer set search_path = '' as $$
  select p.codigo, p.desde, p.hasta,
         count(*) filter (where d.condicion = 'estudiante'),
         count(*) filter (where d.condicion = 'egresado')
    from public.periodos_academicos p
    left join public.padron d on d.periodo = p.codigo
   where app.es('admin','coordinacion','secretaria','auditor')
   group by p.codigo, p.desde, p.hasta
   order by p.codigo desc
$$;
revoke execute on function public.padron_resumen() from public, anon;
grant  execute on function public.padron_resumen() to authenticated;;
