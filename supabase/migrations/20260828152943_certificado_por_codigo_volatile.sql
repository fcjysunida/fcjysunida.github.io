-- `certificado_por_codigo` estaba declarada STABLE, pero llama a `app.limite()`,
-- que escribe el contador del límite de tasa. PostgREST ejecuta las funciones no
-- volátiles en una transacción de solo lectura, así que la verificación pública
-- de constancias fallaba con «cannot execute INSERT in a read-only transaction».
-- Es VOLATILE: escribe.

create or replace function public.certificado_por_codigo(p_codigo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v jsonb;
begin
  if not app.limite('cert:' || upper(btrim(coalesce(p_codigo,''))), 20, interval '10 minutes') then
    return jsonb_build_object('error', 'demasiados_intentos');
  end if;
  select jsonb_build_object(
    'codigo', c.codigo, 'nombre', c.nombre, 'evento', c.evento,
    'fecha', c.fecha_texto, 'horas', c.horas, 'jornadas', c.jornadas,
    'rol', c.rol, 'emitido_en', c.emitido_en,
    'valido', c.anulado_en is null,
    'anulado_en', c.anulado_en,
    'modalidad', a.modalidad, 'lugar', a.lugar,
    'plantilla', (select jsonb_build_object('cuerpo_html', p.cuerpo_html,
                                            'fondo_url', p.fondo_url,
                                            'orientacion', p.orientacion)
                    from public.certificado_plantillas p where p.id = c.plantilla_id))
    into v
    from public.certificados c
    join public.actividades a on a.id = c.actividad_id
   where upper(c.codigo) = upper(btrim(p_codigo));
  if v is null then return jsonb_build_object('error', 'no_encontrado'); end if;
  return v;
end $$;
revoke execute on function public.certificado_por_codigo(text) from public;
grant  execute on function public.certificado_por_codigo(text) to anon, authenticated;

-- Control: ninguna otra función pública mezcla escritura con volatilidad no
-- volátil. Se listan para dejar constancia.
--   consentimiento_vigente  stable, sin escrituras
--   actividad_por_token     stable, sin escrituras
--   asistencia_contexto     stable, sin escrituras
--   evaluacion_pendiente    stable, sin escrituras
--   inscribir               volatile
--   registrar_asistencia    volatile
--   evaluar_actividad       volatile
--   solicitar_derecho       volatile;
