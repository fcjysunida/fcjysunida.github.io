-- «Julia Fernández» y «Prof. Julia Fernández» son la misma persona. La
-- comparación ignora los títulos y la puntuación, de modo que un docente no se
-- duplica por cómo lo escribió quien remitió el formulario.

create or replace function public.nombre_docente_normalizado(p text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(
    regexp_replace(
      lower(public.unaccent_simple(coalesce(p,''))),
      '\m(prof|profe|profesor|profesora|dr|dra|doctor|doctora|abg|abog|abogado|abogada|lic|licenciado|licenciada|mg|mgtr|mgter|magister|ing|esp|np|sr|sra)\.?\M',
      ' ', 'g'),
    '[^a-z0-9 ]', ' ', 'g'))
$$;

create or replace function public.docente_registrar(
  p_nombre text, p_email text default null, p_catedras text[] default '{}',
  p_carreras text default null, p_es_dtc boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid; v_email text; v_nuevo boolean := false; v_norm text;
begin
  if not app.es('admin','coordinacion','secretaria') then
    raise exception 'Su rol no administra el registro de docentes.';
  end if;
  if coalesce(btrim(p_nombre),'') = '' then raise exception 'Falta el nombre.'; end if;

  v_norm := regexp_replace(public.nombre_docente_normalizado(p_nombre), '\s+', ' ', 'g');
  -- Un «nombre» de menos de dos palabras no es una persona: suele ser un rótulo
  -- de la tabla que se coló al leer el formulario.
  if array_length(string_to_array(v_norm, ' '), 1) < 2 then
    raise exception 'No parece el nombre de una persona: %', p_nombre;
  end if;

  v_email := nullif(lower(btrim(coalesce(p_email,''))),'');

  if v_email is not null then
    select id into v_id from public.docentes
     where email = v_email::extensions.citext or v_email = any(emails_alternos) limit 1;
  end if;
  if v_id is null then
    select id into v_id from public.docentes
     where regexp_replace(public.nombre_docente_normalizado(nombre), '\s+', ' ', 'g') = v_norm
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
      -- Se conserva la forma más completa del nombre.
      nombre = case when length(btrim(p_nombre)) > length(nombre)
                    then btrim(p_nombre) else nombre end,
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
  to authenticated;

-- Limpieza de lo que entró mal en la primera importación.
delete from public.proyecto_docentes pd
 using public.docentes d
 where d.id = pd.docente_id
   and (d.nombre ilike 'personas involucradas%' or d.nombre ilike 'funcionarios%'
        or d.nombre ilike 'docentes%');
delete from public.docentes
 where nombre ilike 'personas involucradas%' or nombre ilike 'funcionarios%'
    or nombre ilike 'docentes%';

insert into public.auditoria (accion, entidad, motivo, detalle)
values ('edicion_docente','docentes','se eliminaron rótulos de tabla que entraron como docentes',
        '{}'::jsonb);;
