-- Libro de horas de extensión por persona.
--
-- Las horas respaldadas por la plataforma (asistencia registrada o nómina de un
-- proyecto) se calculan en la vista: no se copian acá, para que no puedan quedar
-- desfasadas. Esta tabla guarda únicamente lo que se acredita a mano, que es
-- justamente lo que la plataforma no puede probar: la extensión cursada antes de
-- que el sistema existiera.
create table if not exists horas_extension (
  id           uuid primary key default gen_random_uuid(),
  cedula_hash  text,
  matricula    text,
  nombre       text not null,
  periodo      text not null,
  horas        numeric(6,2) not null check (horas > 0 and horas <= 500),
  origen       text not null check (origen in ('historica', 'ajuste')),
  proyecto_id  uuid references proyectos(id) on delete set null,
  detalle      text,
  motivo       text not null,
  cargado_por  uuid references usuarios(id),
  cargado_en   timestamptz not null default now(),
  constraint horas_extension_identifica_persona
    check (cedula_hash is not null or matricula is not null)
);

comment on table horas_extension is
  'Horas de extensión acreditadas a mano. «historica»: cursadas antes de la '
  'plataforma, sin respaldo de asistencia. «ajuste»: corrección puntual. '
  'Las horas respaldadas por la plataforma no viven acá: las calcula la vista '
  'extension_personas.';

create index if not exists horas_extension_cedula_idx    on horas_extension (cedula_hash);
create index if not exists horas_extension_matricula_idx on horas_extension (matricula);
create index if not exists horas_extension_periodo_idx   on horas_extension (periodo);

alter table horas_extension enable row level security;

create policy horas_extension_lectura on horas_extension for select
  using (app.es('admin', 'coordinacion', 'secretaria', 'auditor'));

revoke all on horas_extension from public, anon;
grant select on horas_extension to authenticated;

-- Meta institucional: 33 horas de extensión a lo largo de la carrera.
create or replace function app.meta_horas_extension() returns numeric
  language sql immutable as $$ select 33::numeric $$;;
