-- `docente_registrar` corre con search_path vacío, así que la llamada a
-- unaccent_simple() tenía que ir calificada con su esquema. Sin eso fallaba al
-- buscar un docente ya registrado por nombre.

create or replace function public.docente_registrar(
  p_nombre text, p_email text default null, p_catedras text[] default '{}',
  p_carreras text default null, p_es_dtc boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid; v_email text; v_nuevo boolean := false;
begin
  if not app.es('admin','coordinacion','secretaria') then
    raise exception 'Su rol no administra el registro de docentes.';
  end if;
  if coalesce(btrim(p_nombre),'') = '' then raise exception 'Falta el nombre.'; end if;
  v_email := nullif(lower(btrim(coalesce(p_email,''))),'');

  if v_email is not null then
    select id into v_id from public.docentes
     where email = v_email::extensions.citext
        or v_email = any(emails_alternos) limit 1;
  end if;
  if v_id is null then
    select id into v_id from public.docentes
     where lower(public.unaccent_simple(nombre))
         = lower(public.unaccent_simple(btrim(p_nombre)))
     limit 1;
  end if;

  if v_id is null then
    insert into public.docentes (nombre, email, catedras, carreras, es_dtc, creado_por)
    values (btrim(p_nombre), v_email::extensions.citext,
            coalesce(p_catedras,'{}'), p_carreras, p_es_dtc, auth.uid())
    returning id into v_id;
    v_nuevo := true;
  else
    update public.docentes set
      email = coalesce(email, v_email::extensions.citext),
      emails_alternos = case
        when v_email is not null and email is not null
             and email <> v_email::extensions.citext
             and not (v_email = any(emails_alternos))
        then emails_alternos || v_email else emails_alternos end,
      catedras = coalesce((select array_agg(distinct c)
                             from unnest(catedras || coalesce(p_catedras,'{}')) c
                            where btrim(c) <> ''), '{}'),
      carreras = coalesce(carreras, p_carreras),
      es_dtc = es_dtc or p_es_dtc,
      actualizado_en = now()
     where id = v_id;
  end if;

  perform public.auditar(case when v_nuevo then 'alta_docente' else 'edicion_docente' end,
                         'docentes', v_id, null,
                         jsonb_build_object('nombre', p_nombre, 'correo', v_email));
  return jsonb_build_object('ok', true, 'id', v_id, 'nuevo', v_nuevo);
end $$;
revoke execute on function public.docente_registrar(text, text, text[], text, boolean)
  from public, anon;
grant execute on function public.docente_registrar(text, text, text[], text, boolean)
  to authenticated;;
