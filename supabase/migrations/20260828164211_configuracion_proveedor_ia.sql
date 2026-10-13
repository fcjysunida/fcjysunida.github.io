insert into public.configuracion (clave, valor, nota) values
 ('ia_proveedor', 'google',
  'Proveedor de la redacción asistida: anthropic, google, openai o xai. Cada uno se factura por separado; la clave va en los secretos de la función.'),
 ('ia_modelo', 'gemini-3-pro',
  'Identificador del modelo. Depende del proveedor: claude-opus-5, gemini-3-pro, o el que corresponda en OpenAI o xAI.'),
 ('ia_activa', 'true',
  'Mientras sea false, el botón de redacción asistida queda deshabilitado.')
on conflict (clave) do nothing;

-- La traza registra también el proveedor, no solo el modelo.
alter table public.redacciones_ia add column proveedor text;

create or replace function public.registrar_redaccion_ia(
  p_proyecto uuid, p_modelo text, p_entrada int, p_salida int,
  p_proveedor text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.redacciones_ia (proyecto_id, usuario_id, proveedor, modelo,
                                     tokens_entrada, tokens_salida)
  values (p_proyecto, auth.uid(), p_proveedor, p_modelo, p_entrada, p_salida);
  perform public.auditar('redaccion_ia', 'proyectos', p_proyecto, null,
                         jsonb_build_object('proveedor', p_proveedor, 'modelo', p_modelo));
end $$;
revoke execute on function public.registrar_redaccion_ia(uuid, text, int, int, text)
  from public, anon;
grant execute on function public.registrar_redaccion_ia(uuid, text, int, int, text)
  to authenticated;;
