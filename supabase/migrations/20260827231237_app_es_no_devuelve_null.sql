-- FALLO DE AUTORIZACIÓN.
--
-- `app.es()` era:   select public.rol_actual() = any(p_roles)
-- Cuando `rol_actual()` es NULL —sesión sin fila en `usuarios`, o usuario
-- desactivado— la comparación da NULL, no `false`. Y en plpgsql,
-- `if not NULL then raise exception ... end if` NO entra al cuerpo: NULL no es
-- verdadero. Es decir que **todos** los controles escritos como
-- `if not app.es(...) then raise` se salteaban en silencio.
--
-- En las políticas RLS no había problema (allí NULL se trata como falso), y el
-- rol `anon` no tiene EXECUTE sobre esas funciones. Pero cualquier cuenta
-- autenticada sin rol asignado —alguien recién dado de alta, o un usuario
-- desactivado— sí podía llamarlas y pasar el control: crear actividades,
-- emitir certificados, exportar, aplicar la retención.
--
-- La corrección es que la función nunca devuelva NULL.

create or replace function app.es(variadic p_roles public.rol_usuario[])
returns boolean language sql stable set search_path = '' as $$
  select coalesce(public.rol_actual() = any(p_roles), false)
$$;

-- Y que `rol_actual()` sea explícita: sin sesión, no hay rol.
create or replace function public.rol_actual()
returns public.rol_usuario language sql stable security definer set search_path = '' as $$
  select u.rol from public.usuarios u
   where auth.uid() is not null and u.id = auth.uid() and u.activo
$$;
grant execute on function public.rol_actual() to authenticated;;
