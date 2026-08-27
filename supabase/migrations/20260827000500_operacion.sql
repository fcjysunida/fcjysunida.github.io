-- Operación del panel y de la línea de comandos.

-- ── Crear actividad con sus jornadas y códigos ─────────────────────────────────
create or replace function public.crear_actividad(
  p_titulo text, p_tipo public.tipo_actividad, p_modalidad public.modalidad_actividad,
  p_inicio date, p_dias smallint, p_cupo integer, p_lugar text, p_descripcion text,
  p_portada text, p_portada_credito text, p_campos jsonb,
  p_horas numeric default 0, p_docente uuid default null,
  p_estado public.estado_actividad default 'publicada')
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid; v_tf text; v_ta text; i int;
begin
  if not app.es('admin','coordinacion') then
    raise exception 'Su rol no crea actividades.';
  end if;
  v_tf := app.nuevo_token();
  v_ta := app.nuevo_token();
  insert into public.actividades (
    titulo, tipo, descripcion, modalidad, fecha_inicio, dias, cupo, lugar,
    portada, portada_credito, horas_academicas, estado, token_formulario,
    token_asistencia, campos, consentimiento_version_id, docente_responsable, creado_por)
  values (
    p_titulo, p_tipo, p_descripcion, p_modalidad, p_inicio, p_dias, p_cupo, p_lugar,
    p_portada, p_portada_credito, p_horas, p_estado, v_tf, v_ta,
    coalesce(p_campos, '[]'::jsonb),
    ((public.consentimiento_vigente())->>'id')::uuid,
    p_docente, auth.uid())
  returning id into v_id;

  for i in 1..p_dias loop
    insert into public.jornadas (actividad_id, numero, fecha, codigo_sala)
    values (v_id, i, p_inicio + (i - 1), app.nuevo_codigo());
  end loop;

  perform public.auditar('alta_actividad', 'actividades', v_id, null,
                         jsonb_build_object('titulo', p_titulo, 'tipo', p_tipo));
  return public.enlaces_de(v_id);
end $$;
grant execute on function public.crear_actividad(
  text, public.tipo_actividad, public.modalidad_actividad, date, smallint, integer,
  text, text, text, text, jsonb, numeric, uuid, public.estado_actividad) to authenticated;

-- ── Enlaces y códigos de una actividad ─────────────────────────────────────────
create or replace function public.enlaces_de(p_actividad uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id, 'titulo', a.titulo,
    'token_formulario', a.token_formulario,
    'token_asistencia', a.token_asistencia,
    'jornadas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'numero', j.numero, 'fecha', j.fecha, 'codigo', j.codigo_sala,
               'presentes', (select count(*) from public.asistencias s where s.jornada_id = j.id))
             order by j.numero)
        from public.jornadas j where j.actividad_id = a.id), '[]'::jsonb))
  from public.actividades a
  where a.id = p_actividad
    and (app.es('admin','coordinacion','secretaria','auditor')
         or a.docente_responsable = auth.uid())
$$;
grant execute on function public.enlaces_de(uuid) to authenticated;

-- ── Regeneración de enlace y de códigos ────────────────────────────────────────
create or replace function public.regenerar_enlace(p_actividad uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not app.es('admin','coordinacion') then
    raise exception 'Su rol no regenera enlaces.';
  end if;
  update public.actividades set token_asistencia = app.nuevo_token()
   where id = p_actividad;
  update public.jornadas set codigo_sala = app.nuevo_codigo()
   where actividad_id = p_actividad;
  perform public.auditar('regenerar_enlace', 'actividades', p_actividad, null,
    jsonb_build_object('efecto', 'el enlace anterior queda invalidado y rotan todos los códigos'));
  return public.enlaces_de(p_actividad);
end $$;
grant execute on function public.regenerar_enlace(uuid) to authenticated;

create or replace function public.regenerar_codigo(p_actividad uuid, p_jornada smallint)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not (app.es('admin','coordinacion') or exists (
        select 1 from public.actividades a
         where a.id = p_actividad and a.docente_responsable = auth.uid())) then
    raise exception 'Su rol no regenera códigos de esta actividad.';
  end if;
  update public.jornadas set codigo_sala = app.nuevo_codigo()
   where actividad_id = p_actividad and numero = p_jornada;
  perform public.auditar('regenerar_codigo', 'actividades', p_actividad, null,
                         jsonb_build_object('jornada', p_jornada));
  return public.enlaces_de(p_actividad);
end $$;
grant execute on function public.regenerar_codigo(uuid, smallint) to authenticated;

-- ── Exportación auditada ───────────────────────────────────────────────────────
-- La cédula nace fuera de la exportación (privacidad por defecto). Solo la
-- Dirección puede pedirla, declarando el motivo.
create or replace function public.exportar_inscripciones(
  p_actividad uuid, p_motivo text, p_incluir_cedula boolean default false)
returns table (
  nombre text, cedula text, correo text, condicion text, institucion text,
  carrera text, ciudad text, modalidad text, certificado text, estado text,
  jornadas_asistidas bigint, inscripto_en timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.es('admin','coordinacion','secretaria') then
    raise exception 'Su rol no exporta inscripciones.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'La exportación exige declarar un motivo: queda en auditoría.';
  end if;
  if p_incluir_cedula and not app.es('admin') then
    raise exception 'Solo la Dirección exporta la cédula completa.';
  end if;

  perform public.auditar('exportacion', 'actividades', p_actividad, p_motivo,
    jsonb_build_object('incluye_cedula', p_incluir_cedula));

  return query
  select i.nombre,
         case when p_incluir_cedula then app.descifrar(i.cedula_cif)
              else i.cedula_mascara end,
         i.email::text,
         i.condicion::text,
         i.institucion,
         i.carrera,
         i.ciudad,
         i.modalidad,
         case when i.requiere_certificado then 'Sí' else 'No' end,
         i.estado::text,
         (select count(*) from public.asistencias s where s.inscripcion_id = i.id),
         i.creado_en
    from public.inscripciones i
   where i.actividad_id = p_actividad
   order by i.nombre;
end $$;
grant execute on function public.exportar_inscripciones(uuid, text, boolean) to authenticated;

-- ── Retención (art. 4.° inc. e y art. 31) ──────────────────────────────────────
-- Vencido el plazo: los datos identificables se anonimizan y los sensibles se
-- eliminan. Sobrevive solo el agregado que alimenta el informe de extensión.
create or replace function public.aplicar_retencion(
  p_meses int default 24, p_simulacion boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_ids uuid[]; v_n int;
begin
  -- Sin `auth.uid() is not null`: para un visitante anónimo esa condición era
  -- falsa y lo dejaba pasar. La tarea programada corre como service_role, que
  -- no atraviesa estos permisos.
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
grant execute on function public.aplicar_retencion(int, boolean) to authenticated;

-- ── Cierre de actividad ────────────────────────────────────────────────────────
create or replace function public.cerrar_actividad(p_actividad uuid, p_finalizada boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not app.es('admin','coordinacion') then
    raise exception 'Su rol no cierra actividades.';
  end if;
  update public.actividades
     set estado = case when p_finalizada then 'finalizada'::public.estado_actividad
                       else 'cerrada'::public.estado_actividad end,
         cerrada_en = coalesce(cerrada_en, now())
   where id = p_actividad;
  perform public.auditar('cierre_actividad', 'actividades', p_actividad, null,
                         jsonb_build_object('finalizada', p_finalizada));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.cerrar_actividad(uuid, boolean) to authenticated;
