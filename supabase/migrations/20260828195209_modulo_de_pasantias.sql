-- Pasantías y prácticas preprofesionales, según el Reglamento de Práctica y
-- Pasantía de Derecho y el capítulo XV del Reglamento General.
--
--   art. 05  requisito para el egreso
--   art. 07  obligatoria desde el sexto semestre; acumulativa
--   art. 11  en organización pública o privada, con convenio o gestión propia
--   art. 14  ficha de evaluación de la unidad receptora
--   art. 15  informe del estudiante dentro de 8 días hábiles
--   art. 16  8 días para subsanar observaciones
--   art. 17  no presentar el informe es causal de abandono
--   art. 23  docente asesor designado
--   art. 27  informe de conformidad dentro de 30 días hábiles
--   art. 28  40 % empresa + 60 % universidad, mínimo 70 %
--   art. 29  264 horas reloj
--   art. 35  convalidación para egresados con más de un año de trabajo afín

do $$ begin
  create type modalidad_pasantia as enum ('curricular', 'investigacion', 'convalidacion');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_pasantia as enum (
    'inscrita', 'en_curso', 'informe_pendiente', 'informe_observado',
    'aprobada', 'reprobada', 'abandonada', 'convalidada');
exception when duplicate_object then null; end $$;

create table if not exists pasantias (
  id            uuid primary key default gen_random_uuid(),
  cedula_hash   text,
  matricula     text,
  nombre        text not null,
  carrera       text,
  periodo       text,
  semestre      smallint check (semestre between 1 and 12),

  modalidad     modalidad_pasantia not null default 'curricular',
  estado        estado_pasantia    not null default 'inscrita',

  organizacion  text,
  area          text,
  con_convenio  boolean not null default false,
  fecha_inicio  date,
  fecha_fin     date,
  horas         numeric(6,1) not null default 0 check (horas >= 0),

  docente_asesor uuid references docentes(id) on delete set null,

  -- Evaluación (arts. 14, 28, 33, 34)
  ficha_recibida    boolean not null default false,
  ficha_firmada     boolean not null default false,
  nota_empresa      numeric(5,2) check (nota_empresa    between 0 and 100),
  nota_universidad  numeric(5,2) check (nota_universidad between 0 and 100),

  -- Plazos (arts. 15, 16, 27)
  informe_presentado_en date,
  informe_observado_en  date,
  informe_subsanado_en  date,
  conformidad_en        date,
  acta_en               date,

  -- Convalidación (arts. 35 y 36)
  convalidacion_solicitada_en date,
  convalidacion_resuelta_en   date,
  certificacion               text,

  motivo        text,
  observaciones text,
  creado_por    uuid references usuarios(id),
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint pasantias_identifica_persona check (cedula_hash is not null or matricula is not null),
  -- art. 35: la convalidación necesita constancia de en qué se basa.
  constraint pasantias_convalidacion_fundada
    check (modalidad <> 'convalidacion' or coalesce(btrim(motivo), '') <> '')
);

create index if not exists pasantias_cedula_idx    on pasantias (cedula_hash);
create index if not exists pasantias_matricula_idx on pasantias (matricula);
create index if not exists pasantias_periodo_idx   on pasantias (periodo);

alter table pasantias enable row level security;
drop policy if exists pasantias_lectura on pasantias;
create policy pasantias_lectura on pasantias for select
  using (app.es('admin', 'coordinacion', 'secretaria', 'auditor', 'docente'));

revoke all on pasantias from public, anon;
grant select on pasantias to authenticated;

-- Parámetros del reglamento, configurables por si cambia la malla.
insert into configuracion (clave, valor, nota) values
  ('pasantia_horas_meta',      '264', 'Horas reloj de pasantía (art. 29 del Reglamento de Práctica y Pasantía).'),
  ('pasantia_nota_minima',     '70',  'Calificación mínima para aprobar (art. 28).'),
  ('pasantia_peso_empresa',    '40',  'Porcentaje de la nota que aporta la unidad receptora (art. 28).'),
  ('pasantia_peso_universidad','60',  'Porcentaje de la nota que aporta la Universidad (art. 28).'),
  ('pasantia_semestre_minimo', '6',   'Semestre desde el cual la pasantía es obligatoria (art. 7 inc. b).')
on conflict (clave) do nothing;

create or replace function app.parametro(p_clave text, p_defecto numeric)
returns numeric language sql stable security definer set search_path to '' as $$
  select coalesce((select valor::numeric from public.configuracion where clave = p_clave), p_defecto)
$$;

-- Días hábiles entre dos fechas, para los plazos de los artículos 15, 16 y 27.
-- Cuenta de lunes a viernes; no contempla feriados.
create or replace function app.dias_habiles(p_desde date, p_hasta date)
returns int language sql immutable as $$
  select case when p_desde is null or p_hasta is null then null
         else (select count(*)::int from generate_series(p_desde + 1, p_hasta, interval '1 day') d
                where extract(isodow from d) < 6) end
$$;;
