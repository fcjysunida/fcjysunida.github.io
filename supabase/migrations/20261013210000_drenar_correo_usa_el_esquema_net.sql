-- `pg_net` vive en el esquema `net`, no en `extensions.net`. Con el nombre
-- viejo Postgres leía «extensions» como nombre de base de datos y cortaba con
-- «cross-database references are not implemented», así que la función fallaba
-- apenas pasaba los dos `return` de arriba.
--
-- No se notó nunca porque `correo_activo` estuvo en «false» desde el principio:
-- la función volvía en la primera línea y jamás llegaba a esta. Las 4.501
-- corridas de la tarea que figuran como «succeeded» no probaron nada.
--
-- De paso, el retorno silencioso cuando falta la clave de servicio pasa a dejar
-- un aviso en el registro. Un cron que no hace nada y no dice por qué es
-- exactamente lo que escondió este problema durante mes y medio.
create or replace function app.drenar_correo()
returns void language plpgsql security definer set search_path = '' as $$
declare v_url text; v_key text;
begin
  if app.config('correo_activo','false') <> 'true' then return; end if;

  v_key := app.secreto('fcjys_service_role');
  if v_key is null then
    raise warning 'drenar_correo: falta el secreto fcjys_service_role en la bóveda; no se envía nada.';
    return;
  end if;

  v_url := 'https://mpsajgoycmmciobnnmjy.supabase.co/functions/v1/enviar-correos';
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer ' || v_key),
    body    := jsonb_build_object('tope', app.config('correo_tope_diario','100')::int),
    timeout_milliseconds := 25000);
end $$;
