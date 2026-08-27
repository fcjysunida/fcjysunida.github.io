-- fcjysunida — esquema base
-- Facultad de Ciencias Jurídicas y Sociales, UNIDA
-- Marco: Ley N° 7593/2025 de Protección de Datos Personales (Paraguay)

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext   with schema extensions;

-- Esquema privado: nunca se expone por PostgREST.
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;

-- ── Tipos ──────────────────────────────────────────────────────────────────────
create type public.rol_usuario as enum
  ('admin','coordinacion','docente','secretaria','auditor');
create type public.tipo_actividad as enum
  ('extension','publica','vinculacion','proyecto_extension',
   'capacitacion_docente','actividad_estudiantil','investigacion');
create type public.estado_actividad as enum
  ('borrador','publicada','cerrada','finalizada');
create type public.estado_inscripcion as enum
  ('confirmada','en_espera','anulada');
create type public.modalidad_actividad as enum
  ('presencial','virtual','hibrida');
create type public.condicion_participante as enum
  ('estudiante','docente','egresado','externo');

-- ── Usuarios del panel ─────────────────────────────────────────────────────────
create table public.usuarios (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    text not null,
  email     extensions.citext not null unique,
  rol       public.rol_usuario not null default 'auditor',
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ── Consentimiento versionado (prueba del consentimiento, art. 6.°) ────────────
create table public.consentimiento_versiones (
  id                   uuid primary key default gen_random_uuid(),
  version              text not null unique,
  aviso                jsonb not null,          -- aviso previo del art. 27, por rótulos
  texto_tratamiento    text not null,
  texto_sensibles      text not null,
  texto_imagen         text not null,
  texto_comunicaciones text not null,
  vigente_desde        timestamptz not null default now(),
  vigente_hasta        timestamptz
);

-- ── Actividades ────────────────────────────────────────────────────────────────
create table public.actividades (
  id                        uuid primary key default gen_random_uuid(),
  titulo                    text not null check (length(btrim(titulo)) > 0),
  tipo                      public.tipo_actividad not null,
  descripcion               text,
  modalidad                 public.modalidad_actividad not null default 'presencial',
  fecha_inicio              date not null,
  dias                      smallint not null check (dias between 1 and 10),
  cupo                      integer not null default 0 check (cupo >= 0),
  lugar                     text,
  portada                   text,
  portada_credito           text,
  horas_academicas          numeric(5,1) not null default 0,
  instituciones_vinculadas  smallint not null default 0,
  carreras_involucradas     smallint not null default 0,
  satisfaccion              smallint check (satisfaccion between 0 and 100),
  estado                    public.estado_actividad not null default 'borrador',
  token_formulario          text not null unique,
  token_asistencia          text not null unique,
  campos                    jsonb not null default '[]'::jsonb,
  consentimiento_version_id uuid not null references public.consentimiento_versiones(id),
  docente_responsable       uuid references public.usuarios(id),
  creado_por                uuid references public.usuarios(id),
  cerrada_en                timestamptz,
  creado_en                 timestamptz not null default now()
);
create index actividades_periodo_idx on public.actividades (fecha_inicio);
create index actividades_docente_idx on public.actividades (docente_responsable);

-- ── Jornadas (una por día; el código de sala rota) ─────────────────────────────
create table public.jornadas (
  id           uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.actividades(id) on delete cascade,
  numero       smallint not null check (numero >= 1),
  fecha        date not null,
  codigo_sala  text not null check (codigo_sala ~ '^[0-9]{4}$'),
  abre_en      timestamptz,
  cierra_en    timestamptz,
  unique (actividad_id, numero),
  unique (actividad_id, fecha)
);
create index jornadas_fecha_idx on public.jornadas (fecha);

-- ── Inscripciones ──────────────────────────────────────────────────────────────
create table public.inscripciones (
  id                        uuid primary key default gen_random_uuid(),
  actividad_id              uuid not null references public.actividades(id) on delete cascade,
  nombre                    text not null,
  cedula_cif                bytea,                    -- cifrada (pgcrypto)
  cedula_hash               text not null,            -- HMAC: valida el check-in sin descifrar
  cedula_mascara            text,                     -- dos últimos dígitos; es lo que ve el panel
  email                     extensions.citext not null,
  telefono_cif              bytea,
  institucion               text,
  carrera                   text,
  condicion                 public.condicion_participante not null default 'externo',
  ciudad                    text,
  modalidad                 text,
  requiere_certificado      boolean not null default true,
  accesibilidad_cif         bytea,                    -- dato sensible (art. 3.° num. 7)
  origen_difusion           text,
  estado                    public.estado_inscripcion not null default 'confirmada',
  consentimiento_version_id uuid not null references public.consentimiento_versiones(id),
  consent_tratamiento       boolean not null check (consent_tratamiento),
  consent_sensible          boolean not null default false,
  consent_imagen            boolean not null default false,
  consent_comunicaciones    boolean not null default false,
  consentido_en             timestamptz not null default now(),
  anonimizada_en            timestamptz,
  creado_en                 timestamptz not null default now(),
  unique (actividad_id, cedula_hash),
  constraint sensible_consentido
    check (accesibilidad_cif is null or consent_sensible)
);
create index inscripciones_actividad_idx on public.inscripciones (actividad_id);
create index inscripciones_hash_idx on public.inscripciones (actividad_id, cedula_hash);

-- Respuestas a campos personalizados sin columna propia.
create table public.respuestas (
  id             uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references public.inscripciones(id) on delete cascade,
  campo_id       text not null,
  etiqueta       text not null,
  valor          text,
  valor_cif      bytea,        -- reemplaza a `valor` cuando el campo es sensible
  sensible       boolean not null default false,
  unique (inscripcion_id, campo_id),
  constraint respuesta_una_sola_forma
    check (valor is null or valor_cif is null)
);
create index respuestas_inscripcion_idx on public.respuestas (inscripcion_id);

-- ── Asistencias ────────────────────────────────────────────────────────────────
create table public.asistencias (
  id             uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references public.inscripciones(id) on delete cascade,
  jornada_id     uuid not null references public.jornadas(id) on delete cascade,
  registrado_en  timestamptz not null default now(),
  unique (inscripcion_id, jornada_id)
);
create index asistencias_jornada_idx on public.asistencias (jornada_id);

-- ── Difusión (bloque 6 del informe DTC) ────────────────────────────────────────
create table public.difusiones (
  id               uuid primary key default gen_random_uuid(),
  actividad_id     uuid not null references public.actividades(id) on delete cascade,
  canal            text not null,
  publicaciones    smallint not null default 1,
  alcance_estimado integer not null default 0,
  registrado_en    timestamptz not null default now()
);

-- ── Indicadores cargados a mano (los tres marcados «manual» en INFORME_DTC.md) ─
create table public.indicadores_manuales (
  id             uuid primary key default gen_random_uuid(),
  periodo        text not null check (periodo ~ '^[0-9]{4}-[0-9]{2}$'),
  clave          text not null,
  valor          numeric not null default 0,
  nota           text,
  registrado_por uuid references public.usuarios(id),
  registrado_en  timestamptz not null default now(),
  unique (periodo, clave)
);

-- ── Auditoría, append only ─────────────────────────────────────────────────────
create table public.auditoria (
  id         bigserial primary key,
  usuario_id uuid references public.usuarios(id),
  rol        public.rol_usuario,
  accion     text not null,
  entidad    text,
  entidad_id uuid,
  motivo     text,
  detalle    jsonb,
  ocurrio_en timestamptz not null default now()
);
create index auditoria_fecha_idx on public.auditoria (ocurrio_en desc);

-- ── Derechos del titular (arts. 26 a 33) ───────────────────────────────────────
create table public.solicitudes_derechos (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in
                ('acceso','rectificacion','oposicion','supresion','portabilidad','revocacion')),
  email       extensions.citext not null,
  detalle     text,
  estado      text not null default 'recibida'
                check (estado in ('recibida','en_tramite','resuelta','rechazada')),
  resolucion  text,
  recibida_en timestamptz not null default now(),
  vence_en    timestamptz not null default (now() + interval '30 days'),
  resuelta_en timestamptz
);

-- ── Límite de tasa de los endpoints públicos ───────────────────────────────────
-- Se acota por actividad y por cédula (en su forma HMAC): no se guarda dirección
-- IP, ubicación ni identificación del dispositivo.
create table public.limites_tasa (
  clave     text primary key,
  conteo    integer not null default 0,
  ventana   timestamptz not null default now()
);
