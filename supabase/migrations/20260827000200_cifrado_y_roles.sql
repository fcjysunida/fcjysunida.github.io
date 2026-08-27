-- Cifrado de columna, identidad de rol y auditoría.

-- ── Claves en Supabase Vault ───────────────────────────────────────────────────
-- Se crean con `cli -- claves:inicializar`; nunca viven en el repositorio.
create or replace function app.secreto(p_nombre text)
returns text language sql security definer stable set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_nombre limit 1
$$;
revoke all on function app.secreto(text) from public, anon, authenticated;

create or replace function app.cifrar(p_texto text)
returns bytea language sql security definer stable set search_path = '' as $$
  select case
    when p_texto is null or btrim(p_texto) = '' then null
    else extensions.pgp_sym_encrypt(p_texto, app.secreto('fcjys_cifrado_clave'))
  end
$$;
revoke all on function app.cifrar(text) from public, anon, authenticated;

create or replace function app.descifrar(p_dato bytea)
returns text language sql security definer stable set search_path = '' as $$
  select case
    when p_dato is null then null
    else extensions.pgp_sym_decrypt(p_dato, app.secreto('fcjys_cifrado_clave'))
  end
$$;
revoke all on function app.descifrar(bytea) from public, anon, authenticated;

-- HMAC de la cédula: permite validar el check-in sin descifrar nada.
create or replace function app.hash_cedula(p_cedula text)
returns text language sql security definer stable set search_path = '' as $$
  select encode(
    extensions.hmac(
      regexp_replace(coalesce(p_cedula,''), '[^0-9A-Za-z]', '', 'g'),
      app.secreto('fcjys_cedula_pepper'),
      'sha256'),
    'hex')
$$;
revoke all on function app.hash_cedula(text) from public, anon, authenticated;

-- ── Tokens y códigos ───────────────────────────────────────────────────────────
create or replace function app.nuevo_token()
returns text language sql volatile set search_path = '' as $$
  select encode(extensions.gen_random_bytes(10), 'hex')
$$;

create or replace function app.nuevo_codigo()
returns text language sql volatile set search_path = '' as $$
  select lpad((floor(random() * 10000))::int::text, 4, '0')
$$;

-- ── Rol de la sesión ───────────────────────────────────────────────────────────
create or replace function public.rol_actual()
returns public.rol_usuario language sql stable security definer set search_path = '' as $$
  select u.rol from public.usuarios u where u.id = auth.uid() and u.activo
$$;
grant execute on function public.rol_actual() to authenticated;

create or replace function app.es(variadic p_roles public.rol_usuario[])
returns boolean language sql stable set search_path = '' as $$
  select public.rol_actual() = any(p_roles)
$$;

-- ── Auditoría ──────────────────────────────────────────────────────────────────
create or replace function public.auditar(
  p_accion text, p_entidad text default null, p_entidad_id uuid default null,
  p_motivo text default null, p_detalle jsonb default null)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.auditoria (usuario_id, rol, accion, entidad, entidad_id, motivo, detalle)
  values (auth.uid(), public.rol_actual(), p_accion, p_entidad, p_entidad_id, p_motivo, p_detalle)
$$;
grant execute on function public.auditar(text, text, uuid, text, jsonb) to authenticated;

-- La auditoría no se edita ni se borra: tampoco por la Dirección.
create or replace function app.auditoria_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'El registro de auditoría es inalterable (art. 16, Ley N° 7593/2025).';
end $$;
create trigger auditoria_sin_update before update on public.auditoria
  for each row execute function app.auditoria_inmutable();
create trigger auditoria_sin_delete before delete on public.auditoria
  for each row execute function app.auditoria_inmutable();

-- ── Lectura controlada de datos cifrados ───────────────────────────────────────
-- Devuelve la cédula completa solo a Dirección y Secretaría, y deja constancia.
create or replace function public.cedula_de(p_inscripcion uuid, p_motivo text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_valor text;
begin
  if not app.es('admin','secretaria') then
    raise exception 'Su rol no accede a la cédula completa.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Debe declarar el motivo del acceso.';
  end if;
  select app.descifrar(i.cedula_cif) into v_valor
    from public.inscripciones i where i.id = p_inscripcion;
  perform public.auditar('lectura_cedula', 'inscripciones', p_inscripcion, p_motivo, null);
  return v_valor;
end $$;
grant execute on function public.cedula_de(uuid, text) to authenticated;

-- Datos sensibles: Dirección y el docente responsable de esa actividad.
create or replace function public.sensibles_de(p_inscripcion uuid, p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_out jsonb; v_ok boolean;
begin
  select app.es('admin') or exists (
    select 1 from public.inscripciones i
      join public.actividades a on a.id = i.actividad_id
     where i.id = p_inscripcion and a.docente_responsable = auth.uid())
  into v_ok;
  if not v_ok then
    raise exception 'Su rol no accede a los datos sensibles de esta inscripción.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Debe declarar el motivo del acceso.';
  end if;
  select jsonb_build_object(
           'accesibilidad', app.descifrar(i.accesibilidad_cif),
           'telefono',      app.descifrar(i.telefono_cif),
           'respuestas',    coalesce((
             select jsonb_object_agg(r.etiqueta, app.descifrar(r.valor_cif))
               from public.respuestas r
              where r.inscripcion_id = i.id and r.sensible), '{}'::jsonb))
    into v_out
    from public.inscripciones i where i.id = p_inscripcion;
  perform public.auditar('lectura_sensibles', 'inscripciones', p_inscripcion, p_motivo, null);
  return v_out;
end $$;
grant execute on function public.sensibles_de(uuid, text) to authenticated;

-- La máscara (dos últimos dígitos) se guarda en claro al inscribir: el panel la
-- lee sin descifrar nada. Es lo que ve todo rol salvo Dirección y Secretaría.
create or replace function app.mascara_cedula(p_cedula text)
returns text language sql immutable set search_path = '' as $$
  select '•••••' ||
         right(regexp_replace(coalesce(p_cedula,'00'), '[^0-9A-Za-z]', '', 'g'), 2)
$$;
