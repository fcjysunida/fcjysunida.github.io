-- Cierre de las cuentas que no corresponden a personas reales:
--   prueba.rls@example.invalid   — verificación del despliegue (4 asientos)
--   sistema.padron@unida.edu.py  — importación del padrón y proyectos (50 asientos)
--
-- No se borran. `auditoria.usuario_id` referencia a `usuarios` sin cascada y la
-- auditoría es append only: borrar la fila destruiría la atribución de 54
-- asientos, que es justamente la prueba de quién cargó cada cosa. En su lugar
-- se les quita toda posibilidad de entrar y quedan como constancia histórica.
do $$
declare v_ids uuid[];
begin
  select array_agg(u.id) into v_ids
    from usuarios u
   where u.email in ('prueba.rls@example.invalid', 'sistema.padron@unida.edu.py');

  if v_ids is null then return; end if;

  -- Sin contraseña, baneada y sin sesiones abiertas: no hay forma de iniciar sesión.
  update auth.users
     set encrypted_password = null,
         banned_until       = 'infinity'::timestamptz
   where id = any (v_ids);

  delete from auth.sessions       where user_id = any (v_ids);
  delete from auth.refresh_tokens where user_id::uuid = any (v_ids);
  delete from auth.identities     where user_id = any (v_ids);

  -- Sin rol efectivo: `rol_actual()` exige activo, así que aunque quedara una
  -- sesión viva no autorizaría nada.
  update usuarios
     set activo = false,
         rol    = 'auditor',
         nombre = 'Cuenta cerrada — ' || nombre
   where id = any (v_ids)
     and nombre not like 'Cuenta cerrada%';

  insert into auditoria (accion, entidad, motivo, detalle)
  values ('usuarios_cerrados', 'usuarios',
          'Cierre de las cuentas de servicio y de prueba a pedido de la Dirección.',
          jsonb_build_object(
            'cuentas', array['prueba.rls@example.invalid', 'sistema.padron@unida.edu.py'],
            'medida', 'sin contraseña, baneadas, sin sesiones ni identidades, inactivas',
            'nota', 'No se borran: conservan la atribución de sus asientos de auditoría.'));
end $$;;
