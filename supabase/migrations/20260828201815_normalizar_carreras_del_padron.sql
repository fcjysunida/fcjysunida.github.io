-- El sistema académico exporta la carrera en mayúsculas y con dos grafías
-- («CIENCIAS POLÍTICAS» y «CIENCIAS POLITICAS»). Se normaliza contra el
-- catálogo para que los filtros y los cruces por carrera no se partan en dos.
update padron p
   set carrera = c.nombre
  from carreras c
 where p.carrera is not null
   and public.unaccent_simple(lower(p.carrera)) = public.unaccent_simple(lower(c.nombre))
   and p.carrera <> c.nombre;

update proyecto_participantes pp
   set carrera = c.nombre
  from carreras c
 where pp.carrera is not null
   and public.unaccent_simple(lower(pp.carrera)) = public.unaccent_simple(lower(c.nombre))
   and pp.carrera <> c.nombre;

-- El importador deja la carrera tal como viene de la planilla; conviene que
-- caiga ya normalizada. Se hace en el momento de la carga.
create or replace function app.carrera_normalizada(p_texto text)
returns text language sql stable security definer set search_path to '' as $$
  select coalesce(
    (select c.nombre from public.carreras c
      where public.unaccent_simple(lower(c.nombre))
            = public.unaccent_simple(lower(btrim(coalesce(p_texto, ''))))
      limit 1),
    nullif(btrim(coalesce(p_texto, '')), ''))
$$;

revoke execute on function app.carrera_normalizada(text) from public, anon;;
