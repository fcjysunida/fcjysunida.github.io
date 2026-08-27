-- Postgres concede EXECUTE a PUBLIC en toda función nueva, y `anon` hereda de
-- PUBLIC. Eso dejaba llamables desde internet funciones que son del panel.
-- Se revoca todo y se concede solo lo que debe ser público.

revoke execute on all functions in schema public from public, anon;

-- Las ocho que se llaman sin sesión, desde /f/:token, /a/:token y /derechos.
grant execute on function public.consentimiento_vigente()               to anon, authenticated;
grant execute on function public.actividad_por_token(text)              to anon, authenticated;
grant execute on function public.inscribir(text, jsonb, jsonb)          to anon, authenticated;
grant execute on function public.asistencia_contexto(text)              to anon, authenticated;
grant execute on function public.registrar_asistencia(text, text, text) to anon, authenticated;
grant execute on function public.evaluacion_pendiente(text, text)       to anon, authenticated;
grant execute on function public.evaluar_actividad(text, text, jsonb)   to anon, authenticated;
grant execute on function public.solicitar_derecho(text, text, text)    to anon, authenticated;

-- El resto exige sesión con rol.
grant execute on function public.rol_actual()                                to authenticated;
grant execute on function public.auditar(text, text, uuid, text, jsonb)      to authenticated;
grant execute on function public.cedula_de(uuid, text)                       to authenticated;
grant execute on function public.sensibles_de(uuid, text)                    to authenticated;
grant execute on function public.enlaces_de(uuid)                            to authenticated;
grant execute on function public.regenerar_enlace(uuid)                      to authenticated;
grant execute on function public.regenerar_codigo(uuid, smallint)            to authenticated;
grant execute on function public.exportar_inscripciones(uuid, text, boolean) to authenticated;
grant execute on function public.cerrar_actividad(uuid, boolean)             to authenticated;
grant execute on function public.aplicar_retencion(int, boolean)             to authenticated;
grant execute on function public.indicadores(text)                           to authenticated;
grant execute on function public.periodos_disponibles()                      to authenticated;
grant execute on function public.satisfaccion_de(uuid)                       to authenticated;
grant execute on function public.comentarios_de(uuid)                        to authenticated;
grant execute on function public.crear_actividad(
  text, public.tipo_actividad, public.modalidad_actividad, date, smallint, integer,
  text, text, text, text, jsonb, numeric, uuid, public.estado_actividad)     to authenticated;

-- Que ninguna función futura nazca abierta.
alter default privileges in schema public revoke execute on functions from public, anon;

-- La tabla de límites de tasa no se lee ni se escribe desde ningún cliente.
create policy limites_sin_acceso on public.limites_tasa
  for all to anon, authenticated using (false) with check (false);
