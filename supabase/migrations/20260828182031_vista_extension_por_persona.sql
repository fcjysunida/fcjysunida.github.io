-- Una fila por persona del padrón, con sus horas de extensión desglosadas por
-- procedencia. La condición que manda es la última: si alguien figura como
-- estudiante en un período y como egresado en otro, vale egresado.
create or replace view extension_personas with (security_invoker = true) as
with gente as (
  select distinct on (coalesce(p.cedula_hash, 'm:' || p.matricula))
         coalesce(p.cedula_hash, 'm:' || p.matricula) as clave,
         p.cedula_hash, p.matricula, p.nombre, p.carrera,
         p.cedula_mascara, p.condicion, p.periodo, p.tipo_documento
    from padron p
   order by coalesce(p.cedula_hash, 'm:' || p.matricula),
            (p.condicion = 'egresado') desc, p.periodo desc
),
-- Horas por asistencia efectiva a una actividad de la plataforma.
asistidas as (
  select i.cedula_hash, i.matricula,
         sum(distinct_horas.horas) as horas
    from public.inscripciones i
    join lateral (
      select distinct a.id, a.horas_academicas as horas
        from public.asistencias s
        join public.jornadas j   on j.id = s.jornada_id
        join public.actividades a on a.id = j.actividad_id
       where s.inscripcion_id = i.id
         and a.tipo in ('extension', 'proyecto_extension')
    ) distinct_horas on true
   where i.estado <> 'anulada'
   group by 1, 2
),
-- Horas por figurar en la nómina de un proyecto de extensión.
en_proyectos as (
  select pp.cedula_hash, pp.matricula,
         sum(coalesce(pr.horas_extension, 0)) as horas
    from public.proyecto_participantes pp
    join public.proyectos pr on pr.id = pp.proyecto_id
   where pp.asistio and pp.tipo = 'estudiante'
   group by 1, 2
),
acreditadas as (
  select he.cedula_hash, he.matricula,
         sum(he.horas) filter (where he.origen = 'historica') as historicas,
         sum(he.horas) filter (where he.origen = 'ajuste')    as ajustes
    from public.horas_extension he
   group by 1, 2
)
select g.clave, g.cedula_hash, g.matricula, g.nombre, g.carrera,
       g.cedula_mascara, g.condicion, g.periodo, g.tipo_documento,
       nullif(left(g.matricula, 4), '') as cohorte,
       coalesce(asi.horas, 0)                         as horas_asistencia,
       coalesce(prj.horas, 0)                         as horas_proyectos,
       coalesce(acr.historicas, 0)                    as horas_historicas,
       coalesce(acr.ajustes, 0)                       as horas_ajustes,
       coalesce(asi.horas, 0) + coalesce(prj.horas, 0) as horas_respaldadas,
       coalesce(asi.horas, 0) + coalesce(prj.horas, 0)
         + coalesce(acr.historicas, 0) + coalesce(acr.ajustes, 0) as horas_total,
       greatest(0, app.meta_horas_extension()
         - (coalesce(asi.horas, 0) + coalesce(prj.horas, 0)
            + coalesce(acr.historicas, 0) + coalesce(acr.ajustes, 0))) as horas_faltantes,
       (coalesce(asi.horas, 0) + coalesce(prj.horas, 0)
         + coalesce(acr.historicas, 0) + coalesce(acr.ajustes, 0))
         >= app.meta_horas_extension() as cumple
  from gente g
  left join asistidas    asi on (asi.cedula_hash is not null and asi.cedula_hash = g.cedula_hash)
                             or (asi.cedula_hash is null and asi.matricula = g.matricula)
  left join en_proyectos prj on (prj.cedula_hash is not null and prj.cedula_hash = g.cedula_hash)
                             or (prj.cedula_hash is null and prj.matricula = g.matricula)
  left join acreditadas  acr on (acr.cedula_hash is not null and acr.cedula_hash = g.cedula_hash)
                             or (acr.cedula_hash is null and acr.matricula = g.matricula);

revoke all on extension_personas from public, anon;
grant select on extension_personas to authenticated;;
