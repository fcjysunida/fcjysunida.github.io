-- Normograma: las normas que rigen extensión, proyección social y pasantías,
-- con el articulado pertinente transcrito. Los extractos se toman de la fuente
-- publicada; cuando el PDF es un escaneo sin capa de texto se deja el enlace y
-- se marca `sin_texto`, para no citar articulado que no se pudo leer.
create table if not exists normas (
  codigo    text primary key,
  orden     smallint not null default 0,
  jerarquia text not null check (jerarquia in
              ('constitucion', 'ley', 'estatuto', 'reglamento', 'resolucion', 'plan')),
  titulo    text not null,
  organo    text,
  anio      smallint,
  url       text,
  ambito    text[] not null default '{}',
  sumario   text,
  sin_texto boolean not null default false,
  vigente   boolean not null default true
);

create table if not exists norma_articulos (
  id        uuid primary key default gen_random_uuid(),
  norma     text not null references normas(codigo) on delete cascade,
  orden     smallint not null default 0,
  numero    text not null,
  epigrafe  text,
  texto     text not null,
  ambito    text[] not null default '{}'
);

create index if not exists norma_articulos_norma_idx on norma_articulos (norma, orden);

alter table normas          enable row level security;
alter table norma_articulos enable row level security;
drop policy if exists normas_lectura on normas;
drop policy if exists norma_articulos_lectura on norma_articulos;
create policy normas_lectura          on normas          for select using (auth.uid() is not null);
create policy norma_articulos_lectura on norma_articulos for select using (auth.uid() is not null);

revoke all on normas, norma_articulos from public, anon;
grant select on normas, norma_articulos to authenticated;;
