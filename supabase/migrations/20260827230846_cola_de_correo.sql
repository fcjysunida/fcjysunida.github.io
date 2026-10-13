-- Cola de correo. El envío no se hace en línea: se encola y una tarea lo drena.
-- Así el plan gratuito del proveedor (100 envíos por día en Resend) no rompe una
-- inscripción ni una emisión de certificados, y los reintentos son baratos.

create type public.estado_correo as enum ('pendiente','enviado','fallido','cancelado');

create table public.correos (
  id              uuid primary key default gen_random_uuid(),
  destino         extensions.citext not null,
  nombre_destino  text,
  asunto          text not null,
  cuerpo_html     text not null,
  cuerpo_texto    text,
  motivo          text not null,
  entidad         text,
  entidad_id      uuid,
  estado          public.estado_correo not null default 'pendiente',
  intentos        smallint not null default 0,
  error           text,
  programado_para timestamptz not null default now(),
  enviado_en      timestamptz,
  proveedor_id    text,
  creado_en       timestamptz not null default now()
);
create index correos_cola_idx on public.correos (estado, programado_para)
  where estado = 'pendiente';
create index correos_entidad_idx on public.correos (entidad, entidad_id);

alter table public.correos enable row level security;
-- El cuerpo lleva nombre y datos de la actividad: lo ven quienes ya ven inscriptos.
create policy correo_lectura on public.correos for select to authenticated
  using (app.es('admin','coordinacion','secretaria','auditor'));
revoke all on public.correos from anon;

-- ── Encolado ───────────────────────────────────────────────────────────────────
create or replace function app.encolar_correo(
  p_destino text, p_nombre text, p_asunto text, p_html text, p_texto text,
  p_motivo text, p_entidad text default null, p_entidad_id uuid default null,
  p_programado timestamptz default now())
returns uuid language plpgsql volatile set search_path = '' as $$
declare v_id uuid;
begin
  if coalesce(p_destino,'') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return null;                       -- sin correo válido no se encola nada
  end if;
  insert into public.correos (destino, nombre_destino, asunto, cuerpo_html, cuerpo_texto,
                              motivo, entidad, entidad_id, programado_para)
  values (lower(p_destino), p_nombre, p_asunto, p_html, p_texto,
          p_motivo, p_entidad, p_entidad_id, p_programado)
  returning id into v_id;
  return v_id;
end $$;

-- ── Lote a enviar ──────────────────────────────────────────────────────────────
-- Respeta el tope diario del proveedor: cuenta lo ya enviado en las últimas 24 h.
create or replace function public.correos_pendientes(
  p_tope_diario int default 100, p_lote int default 20)
returns table (id uuid, destino text, nombre_destino text, asunto text,
               cuerpo_html text, cuerpo_texto text)
language plpgsql volatile security definer set search_path = '' as $$
declare v_hoy int; v_cupo int;
begin
  select count(*) into v_hoy from public.correos
   where estado = 'enviado' and enviado_en > now() - interval '24 hours';
  v_cupo := least(p_lote, greatest(0, p_tope_diario - v_hoy));
  if v_cupo = 0 then return; end if;

  return query
  update public.correos c set intentos = c.intentos + 1
   where c.id in (
     select c2.id from public.correos c2
      where c2.estado = 'pendiente' and c2.programado_para <= now() and c2.intentos < 5
      order by c2.programado_para
      limit v_cupo
      for update skip locked)
  returning c.id, c.destino::text, c.nombre_destino, c.asunto, c.cuerpo_html, c.cuerpo_texto;
end $$;
revoke execute on function public.correos_pendientes(int, int) from public, anon, authenticated;

create or replace function public.correo_resultado(
  p_id uuid, p_ok boolean, p_proveedor_id text default null, p_error text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.correos set
    estado = case when p_ok then 'enviado'::public.estado_correo
                  when intentos >= 5 then 'fallido'::public.estado_correo
                  else 'pendiente'::public.estado_correo end,
    enviado_en = case when p_ok then now() else enviado_en end,
    proveedor_id = coalesce(p_proveedor_id, proveedor_id),
    error = case when p_ok then null else p_error end,
    -- Reintento con espera creciente: 5, 25, 125 minutos…
    programado_para = case when p_ok then programado_para
                           else now() + (power(5, intentos) || ' minutes')::interval end
   where id = p_id;
end $$;
revoke execute on function public.correo_resultado(uuid, boolean, text, text)
  from public, anon, authenticated;

-- ── Estado de la cola, para el panel ───────────────────────────────────────────
create or replace function public.correos_estado()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'pendientes', count(*) filter (where estado = 'pendiente'),
    'enviados_24h', count(*) filter (where estado = 'enviado' and enviado_en > now() - interval '24 hours'),
    'enviados_30d', count(*) filter (where estado = 'enviado' and enviado_en > now() - interval '30 days'),
    'fallidos', count(*) filter (where estado = 'fallido'),
    'proximo', (select min(programado_para) from public.correos where estado = 'pendiente'))
  from public.correos
  where app.es('admin','coordinacion','secretaria','auditor')
$$;
revoke execute on function public.correos_estado() from public, anon;
grant  execute on function public.correos_estado() to authenticated;;
