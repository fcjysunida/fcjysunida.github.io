-- Actividades que no son proyectos de extensión y no deben pasar por el formato
-- oficial 9: reuniones con empresas, visitas, ferias de empleo, firmas de
-- convenio. Llevan informe de actividad, nómina de participantes y, si
-- corresponde, certificación. Muchas están ligadas a la gestión de pasantías.
do $$ begin
  create type tipo_evento as enum (
    'reunion_empresa', 'visita_institucional', 'feria_empleo', 'charla',
    'firma_convenio', 'mesa_trabajo', 'otro');
exception when duplicate_object then null; end $$;

create table if not exists eventos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  tipo          tipo_evento not null default 'otro',
  fecha         date not null,
  fecha_fin     date,
  lugar         text,
  organizacion  text,
  carreras      text[] not null default '{}',
  -- A qué función institucional responde. Un evento puede servir a más de una.
  vinculo       text[] not null default '{}',
  resumen       text,
  informe       text,
  informe_en    date,
  beneficiarios integer check (beneficiarios >= 0),
  certifica     boolean not null default false,
  horas_reloj   numeric(5,1),
  docente_responsable uuid references docentes(id) on delete set null,
  proyecto_id   uuid references proyectos(id) on delete set null,
  actividad_id  uuid references actividades(id) on delete set null,
  creado_por    uuid references usuarios(id),
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table eventos is
  'Actividades de vinculación sin el requisito del formato oficial 9. '
  'Llevan informe, participantes y certificación opcional (art. 19 y 20 del '
  'Reglamento de Proyección Social y Extensión Universitaria).';

create table if not exists evento_participantes (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references eventos(id) on delete cascade,
  tipo           tipo_participante not null default 'externo',
  nombre         text not null,
  cedula_hash    text,
  cedula_cif     bytea,
  cedula_mascara text,
  matricula      text,
  carrera        text,
  organizacion   text,
  condicion      condicion_participante,
  condicion_origen text,
  periodo_verificado text,
  asistio        boolean not null default true,
  orden          integer not null default 0
);

create index if not exists eventos_fecha_idx        on eventos (fecha desc);
create index if not exists evento_part_evento_idx   on evento_participantes (evento_id);

alter table eventos              enable row level security;
alter table evento_participantes enable row level security;

drop policy if exists eventos_lectura on eventos;
drop policy if exists evento_part_lectura on evento_participantes;
create policy eventos_lectura on eventos for select
  using (app.es('admin', 'coordinacion', 'secretaria', 'auditor', 'docente'));
create policy evento_part_lectura on evento_participantes for select
  using (app.es('admin', 'coordinacion', 'secretaria', 'auditor', 'docente'));

revoke all on eventos, evento_participantes from public, anon;
grant select on eventos, evento_participantes to authenticated;

create or replace view eventos_resumen with (security_invoker = true) as
select e.*,
       (select count(*) from evento_participantes p where p.evento_id = e.id) as participantes,
       (select count(*) from evento_participantes p
         where p.evento_id = e.id and p.tipo = 'estudiante')                  as estudiantes,
       (select d.nombre from docentes d where d.id = e.docente_responsable)   as docente,
       (e.informe is not null and btrim(e.informe) <> '')                     as tiene_informe
  from eventos e;

revoke all on eventos_resumen from public, anon;
grant select on eventos_resumen to authenticated;;
