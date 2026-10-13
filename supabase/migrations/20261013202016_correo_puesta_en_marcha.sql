-- Puesta en marcha de la cola de correo.
--
-- La cañería estaba completa desde agosto —tabla `correos`, `app.encolar_correo`,
-- `correos_pendientes`, `correo_resultado`, la función `enviar-correos` y la tarea
-- `fcjys-drenar-correo` cada quince minutos, que lleva 4.501 corridas— y sin
-- embargo no salió nunca un solo mensaje. Faltaban tres cosas que no son código:
--
--   1. el secreto `fcjys_service_role` en la bóveda. Sin él `app.drenar_correo()`
--      vuelve sin llamar a nada, en silencio y sin dejar rastro;
--   2. `RESEND_API_KEY` en los secretos de la función;
--   3. `correo_activo` en «true», con un remitente de un dominio verificado.
--
-- Esto resuelve (1) sin que la clave pase por una consola SQL, donde quedaría en
-- el historial de consultas, y agrega un diagnóstico que dice qué falta sin
-- revelar ningún valor.

-- ── Guardar la clave de servicio ──────────────────────────────────────────────
-- Llamala desde el CLI (`npm run cli -- correo:preparar`), nunca desde el editor
-- SQL del panel: ahí el argumento queda escrito en el historial.
create or replace function public.correo_preparar(p_service_role text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if coalesce(btrim(p_service_role), '') = '' then
    raise exception 'La clave de servicio no puede venir vacía.';
  end if;

  select id into v_id from vault.secrets where name = 'fcjys_service_role';

  if v_id is null then
    perform vault.create_secret(
      p_service_role, 'fcjys_service_role',
      'Clave de servicio con la que la tarea programada invoca enviar-correos.');
    return 'Clave de servicio guardada en la bóveda.';
  end if;

  perform vault.update_secret(v_id, p_service_role);
  return 'Clave de servicio reemplazada en la bóveda.';
end $$;

revoke all on function public.correo_preparar(text) from public, anon, authenticated;

-- ── Diagnóstico ──────────────────────────────────────────────────────────────
-- Devuelve qué falta para que salga un correo. No devuelve ningún secreto: sólo
-- si existe o no. El remitente sí se muestra, porque va en la cabecera de cada
-- mensaje y no es un dato reservado.
create or replace function public.correo_estado()
returns table (requisito text, listo boolean, detalle text)
language sql stable security definer set search_path = '' as $$
  select 'Clave de servicio en la bóveda',
         exists (select 1 from vault.secrets where name = 'fcjys_service_role'),
         'Sin ella la tarea vuelve sin llamar a la función, y no avisa.'
  union all
  select 'Envío activado',
         app.config('correo_activo', 'false') = 'true',
         'Se prende en Ajustes.'
  union all
  select 'Remitente definido',
         coalesce(btrim(app.config('correo_remitente', '')), '') <> '',
         'Hoy: ' || coalesce(nullif(btrim(app.config('correo_remitente', '')), ''),
                             'sin definir') ||
         '. El dominio tiene que estar verificado en Resend.'
  union all
  select 'Tarea programada activa',
         exists (select 1 from cron.job
                  where jobname = 'fcjys-drenar-correo' and active),
         'Cada quince minutos.'
  union all
  select 'Cola',
         true,
         (select count(*) || ' en total, ' ||
                 count(*) filter (where enviado_en is null) || ' sin enviar'
            from public.correos)
$$;

revoke all on function public.correo_estado() from public, anon;
grant execute on function public.correo_estado() to authenticated;
