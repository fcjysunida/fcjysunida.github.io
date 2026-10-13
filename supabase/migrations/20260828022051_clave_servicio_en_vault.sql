-- La tarea programada necesita una credencial para invocar la función de envío.
-- Se guarda en Vault, nunca en el repositorio ni en la tabla de configuración.
-- Solo `service_role` puede llamar a esta función, porque es el único que se
-- saltea los permisos revocados.

create or replace function public.clave_servicio_guardar(p_clave text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if coalesce(btrim(p_clave), '') = '' then
    raise exception 'La clave viene vacía.';
  end if;
  select id into v_id from vault.secrets where name = 'fcjys_service_role';
  if v_id is null then
    perform vault.create_secret(p_clave, 'fcjys_service_role',
      'Clave de servicio que usa la tarea programada para invocar el envío de correo');
    return 'Clave de servicio guardada en la bóveda.';
  end if;
  perform vault.update_secret(v_id, p_clave);
  return 'Clave de servicio actualizada en la bóveda.';
end $$;
revoke execute on function public.clave_servicio_guardar(text)
  from public, anon, authenticated;;
