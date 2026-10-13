-- Catálogo cerrado de carreras de la Facultad. Antes «carreras» era texto libre
-- y el importador metía ahí el nombre de la cátedra; ahora es una lista elegida.
create table if not exists carreras (
  codigo text primary key,
  nombre text not null unique,
  orden  smallint not null default 0,
  activa boolean not null default true
);

insert into carreras (codigo, nombre, orden) values
  ('derecho',   'Derecho',                                        1),
  ('ccpp',      'Ciencias Políticas',                             2),
  ('rrii',      'Relaciones Internacionales y Negocios Globales', 3)
on conflict (codigo) do update set nombre = excluded.nombre, orden = excluded.orden;

alter table carreras enable row level security;
drop policy if exists carreras_lectura on carreras;
create policy carreras_lectura on carreras for select using (auth.uid() is not null);
revoke all on carreras from public, anon;
grant select on carreras to authenticated;

-- Un proyecto puede involucrar más de una carrera.
alter table proyectos add column if not exists carreras_nueva text[];

update proyectos p
   set carreras_nueva = sub.lista
  from (select p2.id, array_agg(distinct c.nombre order by c.nombre) as lista
          from proyectos p2
          join carreras c
            on public.unaccent_simple(lower(coalesce(p2.carreras, '')))
               like '%' || public.unaccent_simple(lower(c.nombre)) || '%'
         group by p2.id) sub
 where sub.id = p.id;

drop view if exists proyectos_resumen;
alter table proyectos drop column carreras;
alter table proyectos rename column carreras_nueva to carreras;

comment on column proyectos.carreras is
  'Carreras involucradas. Se eligen del catálogo `carreras`; una o más.';

create view proyectos_resumen with (security_invoker = true) as
 select id, nombre, clasificacion, estado, periodo_academico, carreras, lider,
        fecha_inicio, fecha_fin, anio, categoria_memoria, fuente, horas_reloj,
        horas_extension, beneficiarios_directos, beneficiarios_indirectos,
        actividad_id, docente_responsable, creado_en,
        to_char(fecha_inicio::timestamp with time zone, 'YYYY-MM') as periodo_mes,
        (select count(*) from proyecto_participantes pp
          where pp.proyecto_id = p.id and pp.tipo = 'estudiante') as estudiantes,
        (select count(*) from proyecto_participantes pp
          where pp.proyecto_id = p.id and pp.tipo = 'docente') as docentes,
        (select count(*) from proyecto_informes pi where pi.proyecto_id = p.id) as informes,
        (select max(pi.fecha_informe) from proyecto_informes pi
          where pi.proyecto_id = p.id) as ultimo_informe
   from proyectos p;

revoke all on proyectos_resumen from public, anon;
grant select on proyectos_resumen to authenticated;;
