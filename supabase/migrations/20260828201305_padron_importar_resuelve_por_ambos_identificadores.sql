-- El padrón tiene dos índices únicos por período: uno por documento y otro por
-- matrícula. La importación resolvía el conflicto por uno solo, así que al
-- cargar la nómina de alumnos de un período donde ya había egresados cargados
-- por matrícula y sin documento, la fila chocaba contra el índice de matrícula
-- y la carga entera se caía.
--
-- Ahora se busca la fila existente por cualquiera de los dos identificadores y
-- se actualiza; si no hay ninguna, se inserta. Además:
--   · la condición «egresado» no se pisa con «estudiante»: quien figura en la
--     nómina del período en que se recibió es las dos cosas, y el egreso es el
--     dato que sostiene la convalidación de pasantía y la acreditación de horas;
--   · si la fila venía sin documento y ahora llega uno, se completa, salvo que
--     otra fila del mismo período ya lo tenga.
create or replace function padron_importar(
  p_periodo text, p_condicion condicion_academica, p_filas jsonb)
returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  f jsonb; v_doc text; v_hash text; v_mat text;
  v_id uuid; v_cond public.condicion_academica; v_hash_ex text;
  v_n int := 0; v_omitidas int := 0; v_extranjeros int := 0; v_sin_doc int := 0;
  v_fusionadas int := 0; v_doc_completado int := 0;
begin
  if not app.es('admin', 'secretaria') then
    raise exception 'Su rol no importa el padrón académico.';
  end if;
  if not exists (select 1 from public.periodos_academicos where codigo = p_periodo) then
    raise exception 'El período % no existe. Créelo primero.', p_periodo;
  end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    v_doc := upper(regexp_replace(coalesce(f->>'cedula', ''), '[^0-9A-Za-z]', '', 'g'));
    v_mat := nullif(btrim(coalesce(f->>'matricula', '')), '');

    if coalesce(btrim(f->>'nombre'), '') = '' or (v_doc = '' and v_mat is null) then
      v_omitidas := v_omitidas + 1;
      continue;
    end if;

    if v_doc = '' then
      v_hash := null;
      v_sin_doc := v_sin_doc + 1;
    else
      if v_doc ~ '[A-Z]' then v_extranjeros := v_extranjeros + 1; end if;
      v_hash := app.hash_cedula(v_doc);
    end if;

    -- Fila existente del período, por documento o por matrícula.
    -- El documento manda: es el identificador más fuerte.
    select p.id, p.condicion, p.cedula_hash
      into v_id, v_cond, v_hash_ex
      from public.padron p
     where p.periodo = p_periodo
       and ((v_hash is not null and p.cedula_hash = v_hash)
         or (v_mat  is not null and p.matricula   = v_mat))
     order by (v_hash is not null and p.cedula_hash = v_hash) desc
     limit 1;

    if v_id is null then
      insert into public.padron (
        periodo, condicion, nombre, cedula_hash, cedula_cif, cedula_mascara,
        tipo_documento, matricula, carrera, ciclo, cargado_por)
      values (
        p_periodo, p_condicion, btrim(f->>'nombre'),
        v_hash,
        case when v_doc <> '' then app.cifrar(v_doc) end,
        case when v_doc <> '' then app.mascara_cedula(v_doc) end,
        nullif(btrim(coalesce(f->>'tipo_documento', '')), ''),
        v_mat,
        nullif(btrim(coalesce(f->>'carrera', '')), ''),
        nullif(btrim(coalesce(f->>'ciclo', '')), ''),
        auth.uid());
    else
      update public.padron set
        nombre    = btrim(f->>'nombre'),
        -- No se degrada a quien ya consta como egresado del período.
        condicion = case when v_cond = 'egresado' then 'egresado' else p_condicion end,
        matricula = coalesce(matricula, v_mat),
        carrera   = coalesce(nullif(btrim(coalesce(f->>'carrera', '')), ''), carrera),
        ciclo     = coalesce(nullif(btrim(coalesce(f->>'ciclo', '')), ''), ciclo),
        tipo_documento = coalesce(nullif(btrim(coalesce(f->>'tipo_documento', '')), ''),
                                  tipo_documento)
       where id = v_id;

      -- Completa el documento si la fila no lo tenía y nadie más del período lo usa.
      if v_hash_ex is null and v_hash is not null
         and not exists (select 1 from public.padron q
                          where q.periodo = p_periodo and q.cedula_hash = v_hash) then
        update public.padron
           set cedula_hash    = v_hash,
               cedula_cif     = app.cifrar(v_doc),
               cedula_mascara = app.mascara_cedula(v_doc)
         where id = v_id;
        v_doc_completado := v_doc_completado + 1;
      end if;

      v_fusionadas := v_fusionadas + 1;
    end if;

    v_n := v_n + 1;
  end loop;

  perform public.auditar('padron_importado', 'padron', null, null,
    jsonb_build_object('periodo', p_periodo, 'condicion', p_condicion,
                       'procesadas', v_n, 'omitidas', v_omitidas,
                       'documentos_no_paraguayos', v_extranjeros,
                       'solo_matricula', v_sin_doc,
                       'filas_actualizadas', v_fusionadas,
                       'documentos_completados', v_doc_completado));

  return jsonb_build_object('ok', true, 'periodo', p_periodo, 'condicion', p_condicion,
    'procesadas', v_n, 'omitidas', v_omitidas, 'documentos_no_paraguayos', v_extranjeros,
    'solo_matricula', v_sin_doc, 'filas_actualizadas', v_fusionadas,
    'documentos_completados', v_doc_completado,
    'total_periodo', (select count(*) from public.padron where periodo = p_periodo));
end $$;;
