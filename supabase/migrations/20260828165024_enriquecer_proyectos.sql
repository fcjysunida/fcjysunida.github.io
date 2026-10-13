-- Enriquecimiento de proyectos ya cargados con el texto completo de la memoria.
-- No pisa la descripción corta: la guarda aparte, para poder comparar y volver
-- atrás si el cruce automático se equivocó.

create or replace function public.proyectos_enriquecer(p_filas jsonb, p_fuente text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare f jsonb; v_id uuid; v_n int := 0; v_sin int := 0;
begin
  if not app.es('admin','coordinacion') then
    raise exception 'Su rol no edita proyectos.';
  end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    v_id := nullif(f->>'proyecto_id','')::uuid;
    if v_id is null then v_sin := v_sin + 1; continue; end if;

    update public.proyectos set
      propuesta = propuesta
        || jsonb_build_object('detalle', f->>'detalle')
        || case when coalesce(btrim(f->>'participacion'),'') <> ''
                then jsonb_build_object('participacion', f->>'participacion')
                else '{}'::jsonb end,
      fuente = coalesce(fuente, '') ||
               case when coalesce(fuente,'') = '' then '' else ' + ' end || p_fuente,
      actualizado_en = now()
     where id = v_id;
    v_n := v_n + 1;
  end loop;

  perform public.auditar('proyectos_enriquecidos', 'proyectos', null, null,
    jsonb_build_object('fuente', p_fuente, 'enriquecidos', v_n, 'sin_coincidencia', v_sin));
  return jsonb_build_object('ok', true, 'enriquecidos', v_n, 'sin_coincidencia', v_sin);
end $$;
revoke execute on function public.proyectos_enriquecer(jsonb, text) from public, anon;
grant  execute on function public.proyectos_enriquecer(jsonb, text) to authenticated;

-- Títulos y años, para poder cruzar desde la línea de comandos sin traer todo.
create or replace function public.proyectos_titulos(p_anio smallint default null)
returns table (id uuid, nombre text, anio smallint, tiene_detalle boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, p.anio,
         coalesce(btrim(p.propuesta->>'detalle'), '') <> ''
    from public.proyectos p
   where app.es('admin','coordinacion','secretaria','auditor')
     and (p_anio is null or p.anio = p_anio)
   order by p.anio, p.nombre
$$;
revoke execute on function public.proyectos_titulos(smallint) from public, anon;
grant  execute on function public.proyectos_titulos(smallint) to authenticated;;
