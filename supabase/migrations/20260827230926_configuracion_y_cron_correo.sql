-- Configuración no secreta del sistema. Los secretos siguen en Vault.
create table public.configuracion (
  clave text primary key,
  valor text,
  nota  text,
  actualizado_en timestamptz not null default now()
);
alter table public.configuracion enable row level security;
create policy cfg_lectura on public.configuracion for select to authenticated using (true);
create policy cfg_escritura on public.configuracion for all to authenticated
  using (app.es('admin')) with check (app.es('admin'));
revoke all on public.configuracion from anon;

insert into public.configuracion (clave, valor, nota) values
 ('correo_remitente',        'extension@fcjysunida.edu.py',
  'Dirección remitente. Debe ser de un dominio verificado en el proveedor, con SPF, DKIM y DMARC.'),
 ('correo_remitente_nombre', 'Extensión FCJYS UNIDA', 'Nombre visible del remitente.'),
 ('correo_responder_a',      'extensionderecho@unida.edu.py',
  'Reply-To: acá llegan las respuestas de la gente.'),
 ('correo_tope_diario',      '100', 'Tope del plan gratuito del proveedor.'),
 ('correo_activo',           'false', 'Mientras sea false, los correos se encolan pero no se envían.'),
 ('dominio_publico',         'fcjysunida.github.io', 'Base de los enlaces que se reparten.')
on conflict (clave) do nothing;

create or replace function public.configuracion_guardar(p_clave text, p_valor text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not app.es('admin') then raise exception 'Solo la Dirección cambia la configuración.'; end if;
  insert into public.configuracion (clave, valor) values (p_clave, p_valor)
  on conflict (clave) do update set valor = excluded.valor, actualizado_en = now();
  perform public.auditar('configuracion', 'configuracion', null, null,
                         jsonb_build_object('clave', p_clave, 'valor', p_valor));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.configuracion_guardar(text, text) from public, anon;
grant  execute on function public.configuracion_guardar(text, text) to authenticated;

create or replace function app.config(p_clave text, p_default text default null)
returns text language sql stable set search_path = '' as $$
  select coalesce((select valor from public.configuracion where clave = p_clave), p_default)
$$;

-- ── Disparo de la cola desde la base ───────────────────────────────────────────
create extension if not exists pg_net with schema extensions;

create or replace function app.drenar_correo()
returns void language plpgsql volatile set search_path = '' as $$
declare v_url text; v_key text;
begin
  if app.config('correo_activo','false') <> 'true' then return; end if;
  v_key := app.secreto('fcjys_service_role');
  if v_key is null then return; end if;      -- todavía no se configuró
  v_url := 'https://mpsajgoycmmciobnnmjy.supabase.co/functions/v1/enviar-correos';
  perform extensions.net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer ' || v_key),
    body    := jsonb_build_object('tope', app.config('correo_tope_diario','100')::int),
    timeout_milliseconds := 25000);
end $$;

-- Cada quince minutos. Con el tope diario, el lote nunca desborda el plan gratuito.
select cron.schedule('fcjys-drenar-correo', '*/15 * * * *', $cron$ select app.drenar_correo(); $cron$);;
