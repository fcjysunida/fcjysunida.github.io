-- El selector de período solo ofrecía los meses con actividades cargadas en la
-- plataforma. Los 183 proyectos de extensión de 2021 a 2026 quedaban invisibles.
drop function if exists public.periodos_disponibles();

create function periodos_disponibles()
returns table (periodo text, actividades bigint, proyectos bigint)
language sql stable security definer set search_path to '' as $$
  with meses as (
    select to_char(a.fecha_inicio, 'YYYY-MM') as m, 1 as act, 0 as pr
      from public.actividades a
    union all
    select to_char(coalesce(p.fecha_inicio, make_date(p.anio, 1, 1)), 'YYYY-MM'), 0, 1
      from public.proyectos p
     where p.fecha_inicio is not null or p.anio is not null
  )
  select m, sum(act)::bigint, sum(pr)::bigint
    from meses where m is not null
   group by m order by m desc
$$;

revoke execute on function periodos_disponibles() from public, anon;
grant execute on function periodos_disponibles() to authenticated;;
