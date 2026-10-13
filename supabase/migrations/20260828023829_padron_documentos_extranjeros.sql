-- No todo el alumnado tiene cédula paraguaya. En las planillas aparecen también
-- documentos extranjeros («R.G» brasileño, pasaportes, DNI). Excluirlos los
-- dejaba fuera del padrón y, por lo tanto, contados como «externos» en el
-- informe, que es justamente lo contrario de lo que corresponde.
--
-- El cruce no necesita que el documento sea una cédula: necesita un
-- identificador estable. El HMAC funciona igual con letras. Lo único que hace
-- falta es guardar de qué documento se trata, y normalizar igual en los dos
-- lados —padrón y formulario— para que el hash coincida.

alter table public.padron add column tipo_documento text;

comment on column public.padron.cedula_hash is
  'HMAC del número de documento, sea cédula paraguaya o documento extranjero.';

-- La normalización pasa a mayúsculas: «ab123456» y «AB-123456» son la misma
-- persona. Para las cédulas numéricas el resultado no cambia, así que los
-- hashes ya calculados siguen siendo válidos.
create or replace function app.hash_cedula(p_cedula text)
returns text language sql security definer stable set search_path = '' as $$
  select encode(
    extensions.hmac(
      upper(regexp_replace(coalesce(p_cedula,''), '[^0-9A-Za-z]', '', 'g')),
      app.secreto('fcjys_cedula_pepper'),
      'sha256'),
    'hex')
$$;
revoke all on function app.hash_cedula(text) from public, anon, authenticated;

create or replace function app.mascara_cedula(p_cedula text)
returns text language sql immutable set search_path = '' as $$
  select '•••••' ||
         right(upper(regexp_replace(coalesce(p_cedula,'00'), '[^0-9A-Za-z]', '', 'g')), 2)
$$;

create or replace function public.padron_importar(
  p_periodo text, p_condicion public.condicion_academica, p_filas jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  f jsonb; v_doc text; v_hash text;
  v_n int := 0; v_omitidas int := 0; v_extranjeros int := 0;
begin
  if not app.es('admin','secretaria') then
    raise exception 'Su rol no importa el padrón académico.';
  end if;
  if not exists (select 1 from public.periodos_academicos where codigo = p_periodo) then
    raise exception 'El período % no existe. Créelo primero.', p_periodo;
  end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    v_doc := upper(regexp_replace(coalesce(f->>'cedula',''), '[^0-9A-Za-z]', '', 'g'));
    if v_doc = '' or coalesce(btrim(f->>'nombre'),'') = '' then
      v_omitidas := v_omitidas + 1;
      continue;
    end if;
    if v_doc ~ '[A-Z]' then v_extranjeros := v_extranjeros + 1; end if;
    v_hash := app.hash_cedula(v_doc);

    insert into public.padron (periodo, condicion, nombre, cedula_hash, cedula_cif,
                               cedula_mascara, tipo_documento, matricula, carrera,
                               ciclo, cargado_por)
    values (p_periodo, p_condicion, btrim(f->>'nombre'), v_hash, app.cifrar(v_doc),
            app.mascara_cedula(v_doc),
            nullif(btrim(coalesce(f->>'tipo_documento','')),''),
            nullif(btrim(coalesce(f->>'matricula','')),''),
            nullif(btrim(coalesce(f->>'carrera','')),''),
            nullif(btrim(coalesce(f->>'ciclo','')),''), auth.uid())
    on conflict (periodo, cedula_hash) do update
      set nombre = excluded.nombre, condicion = excluded.condicion,
          tipo_documento = coalesce(excluded.tipo_documento, public.padron.tipo_documento),
          matricula = coalesce(excluded.matricula, public.padron.matricula),
          carrera   = coalesce(excluded.carrera,   public.padron.carrera),
          ciclo     = coalesce(excluded.ciclo,     public.padron.ciclo);
    v_n := v_n + 1;
  end loop;

  perform public.auditar('padron_importado', 'padron', null, null,
    jsonb_build_object('periodo', p_periodo, 'condicion', p_condicion,
                       'procesadas', v_n, 'omitidas', v_omitidas,
                       'documentos_no_paraguayos', v_extranjeros));

  return jsonb_build_object('ok', true, 'periodo', p_periodo, 'condicion', p_condicion,
    'procesadas', v_n, 'omitidas', v_omitidas, 'documentos_no_paraguayos', v_extranjeros,
    'total_periodo', (select count(*) from public.padron where periodo = p_periodo));
end $$;
revoke execute on function public.padron_importar(text, public.condicion_academica, jsonb)
  from public, anon;
grant execute on function public.padron_importar(text, public.condicion_academica, jsonb)
  to authenticated;

drop function if exists public.padron_resumen();
create function public.padron_resumen()
returns table (periodo text, desde date, hasta date, estudiantes bigint,
               egresados bigint, doc_extranjero bigint)
language sql stable security definer set search_path = '' as $$
  select p.codigo, p.desde, p.hasta,
         count(*) filter (where d.condicion = 'estudiante'),
         count(*) filter (where d.condicion = 'egresado'),
         count(*) filter (where d.tipo_documento is not null
                            and d.tipo_documento not ilike '%CEDULA%'
                            and d.tipo_documento not ilike '%CÉDULA%')
    from public.periodos_academicos p
    left join public.padron d on d.periodo = p.codigo
   where app.es('admin','coordinacion','secretaria','auditor')
   group by p.codigo, p.desde, p.hasta
   order by p.codigo desc
$$;
revoke execute on function public.padron_resumen() from public, anon;
grant  execute on function public.padron_resumen() to authenticated;;
