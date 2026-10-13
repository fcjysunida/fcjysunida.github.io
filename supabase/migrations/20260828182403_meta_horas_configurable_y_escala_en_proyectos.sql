-- La meta deja de estar escrita en el código: se configura.
-- Ojo con la cifra: la nota de `horas_extension_sugeridas` habla de un mínimo de
-- 30 horas en al menos tres actividades distintas, mientras que la Coordinación
-- fijó 33. Se toma 33 y queda en un solo lugar para corregirlo si corresponde.
insert into configuracion (clave, valor, nota) values
  ('extension_horas_meta', '33',
   'Horas de Extensión Universitaria que debe acumular un estudiante a lo largo '
   'de la carrera. El anexo de la escala menciona 30 en al menos tres actividades '
   'distintas; verificar contra el reglamento vigente.')
on conflict (clave) do nothing;

create or replace function app.meta_horas_extension() returns numeric
  language sql stable security definer set search_path to '' as $$
  select coalesce((select valor::numeric from public.configuracion
                    where clave = 'extension_horas_meta'), 33)
$$;

-- Los proyectos importados quedaron con 0 horas de extensión: el importador
-- nunca aplicó la escala del anexo. Se calcula sobre las horas reloj y la
-- clasificación de cada uno, que es lo que manda la escala.
update proyectos p
   set horas_extension = (
         public.horas_extension_sugeridas(
           p.clasificacion,
           coalesce(p.horas_reloj, 0),
           greatest(1, coalesce((p.fecha_fin - p.fecha_inicio) + 1, 1))::smallint
         ) ->> 'horas')::numeric
 where coalesce(p.horas_extension, 0) = 0;;
