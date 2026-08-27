-- `evaluaciones` se creó después del revoke general, y Supabase concede acceso a
-- `anon` sobre las tablas nuevas de `public`. La RLS ya la bloqueaba (no hay
-- política para anon), pero la consulta devolvía 200 con lista vacía en vez de
-- 401. Se cierra el permiso de tabla para que falle antes de llegar a la RLS, y
-- se ajustan los privilegios por defecto para que ninguna tabla futura nazca
-- abierta al visitante anónimo.

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- La superficie pública es exclusivamente el conjunto de funciones concedidas en
-- 20260827000900_endurecer_superficie_rpc.sql. Ninguna tabla, ninguna vista.
