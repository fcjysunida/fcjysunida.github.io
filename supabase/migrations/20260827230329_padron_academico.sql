-- Padrón académico por período: quiénes eran estudiantes y quiénes egresados.
-- Sirve para no depender de lo que la persona declara en el formulario: la
-- condición se verifica cruzando el HMAC de la cédula contra el padrón.
-- Se guarda el mismo HMAC que usa el registro de asistencia, de modo que el
-- cruce se hace sin descifrar ninguna cédula.

create type public.condicion_academica as enum ('estudiante','egresado');

create table public.periodos_academicos (
  codigo    text primary key check (codigo ~ '^[0-9]{4}-[12]$'),   -- '2021-1'
  anio      smallint not null,
  semestre  smallint not null check (semestre in (1,2)),
  desde     date not null,
  hasta     date not null,
  creado_en timestamptz not null default now(),
  check (hasta >= desde)
);

create table public.padron (
  id          uuid primary key default gen_random_uuid(),
  periodo     text not null references public.periodos_academicos(codigo) on delete cascade,
  condicion   public.condicion_academica not null,
  nombre      text not null,
  cedula_hash text not null,
  cedula_cif  bytea,
  cedula_mascara text,
  matricula   text,
  carrera     text,
  ciclo       text,
  cargado_por uuid references public.usuarios(id),
  cargado_en  timestamptz not null default now(),
  unique (periodo, cedula_hash)
);
create index padron_hash_idx      on public.padron (cedula_hash);
create index padron_periodo_idx   on public.padron (periodo);
create index padron_matricula_idx on public.padron (matricula);

alter table public.periodos_academicos enable row level security;
alter table public.padron              enable row level security;

create policy per_lectura on public.periodos_academicos for select to authenticated using (true);
create policy per_escritura on public.periodos_academicos for all to authenticated
  using (app.es('admin','coordinacion','secretaria'))
  with check (app.es('admin','coordinacion','secretaria'));

-- El padrón es una lista nominal completa: solo la ve quien administra.
create policy pad_lectura on public.padron for select to authenticated
  using (app.es('admin','coordinacion','secretaria'));
create policy pad_escritura on public.padron for all to authenticated
  using (app.es('admin','secretaria')) with check (app.es('admin','secretaria'));

-- ── El período académico que corresponde a una fecha ───────────────────────────
create or replace function app.periodo_de(p_fecha date)
returns text language sql stable set search_path = '' as $$
  select p.codigo from public.periodos_academicos p
   where p_fecha between p.desde and p.hasta
   order by p.desde desc limit 1
$$;

-- ── Cruce: qué dice el padrón sobre esta cédula ────────────────────────────────
-- Reglas, en este orden:
--   1. Si figura como estudiante en el período de la actividad → estudiante.
--   2. Si la persona declaró «docente» → docente (un docente puede además ser egresado).
--   3. Si figura como egresado en cualquier período → egresado.
--   4. Si figura como estudiante en algún otro período → estudiante.
--   5. Si no figura → lo que declaró.
create or replace function app.condicion_verificada(
  p_hash text, p_fecha date, p_declarada public.condicion_participante)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_periodo text;
  v_fila public.padron%rowtype;
  v_cond public.condicion_participante;
  v_origen text;
begin
  v_periodo := app.periodo_de(p_fecha);

  -- 1. Estudiante en el período de la actividad
  if v_periodo is not null then
    select * into v_fila from public.padron
     where cedula_hash = p_hash and periodo = v_periodo and condicion = 'estudiante'
     limit 1;
    if found then
      return jsonb_build_object('condicion','estudiante','matricula',v_fila.matricula,
        'carrera',v_fila.carrera,'ciclo',v_fila.ciclo,'periodo',v_fila.periodo,
        'origen','padrón: estudiante en el período de la actividad');
    end if;
  end if;

  -- 2. Docente declarado
  if p_declarada = 'docente' then
    select * into v_fila from public.padron
     where cedula_hash = p_hash order by periodo desc limit 1;
    return jsonb_build_object('condicion','docente','matricula',v_fila.matricula,
      'carrera',v_fila.carrera,'ciclo',null,'periodo',v_fila.periodo,
      'origen','declarado docente');
  end if;

  -- 3. Egresado en cualquier período
  select * into v_fila from public.padron
   where cedula_hash = p_hash and condicion = 'egresado'
   order by periodo desc limit 1;
  if found then
    return jsonb_build_object('condicion','egresado','matricula',v_fila.matricula,
      'carrera',v_fila.carrera,'ciclo',v_fila.ciclo,'periodo',v_fila.periodo,
      'origen','padrón: egresado');
  end if;

  -- 4. Estudiante en otro período
  select * into v_fila from public.padron
   where cedula_hash = p_hash and condicion = 'estudiante'
   order by periodo desc limit 1;
  if found then
    return jsonb_build_object('condicion','estudiante','matricula',v_fila.matricula,
      'carrera',v_fila.carrera,'ciclo',v_fila.ciclo,'periodo',v_fila.periodo,
      'origen','padrón: estudiante en ' || v_fila.periodo);
  end if;

  -- 5. Sin registro en el padrón
  return jsonb_build_object('condicion', p_declarada, 'matricula', null,
    'carrera', null, 'ciclo', null, 'periodo', null,
    'origen','declarado por la persona; no figura en el padrón');
end $$;

-- ── Columnas nuevas en inscripciones ───────────────────────────────────────────
alter table public.inscripciones
  add column condicion_declarada public.condicion_participante,
  add column matricula           text,
  add column ciclo               text,
  add column condicion_origen    text,
  add column padron_periodo      text;

comment on column public.inscripciones.condicion is
  'Condición efectiva: la verificada contra el padrón cuando existe, si no la declarada.';
comment on column public.inscripciones.condicion_declarada is
  'Lo que la persona eligió en el formulario. Se conserva sin tocar.';
comment on column public.inscripciones.condicion_origen is
  'Por qué la condición efectiva es la que es. Se muestra en el panel.';;
