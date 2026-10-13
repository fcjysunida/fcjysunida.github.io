-- Postgres concede EXECUTE a PUBLIC en toda función nueva, y `anon` hereda de
-- PUBLIC. Eso dejaba llamables desde internet funciones que son del panel.
-- El caso grave: aplicar_retencion() se saltaba su propio control porque
-- auth.uid() es NULL para un visitante anónimo — un anónimo podía disparar la
-- anonimización. Se revoca todo y se concede solo lo que debe ser público.

-- 1. Cerrar el esquema completo y volver a abrir lo justo.
revoke execute on all functions in schema public from public, anon;

-- Solo estas cuatro se llaman sin sesión, desde /f/:token, /a/:token y /derechos.
grant execute on function public.consentimiento_vigente()                        to anon, authenticated;
grant execute on function public.actividad_por_token(text)                       to anon, authenticated;
grant execute on function public.inscribir(text, jsonb, jsonb)                   to anon, authenticated;
grant execute on function public.asistencia_contexto(text)                       to anon, authenticated;
grant execute on function public.registrar_asistencia(text, text, text)          to anon, authenticated;
grant execute on function public.evaluacion_pendiente(text, text)                to anon, authenticated;
grant execute on function public.evaluar_actividad(text, text, jsonb)            to anon, authenticated;
grant execute on function public.solicitar_derecho(text, text, text)             to anon, authenticated;

-- El resto exige sesión con rol.
grant execute on function public.rol_actual()                                    to authenticated;
grant execute on function public.auditar(text, text, uuid, text, jsonb)          to authenticated;
grant execute on function public.cedula_de(uuid, text)                           to authenticated;
grant execute on function public.sensibles_de(uuid, text)                        to authenticated;
grant execute on function public.enlaces_de(uuid)                                to authenticated;
grant execute on function public.regenerar_enlace(uuid)                          to authenticated;
grant execute on function public.regenerar_codigo(uuid, smallint)                to authenticated;
grant execute on function public.exportar_inscripciones(uuid, text, boolean)     to authenticated;
grant execute on function public.cerrar_actividad(uuid, boolean)                 to authenticated;
grant execute on function public.aplicar_retencion(int, boolean)                 to authenticated;
grant execute on function public.indicadores(text)                               to authenticated;
grant execute on function public.periodos_disponibles()                          to authenticated;
grant execute on function public.satisfaccion_de(uuid)                           to authenticated;
grant execute on function public.comentarios_de(uuid)                            to authenticated;
grant execute on function public.crear_actividad(
  text, public.tipo_actividad, public.modalidad_actividad, date, smallint, integer,
  text, text, text, text, jsonb, numeric, uuid, public.estado_actividad)         to authenticated;

-- 2. Que ninguna función futura nazca abierta.
alter default privileges in schema public revoke execute on functions from public, anon;

-- 3. La retención exige rol de Dirección, sin la puerta trasera del anónimo.
--    La tarea programada la corre `service_role`, que no pasa por estos permisos.
create or replace function public.aplicar_retencion(
  p_meses int default 24, p_simulacion boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_ids uuid[]; v_n int;
begin
  if not app.es('admin') then
    raise exception 'Solo la Dirección aplica la retención.';
  end if;

  select coalesce(array_agg(i.id), '{}') into v_ids
    from public.inscripciones i
    join public.actividades a on a.id = i.actividad_id
   where i.anonimizada_en is null
     and a.estado in ('cerrada','finalizada')
     and coalesce(a.cerrada_en, (a.fecha_inicio + a.dias)::timestamptz)
         < now() - make_interval(months => p_meses);
  v_n := coalesce(array_length(v_ids, 1), 0);

  if p_simulacion or v_n = 0 then
    return jsonb_build_object('simulacion', true, 'alcanzadas', v_n, 'meses', p_meses);
  end if;

  delete from public.respuestas where inscripcion_id = any(v_ids) and sensible;
  update public.inscripciones set
    nombre = 'Titular anonimizado', cedula_cif = null, cedula_mascara = null,
    email = ('anonimo+' || id::text || '@unida.edu.py')::extensions.citext,
    telefono_cif = null, accesibilidad_cif = null, consent_sensible = false,
    carrera = null, anonimizada_en = now()
   where id = any(v_ids);

  insert into public.auditoria (accion, entidad, motivo, detalle)
  values ('retencion_aplicada', 'inscripciones', 'plazo de conservación vencido',
          jsonb_build_object('anonimizadas', v_n, 'meses', p_meses));
  return jsonb_build_object('simulacion', false, 'anonimizadas', v_n, 'meses', p_meses);
end $$;
revoke execute on function public.aplicar_retencion(int, boolean) from public, anon;
grant  execute on function public.aplicar_retencion(int, boolean) to authenticated;

-- 4. Los indicadores tampoco son públicos.
create or replace function public.indicadores_guardia() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.es('admin','coordinacion','secretaria','auditor','docente') then
    raise exception 'Su rol no consulta los indicadores.';
  end if;
end $$;
revoke execute on function public.indicadores_guardia() from public, anon;

-- 5. La tabla de límites de tasa no se lee ni se escribe desde ningún cliente.
create policy limites_sin_acceso on public.limites_tasa
  for all to anon, authenticated using (false) with check (false);;
