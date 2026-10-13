-- Registro de docentes que intervienen en extensión.
--
-- Es distinto de `usuarios`: un docente puede figurar como responsable de un
-- proyecto sin tener cuenta en el panel, y a la inversa. Cuando además tiene
-- cuenta, se enlazan por `usuario_id`.
--
-- El correo se guarda porque es el canal por el que remiten proyectos e
-- informes, y porque el informe DTC pide identificar al docente responsable.
-- Es dato de contacto profesional, no personal sensible.

create table public.docentes (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (length(btrim(nombre)) > 0),
  email        extensions.citext,
  emails_alternos text[] not null default '{}',
  catedras     text[] not null default '{}',
  carreras     text,
  titulo       text,
  es_dtc       boolean not null default false,
  activo       boolean not null default true,
  usuario_id   uuid references public.usuarios(id) on delete set null,
  nota         text,
  creado_por   uuid references public.usuarios(id),
  creado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index docentes_email_idx on public.docentes (email) where email is not null;
create index docentes_nombre_idx on public.docentes (lower(nombre));

comment on column public.docentes.emails_alternos is
  'Los docentes remiten desde varias direcciones. Sirve para reconocer al mismo docente.';
comment on column public.docentes.es_dtc is
  'Docente de Tiempo Completo: es quien presenta el informe mensual de extensión.';

alter table public.docentes enable row level security;
create policy doc_lectura on public.docentes for select to authenticated using (true);
create policy doc_escritura on public.docentes for all to authenticated
  using (app.es('admin','coordinacion','secretaria'))
  with check (app.es('admin','coordinacion','secretaria'));
revoke all on public.docentes from anon;

-- Vínculo con los proyectos: un proyecto puede tener varios docentes, con roles
-- distintos (responsable, tutor, disertante, colaborador).
create table public.proyecto_docentes (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  docente_id  uuid not null references public.docentes(id) on delete cascade,
  rol         text not null default 'responsable'
              check (rol in ('responsable','tutor','disertante','colaborador')),
  catedra     text,
  unique (proyecto_id, docente_id, rol)
);
create index proydoc_proyecto_idx on public.proyecto_docentes (proyecto_id);
create index proydoc_docente_idx  on public.proyecto_docentes (docente_id);

alter table public.proyecto_docentes enable row level security;
create policy proydoc_todo on public.proyecto_docentes for all to authenticated
  using (exists (select 1 from public.proyectos p where p.id = proyecto_id))
  with check (exists (select 1 from public.proyectos p where p.id = proyecto_id));
revoke all on public.proyecto_docentes from anon;

-- ── Alta y reconocimiento ──────────────────────────────────────────────────────
-- Reconoce al docente por correo o por nombre normalizado, para no duplicarlo
-- cuando remite desde otra dirección.
create or replace function public.docente_registrar(
  p_nombre text, p_email text default null, p_catedras text[] default '{}',
  p_carreras text default null, p_es_dtc boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid; v_email text; v_nuevo boolean := false;
begin
  if not app.es('admin','coordinacion','secretaria') then
    raise exception 'Su rol no administra el registro de docentes.';
  end if;
  if coalesce(btrim(p_nombre),'') = '' then raise exception 'Falta el nombre.'; end if;
  v_email := nullif(lower(btrim(coalesce(p_email,''))),'');

  -- Primero por correo, que es unívoco; después por nombre.
  if v_email is not null then
    select id into v_id from public.docentes
     where email = v_email::extensions.citext
        or v_email = any(emails_alternos) limit 1;
  end if;
  if v_id is null then
    select id into v_id from public.docentes
     where lower(unaccent_simple(nombre)) = lower(unaccent_simple(btrim(p_nombre)))
     limit 1;
  end if;

  if v_id is null then
    insert into public.docentes (nombre, email, catedras, carreras, es_dtc, creado_por)
    values (btrim(p_nombre), v_email::extensions.citext,
            coalesce(p_catedras,'{}'), p_carreras, p_es_dtc, auth.uid())
    returning id into v_id;
    v_nuevo := true;
  else
    update public.docentes set
      email = coalesce(email, v_email::extensions.citext),
      emails_alternos = case
        when v_email is not null and email is not null
             and email <> v_email::extensions.citext
             and not (v_email = any(emails_alternos))
        then emails_alternos || v_email else emails_alternos end,
      catedras = (select array_agg(distinct c) from unnest(catedras || coalesce(p_catedras,'{}')) c
                   where btrim(c) <> ''),
      carreras = coalesce(carreras, p_carreras),
      es_dtc = es_dtc or p_es_dtc,
      actualizado_en = now()
     where id = v_id;
  end if;

  perform public.auditar(case when v_nuevo then 'alta_docente' else 'edicion_docente' end,
                         'docentes', v_id, null,
                         jsonb_build_object('nombre', p_nombre, 'correo', v_email));
  return jsonb_build_object('ok', true, 'id', v_id, 'nuevo', v_nuevo);
end $$;
revoke execute on function public.docente_registrar(text, text, text[], text, boolean)
  from public, anon;
grant execute on function public.docente_registrar(text, text, text[], text, boolean)
  to authenticated;

-- Función auxiliar simple: quita tildes para comparar nombres.
create or replace function public.unaccent_simple(p text)
returns text language sql immutable set search_path = '' as $$
  select translate(coalesce(p,''), 'áéíóúÁÉÍÓÚñÑüÜàèìòùâêîôû',
                                   'aeiouAEIOUnNuUaeiouaeiou')
$$;

create or replace function public.proyecto_docente_vincular(
  p_proyecto uuid, p_docente uuid, p_rol text default 'responsable',
  p_catedra text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not app.es('admin','coordinacion','secretaria') then
    raise exception 'Su rol no vincula docentes a proyectos.';
  end if;
  insert into public.proyecto_docentes (proyecto_id, docente_id, rol, catedra)
  values (p_proyecto, p_docente, p_rol, nullif(btrim(coalesce(p_catedra,'')),''))
  on conflict (proyecto_id, docente_id, rol) do update
    set catedra = coalesce(excluded.catedra, public.proyecto_docentes.catedra);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.proyecto_docente_vincular(uuid, uuid, text, text)
  from public, anon;
grant execute on function public.proyecto_docente_vincular(uuid, uuid, text, text)
  to authenticated;

-- ── Vista: qué hizo cada docente ───────────────────────────────────────────────
create view public.docentes_resumen
with (security_invoker = on) as
select d.id, d.nombre, d.email::text as email, d.catedras, d.carreras, d.titulo,
       d.es_dtc, d.activo, d.usuario_id, d.emails_alternos, d.creado_en,
       (select count(*) from public.proyecto_docentes pd
         where pd.docente_id = d.id)                                as proyectos,
       (select count(*) from public.proyecto_docentes pd
          join public.proyectos p on p.id = pd.proyecto_id
         where pd.docente_id = d.id and pd.rol = 'responsable')      as como_responsable,
       (select min(p.anio) from public.proyecto_docentes pd
          join public.proyectos p on p.id = pd.proyecto_id
         where pd.docente_id = d.id)                                as desde,
       (select max(p.anio) from public.proyecto_docentes pd
          join public.proyectos p on p.id = pd.proyecto_id
         where pd.docente_id = d.id)                                as hasta,
       (select coalesce(sum(p.horas_extension), 0) from public.proyecto_docentes pd
          join public.proyectos p on p.id = pd.proyecto_id
         where pd.docente_id = d.id)                                as horas_extension
from public.docentes d;
revoke all on public.docentes_resumen from anon;;
