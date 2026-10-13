-- Las nóminas de egresados salen del sistema con matrícula pero sin cédula,
-- mientras que las de alumnos traen las dos cosas. Para que un egresado no
-- quede fuera del cruce, el padrón admite filas identificadas por matrícula y
-- después se vinculan: cuando aparece la misma matrícula en una nómina de
-- alumnos —que sí trae cédula— se completa el HMAC hacia atrás.

alter table public.padron alter column cedula_hash drop not null;
alter table public.padron drop constraint padron_periodo_cedula_hash_key;

create unique index padron_periodo_documento_idx
  on public.padron (periodo, cedula_hash) where cedula_hash is not null;
create unique index padron_periodo_matricula_idx
  on public.padron (periodo, matricula) where matricula is not null;

alter table public.padron add constraint padron_identificable
  check (cedula_hash is not null or matricula is not null);

-- ── Importación ────────────────────────────────────────────────────────────────
create or replace function public.padron_importar(
  p_periodo text, p_condicion public.condicion_academica, p_filas jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  f jsonb; v_doc text; v_hash text; v_mat text;
  v_n int := 0; v_omitidas int := 0; v_extranjeros int := 0; v_sin_doc int := 0;
begin
  if not app.es('admin','secretaria') then
    raise exception 'Su rol no importa el padrón académico.';
  end if;
  if not exists (select 1 from public.periodos_academicos where codigo = p_periodo) then
    raise exception 'El período % no existe. Créelo primero.', p_periodo;
  end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    v_doc := upper(regexp_replace(coalesce(f->>'cedula',''), '[^0-9A-Za-z]', '', 'g'));
    v_mat := nullif(btrim(coalesce(f->>'matricula','')), '');

    -- Hace falta el nombre y al menos uno de los dos identificadores.
    if coalesce(btrim(f->>'nombre'),'') = '' or (v_doc = '' and v_mat is null) then
      v_omitidas := v_omitidas + 1;
      continue;
    end if;

    if v_doc = '' then
      v_hash := null;
      v_sin_doc := v_sin_doc + 1;
    else
      if v_doc ~ '[A-Z]' then v_extranjeros := v_extranjeros + 1; end if;
      v_hash := app.hash_cedula(v_doc);
    end if;

    if v_hash is not null then
      insert into public.padron (periodo, condicion, nombre, cedula_hash, cedula_cif,
                                 cedula_mascara, tipo_documento, matricula, carrera,
                                 ciclo, cargado_por)
      values (p_periodo, p_condicion, btrim(f->>'nombre'), v_hash, app.cifrar(v_doc),
              app.mascara_cedula(v_doc), nullif(btrim(coalesce(f->>'tipo_documento','')),''),
              v_mat, nullif(btrim(coalesce(f->>'carrera','')),''),
              nullif(btrim(coalesce(f->>'ciclo','')),''), auth.uid())
      on conflict (periodo, cedula_hash) where cedula_hash is not null do update
        set nombre = excluded.nombre, condicion = excluded.condicion,
            tipo_documento = coalesce(excluded.tipo_documento, public.padron.tipo_documento),
            matricula = coalesce(excluded.matricula, public.padron.matricula),
            carrera   = coalesce(excluded.carrera,   public.padron.carrera),
            ciclo     = coalesce(excluded.ciclo,     public.padron.ciclo);
    else
      insert into public.padron (periodo, condicion, nombre, matricula, carrera,
                                 ciclo, cargado_por)
      values (p_periodo, p_condicion, btrim(f->>'nombre'), v_mat,
              nullif(btrim(coalesce(f->>'carrera','')),''),
              nullif(btrim(coalesce(f->>'ciclo','')),''), auth.uid())
      on conflict (periodo, matricula) where matricula is not null do update
        set nombre = excluded.nombre, condicion = excluded.condicion,
            carrera = coalesce(excluded.carrera, public.padron.carrera),
            ciclo   = coalesce(excluded.ciclo,   public.padron.ciclo);
    end if;
    v_n := v_n + 1;
  end loop;

  perform public.auditar('padron_importado', 'padron', null, null,
    jsonb_build_object('periodo', p_periodo, 'condicion', p_condicion,
                       'procesadas', v_n, 'omitidas', v_omitidas,
                       'documentos_no_paraguayos', v_extranjeros,
                       'solo_matricula', v_sin_doc));

  return jsonb_build_object('ok', true, 'periodo', p_periodo, 'condicion', p_condicion,
    'procesadas', v_n, 'omitidas', v_omitidas, 'documentos_no_paraguayos', v_extranjeros,
    'solo_matricula', v_sin_doc,
    'total_periodo', (select count(*) from public.padron where periodo = p_periodo));
end $$;
revoke execute on function public.padron_importar(text, public.condicion_academica, jsonb)
  from public, anon;
grant execute on function public.padron_importar(text, public.condicion_academica, jsonb)
  to authenticated;

-- ── Vinculación hacia atrás ────────────────────────────────────────────────────
-- Completa el HMAC de las filas que solo tienen matrícula, tomándolo de otra
-- fila del padrón con la misma matrícula que sí lo tenga.
create or replace function public.padron_vincular_por_matricula()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_n int;
begin
  if not app.es('admin','secretaria') then
    raise exception 'Su rol no vincula el padrón.';
  end if;

  with fuente as (
    select distinct on (matricula) matricula, cedula_hash, cedula_cif, cedula_mascara,
           tipo_documento
      from public.padron
     where cedula_hash is not null and matricula is not null
     order by matricula, periodo desc
  )
  update public.padron d
     set cedula_hash    = f.cedula_hash,
         cedula_cif     = f.cedula_cif,
         cedula_mascara = f.cedula_mascara,
         tipo_documento = coalesce(d.tipo_documento, f.tipo_documento)
    from fuente f
   where d.cedula_hash is null and d.matricula = f.matricula;
  get diagnostics v_n = row_count;

  perform public.auditar('padron_vinculado', 'padron', null, null,
                         jsonb_build_object('vinculadas', v_n));
  return jsonb_build_object('ok', true, 'vinculadas', v_n,
    'sin_vincular', (select count(*) from public.padron where cedula_hash is null));
end $$;
revoke execute on function public.padron_vincular_por_matricula() from public, anon;
grant  execute on function public.padron_vincular_por_matricula() to authenticated;;
