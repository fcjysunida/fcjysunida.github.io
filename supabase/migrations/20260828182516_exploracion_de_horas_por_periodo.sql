-- Conteo por período y condición: cuántos hay, cuántos llegan a la meta,
-- cuántas horas acumulan y de dónde salen esas horas.
create or replace function extension_resumen()
returns table (
  periodo            text,
  condicion          text,
  personas           bigint,
  cumplen            bigint,
  sin_horas          bigint,
  horas_promedio     numeric,
  horas_respaldadas  numeric,
  horas_historicas   numeric,
  horas_total        numeric
)
language sql stable security definer set search_path to '' as $$
  select e.periodo,
         e.condicion::text,
         count(*),
         count(*) filter (where e.cumple),
         count(*) filter (where e.horas_total = 0),
         round(avg(e.horas_total), 1),
         sum(e.horas_respaldadas),
         sum(e.horas_historicas + e.horas_ajustes),
         sum(e.horas_total)
    from public.extension_personas e
   where app.es('admin', 'coordinacion', 'secretaria', 'auditor')
   group by 1, 2
   order by 1 desc, 2
$$;

-- Nómina con las horas de cada persona, para la pantalla de exploración.
-- Devuelve la cédula siempre enmascarada: para esto no hace falta el número.
create or replace function extension_nomina(
  p_periodo   text default null,
  p_condicion text default null,
  p_texto     text default null,
  p_solo_deuda boolean default false,
  p_limite    int  default 300
)
returns table (
  padron_id         uuid,
  nombre            text,
  cedula_mascara    text,
  matricula         text,
  cohorte           text,
  carrera           text,
  condicion         text,
  periodo           text,
  horas_asistencia  numeric,
  horas_proyectos   numeric,
  horas_historicas  numeric,
  horas_ajustes     numeric,
  horas_total       numeric,
  horas_faltantes   numeric,
  cumple            boolean
)
language sql stable security definer set search_path to '' as $$
  select (select p.id from public.padron p
           where (p.cedula_hash is not null and p.cedula_hash = e.cedula_hash)
              or (p.cedula_hash is null and p.matricula = e.matricula)
           order by p.periodo desc limit 1),
         e.nombre, e.cedula_mascara, e.matricula, e.cohorte, e.carrera,
         e.condicion::text, e.periodo,
         e.horas_asistencia, e.horas_proyectos, e.horas_historicas,
         e.horas_ajustes, e.horas_total, e.horas_faltantes, e.cumple
    from public.extension_personas e
   where app.es('admin', 'coordinacion', 'secretaria', 'auditor')
     and (p_periodo   is null or e.periodo = p_periodo)
     and (p_condicion is null or e.condicion::text = p_condicion)
     and (p_solo_deuda is not true or not e.cumple)
     and (coalesce(btrim(p_texto), '') = ''
          or public.unaccent_simple(lower(e.nombre)) like '%' || public.unaccent_simple(lower(btrim(p_texto))) || '%'
          or e.matricula like btrim(p_texto) || '%')
   order by e.cumple, e.horas_total desc, e.nombre
   limit greatest(1, least(coalesce(p_limite, 300), 1000))
$$;

revoke execute on function extension_resumen() from public, anon;
revoke execute on function extension_nomina(text, text, text, boolean, int) from public, anon;
grant execute on function extension_resumen() to authenticated;
grant execute on function extension_nomina(text, text, text, boolean, int) to authenticated;;
