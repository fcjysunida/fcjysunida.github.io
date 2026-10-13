-- Cátedras y correos que constan en los formularios e informes remitidos.
update docentes
   set catedras = array['Gestión del Cambio en la Política Pública'],
       email    = coalesce(email, 'sofiarattazzi13@gmail.com')
 where public.unaccent_simple(lower(nombre)) like '%rattazzi%';

update docentes
   set catedras = array['Introducción al Derecho']
 where public.unaccent_simple(lower(nombre)) like '%edith caceres%';

-- «Derecho en un minuto» es el nombre del proyecto, no una cátedra:
-- el informe no consigna la asignatura a cargo de la docente.
update docentes
   set catedras = '{}'
 where public.unaccent_simple(lower(nombre)) like '%paciello%';;
