-- Alta de roles desde el panel. Quien se registra queda sin permisos hasta que
-- la Dirección lo habilita: nadie se asigna un rol a sí mismo.

-- Cuentas registradas que todavía no tienen rol.
create or replace function public.usuarios_pendientes()
returns table (id uuid, email text, nombre text, registrado_en timestamptz,
               correo_confirmado boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text,
         coalesce(u.raw_user_meta_data->>'nombre', ''),
         u.created_at,
         u.email_confirmed_at is not null
    from auth.users u
   where app.es('admin')
     and not exists (select 1 from public.usuarios x where x.id = u.id)
   order by u.created_at desc
$$;
revoke execute on function public.usuarios_pendientes() from public, anon;
grant  execute on function public.usuarios_pendientes() to authenticated;

-- Usuarios habilitados, con su rol.
create or replace function public.usuarios_listar()
returns table (id uuid, email text, nombre text, rol public.rol_usuario,
               activo boolean, creado_en timestamptz, correo_confirmado boolean,
               es_uno_mismo boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, u.nombre, u.rol, u.activo, u.creado_en,
         a.email_confirmed_at is not null,
         u.id = auth.uid()
    from public.usuarios u
    join auth.users a on a.id = u.id
   where app.es('admin','coordinacion','auditor')
   order by u.activo desc, u.rol, u.nombre
$$;
revoke execute on function public.usuarios_listar() from public, anon;
grant  execute on function public.usuarios_listar() to authenticated;

create or replace function public.usuario_asignar_rol(
  p_id uuid, p_rol public.rol_usuario, p_nombre text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_email text; v_anterior public.rol_usuario;
begin
  if not app.es('admin') then
    raise exception 'Solo la Dirección asigna roles.';
  end if;
  select email into v_email from auth.users where id = p_id;
  if v_email is null then raise exception 'Esa cuenta no existe.'; end if;

  select rol into v_anterior from public.usuarios where id = p_id;

  -- La Dirección no puede quitarse a sí misma el rol: dejaría el sistema sin
  -- nadie que pueda volver a asignarlo.
  if p_id = auth.uid() and p_rol <> 'admin' then
    raise exception 'No puede cambiar su propio rol de Dirección. Pídaselo a otra persona con ese rol.';
  end if;

  insert into public.usuarios (id, nombre, email, rol, activo)
  values (p_id,
          coalesce(nullif(btrim(coalesce(p_nombre,'')),''),
                   (select nullif(btrim(coalesce(raw_user_meta_data->>'nombre','')),'')
                      from auth.users where id = p_id),
                   split_part(v_email, '@', 1)),
          v_email, p_rol, true)
  on conflict (id) do update
    set rol = excluded.rol, activo = true,
        nombre = coalesce(nullif(btrim(coalesce(p_nombre,'')),''), public.usuarios.nombre);

  perform public.auditar(
    case when v_anterior is null then 'alta_usuario' else 'cambio_rol' end,
    'usuarios', p_id, null,
    jsonb_build_object('correo', v_email, 'rol_anterior', v_anterior, 'rol_nuevo', p_rol));
  return jsonb_build_object('ok', true, 'rol', p_rol);
end $$;
revoke execute on function public.usuario_asignar_rol(uuid, public.rol_usuario, text)
  from public, anon;
grant execute on function public.usuario_asignar_rol(uuid, public.rol_usuario, text)
  to authenticated;

create or replace function public.usuario_activar(p_id uuid, p_activo boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_email text;
begin
  if not app.es('admin') then
    raise exception 'Solo la Dirección activa o desactiva cuentas.';
  end if;
  if p_id = auth.uid() and not p_activo then
    raise exception 'No puede desactivar su propia cuenta.';
  end if;
  if not p_activo and not exists (
        select 1 from public.usuarios
         where rol = 'admin' and activo and id <> p_id) then
    raise exception 'Es la única cuenta de Dirección activa: habilite otra antes de desactivarla.';
  end if;
  update public.usuarios set activo = p_activo where id = p_id
    returning email into v_email;
  perform public.auditar(case when p_activo then 'alta_usuario' else 'baja_usuario' end,
                         'usuarios', p_id, null,
                         jsonb_build_object('correo', v_email, 'activo', p_activo));
  return jsonb_build_object('ok', true, 'activo', p_activo);
end $$;
revoke execute on function public.usuario_activar(uuid, boolean) from public, anon;
grant  execute on function public.usuario_activar(uuid, boolean) to authenticated;

-- Confirma el correo de una cuenta a mano. Hace falta mientras el envío de
-- correo no esté configurado: sin esto, quien se registra no puede entrar.
create or replace function public.usuario_confirmar_correo(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_email text;
begin
  if not app.es('admin') then
    raise exception 'Solo la Dirección confirma cuentas.';
  end if;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = p_id returning email into v_email;
  if v_email is null then raise exception 'Esa cuenta no existe.'; end if;
  perform public.auditar('confirmacion_correo', 'usuarios', p_id,
                         'confirmación manual mientras el envío de correo no está activo',
                         jsonb_build_object('correo', v_email));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.usuario_confirmar_correo(uuid) from public, anon;
grant  execute on function public.usuario_confirmar_correo(uuid) to authenticated;;
