drop function if exists padron_reconciliar(text, text[], text[], boolean);

-- Recibe los documentos en claro y los hashea acá: el pepper vive en Vault y
-- el cliente no puede calcular el hash. Los documentos no se guardan.
create or replace function padron_reconciliar(
  p_periodo     text,
  p_matriculas  text[],
  p_documentos  text[],
  p_dry_run     boolean default true
) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_total int; v_sobran int; v_nombres jsonb; v_hashes text[];
begin
  if not app.es('admin', 'secretaria') then
    raise exception 'Su rol no reconcilia el padrón académico.';
  end if;
  if coalesce(array_length(p_matriculas, 1), 0) = 0
     and coalesce(array_length(p_documentos, 1), 0) = 0 then
    raise exception 'La planilla no trae identificadores: no se reconcilia a ciegas.';
  end if;

  select coalesce(array_agg(app.hash_cedula(d)), '{}')
    into v_hashes
    from unnest(coalesce(p_documentos, '{}')) d
   where upper(regexp_replace(d, '[^0-9A-Za-z]', '', 'g')) <> '';

  select count(*) into v_total from public.padron where periodo = p_periodo;

  create temporary table sobrantes on commit drop as
  select id, nombre, matricula, cedula_mascara
    from public.padron p
   where p.periodo = p_periodo
     and not (p.matricula   is not null and p.matricula   = any (p_matriculas))
     and not (p.cedula_hash is not null and p.cedula_hash = any (v_hashes));

  select count(*) into v_sobran from sobrantes;

  -- Si sobra más de la mitad, algo está mal: la planilla o el período.
  if v_total > 0 and v_sobran::numeric / v_total > 0.5 then
    raise exception 'Sobran % de % filas del período %: más de la mitad. '
                    'Revise que la planilla y el período sean los correctos.',
                    v_sobran, v_total, p_periodo;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', nombre, 'matricula', matricula, 'documento', cedula_mascara)
           order by nombre), '[]'::jsonb)
    into v_nombres from sobrantes;

  if p_dry_run then
    return jsonb_build_object('simulacion', true, 'periodo', p_periodo,
      'total', v_total, 'sobrantes', v_sobran, 'detalle', v_nombres);
  end if;

  delete from public.padron where id in (select id from sobrantes);

  perform public.auditar('padron_reconciliado', 'padron', null,
    'Se dejó el período conforme a la planilla vigente.',
    jsonb_build_object('periodo', p_periodo, 'total_previo', v_total,
                       'eliminadas', v_sobran, 'detalle', v_nombres));

  return jsonb_build_object('simulacion', false, 'periodo', p_periodo,
    'total', v_total, 'eliminadas', v_sobran, 'detalle', v_nombres);
end $$;

revoke execute on function padron_reconciliar(text, text[], text[], boolean) from public, anon;
grant execute on function padron_reconciliar(text, text[], text[], boolean) to authenticated;;
