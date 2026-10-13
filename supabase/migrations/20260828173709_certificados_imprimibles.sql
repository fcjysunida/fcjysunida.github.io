-- Constancias listas para imprimir: la plantilla y los valores en una sola
-- consulta, para poder generar el PDF de un lote entero sin ir de a una.

create or replace function public.certificados_imprimibles(
  p_actividad uuid, p_solo_sin_aviso boolean default false)
returns table (codigo text, nombre text, evento text, fecha_texto text,
               horas numeric, jornadas smallint, rol text, modalidad text,
               lugar text, emitido_en timestamptz, cuerpo_html text,
               fondo_url text, orientacion text)
language sql stable security definer set search_path = '' as $$
  select c.codigo, c.nombre, c.evento, c.fecha_texto, c.horas, c.jornadas,
         c.rol::text, a.modalidad::text, a.lugar, c.emitido_en,
         p.cuerpo_html, p.fondo_url, p.orientacion
    from public.certificados c
    join public.actividades a on a.id = c.actividad_id
    left join public.certificado_plantillas p on p.id = c.plantilla_id
   where c.actividad_id = p_actividad
     and c.anulado_en is null
     and (not p_solo_sin_aviso or c.aviso_enviado_en is null)
     and (app.es('admin','coordinacion','secretaria','auditor')
          or exists (select 1 from public.actividades x
                      where x.id = p_actividad and x.docente_responsable = auth.uid()))
   order by c.nombre
$$;
revoke execute on function public.certificados_imprimibles(uuid, boolean) from public, anon;
grant  execute on function public.certificados_imprimibles(uuid, boolean) to authenticated;;
