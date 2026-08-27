-- Puesta en marcha de las claves y tarea programada de retención.

-- ── Claves del Vault ───────────────────────────────────────────────────────────
-- Se generan dentro de la base: nunca pasan por el repositorio, por una terminal
-- ni por un correo. Solo app.secreto() las lee, y esa función está revocada para
-- anon y authenticated.
create or replace function public.claves_inicializar()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_creadas int := 0;
begin
  if not exists (select 1 from vault.secrets where name = 'fcjys_cifrado_clave') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'), 'fcjys_cifrado_clave',
      'Clave de cifrado de columna (cédula, teléfono, datos sensibles)');
    v_creadas := v_creadas + 1;
  end if;
  if not exists (select 1 from vault.secrets where name = 'fcjys_cedula_pepper') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'), 'fcjys_cedula_pepper',
      'Pimienta del HMAC de cédula usado en el registro de asistencia');
    v_creadas := v_creadas + 1;
  end if;
  return case v_creadas
    when 0 then 'Las dos claves ya existían: no se tocó nada. Rotarlas invalidaría los datos cifrados.'
    else v_creadas || ' clave(s) creada(s) en Supabase Vault.' end;
end $$;
revoke execute on function public.claves_inicializar() from public, anon, authenticated;

-- ── Retención: núcleo reutilizable ─────────────────────────────────────────────
-- La función pública verifica el rol; la tarea programada llama directamente a
-- la interna, porque corre como `postgres` y no tiene sesión de usuario.
create or replace function app.retencion(p_meses int, p_simulacion boolean)
returns jsonb language plpgsql volatile set search_path = '' as $$
declare v_ids uuid[]; v_n int;
begin
  select coalesce(array_agg(i.id), '{}') into v_ids
    from public.inscripciones i
    join public.actividades a on a.id = i.actividad_id
   where i.anonimizada_en is null
     and a.estado in ('cerrada','finalizada')
     and coalesce(a.cerrada_en, (a.fecha_inicio + a.dias)::timestamptz)
         < now() - make_interval(months => p_meses);
  v_n := coalesce(array_length(v_ids, 1), 0);

  if p_simulacion or v_n = 0 then
    return jsonb_build_object('simulacion', true, 'alcanzadas', v_n, 'meses', p_meses);
  end if;

  -- Los datos sensibles se eliminan; el resto se anonimiza.
  delete from public.respuestas where inscripcion_id = any(v_ids) and sensible;
  update public.inscripciones set
    nombre = 'Titular anonimizado', cedula_cif = null, cedula_mascara = null,
    email = ('anonimo+' || id::text || '@unida.edu.py')::extensions.citext,
    telefono_cif = null, accesibilidad_cif = null, consent_sensible = false,
    carrera = null, anonimizada_en = now()
   where id = any(v_ids);

  insert into public.auditoria (accion, entidad, motivo, detalle)
  values ('retencion_aplicada', 'inscripciones', 'plazo de conservación vencido',
          jsonb_build_object('anonimizadas', v_n, 'meses', p_meses));
  return jsonb_build_object('simulacion', false, 'anonimizadas', v_n, 'meses', p_meses);
end $$;

create or replace function public.aplicar_retencion(
  p_meses int default 24, p_simulacion boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not app.es('admin') then
    raise exception 'Solo la Dirección aplica la retención.';
  end if;
  return app.retencion(p_meses, p_simulacion);
end $$;
revoke execute on function public.aplicar_retencion(int, boolean) from public, anon;
grant  execute on function public.aplicar_retencion(int, boolean) to authenticated;

-- ── Tarea programada mensual ───────────────────────────────────────────────────
-- Día 1 de cada mes, 03:10 UTC (00:10 en Asunción).
-- pg_cron vive en su propio esquema `cron`.
create extension if not exists pg_cron;

-- Retención: día 1 de cada mes, 03:10 UTC (00:10 en Asunción).
select cron.schedule(
  'fcjys-retencion-mensual', '10 3 1 * *',
  $cron$ select app.retencion(24, false); $cron$);

-- Purga del contador de límite de tasa: no es dato personal, pero no hay razón
-- para conservarlo. Todos los días a las 04:00 UTC.
select cron.schedule(
  'fcjys-purga-limites', '0 4 * * *',
  $cron$ delete from public.limites_tasa where ventana < now() - interval '1 day'; $cron$);
