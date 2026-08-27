-- Evaluación de satisfacción de la actividad.
-- Instrumento alineado a la ISO 10004:2018 (seguimiento y medición de la
-- satisfacción) y al requisito 9.1.2 de la ISO 9001:2015: escala Likert de
-- cinco puntos por dimensión, CSAT de dos cajas superiores y NPS.
-- Se responde una sola vez por persona y actividad, desde el mismo enlace de
-- asistencia, después de registrar la presencia.

create table public.evaluaciones (
  id             uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null unique references public.inscripciones(id) on delete cascade,
  actividad_id   uuid not null references public.actividades(id) on delete cascade,
  contenido      smallint not null check (contenido     between 1 and 5),
  expositor      smallint not null check (expositor     between 1 and 5),
  organizacion   smallint not null check (organizacion  between 1 and 5),
  recursos       smallint not null check (recursos      between 1 and 5),
  aplicabilidad  smallint not null check (aplicabilidad between 1 and 5),
  global         smallint not null check (global        between 1 and 5),
  recomendacion  smallint not null check (recomendacion between 0 and 10),
  comentario     text,
  registrado_en  timestamptz not null default now()
);
create index evaluaciones_actividad_idx on public.evaluaciones (actividad_id);
alter table public.evaluaciones enable row level security;

-- Nadie lee la tabla fila por fila desde el cliente: el panel consulta los
-- agregados y los comentarios sin identidad. Minimización, art. 4.° inc. d).
create policy eval_lectura_agregada on public.evaluaciones for select to authenticated
  using (app.es('admin','coordinacion'));

create or replace function public.evaluar_actividad(
  p_token text, p_cedula text, p_respuestas jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.actividades%rowtype; v_hash text; v_insc uuid;
  v_n smallint; v_clave text;
begin
  select * into a from public.actividades where token_asistencia = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'El enlace no es válido o fue regenerado.');
  end if;

  v_hash := app.hash_cedula(p_cedula);
  if not app.limite('eval:' || a.id::text || ':' || v_hash, 5, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'error', 'Demasiados intentos. Aguarde diez minutos.');
  end if;

  select i.id into v_insc from public.inscripciones i
   where i.actividad_id = a.id and i.cedula_hash = v_hash and i.estado <> 'anulada';
  if v_insc is null then
    return jsonb_build_object('ok', false, 'error',
      'Esa cédula no figura entre las inscripciones confirmadas.');
  end if;

  -- Solo evalúa quien asistió: la encuesta mide una experiencia, no una intención.
  if not exists (select 1 from public.asistencias s
                   join public.jornadas j on j.id = s.jornada_id
                  where s.inscripcion_id = v_insc and j.actividad_id = a.id) then
    return jsonb_build_object('ok', false, 'error',
      'La evaluación se habilita después de registrar al menos una asistencia.');
  end if;

  if exists (select 1 from public.evaluaciones e where e.inscripcion_id = v_insc) then
    return jsonb_build_object('ok', false, 'error', 'Ya registramos su evaluación. Gracias.');
  end if;

  foreach v_clave in array array['contenido','expositor','organizacion','recursos','aplicabilidad','global'] loop
    v_n := (p_respuestas->>v_clave)::smallint;
    if v_n is null or v_n < 1 or v_n > 5 then
      return jsonb_build_object('ok', false, 'error',
        'Complete las seis valoraciones de uno a cinco.');
    end if;
  end loop;
  if (p_respuestas->>'recomendacion')::smallint is null then
    return jsonb_build_object('ok', false, 'error',
      'Indique del cero al diez qué tan probable es que recomiende la actividad.');
  end if;

  insert into public.evaluaciones (
    inscripcion_id, actividad_id, contenido, expositor, organizacion,
    recursos, aplicabilidad, global, recomendacion, comentario)
  values (
    v_insc, a.id,
    (p_respuestas->>'contenido')::smallint,
    (p_respuestas->>'expositor')::smallint,
    (p_respuestas->>'organizacion')::smallint,
    (p_respuestas->>'recursos')::smallint,
    (p_respuestas->>'aplicabilidad')::smallint,
    (p_respuestas->>'global')::smallint,
    (p_respuestas->>'recomendacion')::smallint,
    nullif(btrim(coalesce(p_respuestas->>'comentario','')), ''));

  insert into public.auditoria (accion, entidad, entidad_id, detalle)
  values ('alta_evaluacion', 'evaluaciones', v_insc, jsonb_build_object('actividad', a.id));

  return jsonb_build_object('ok', true,
    'mensaje', 'Gracias. Su evaluación quedó registrada de manera anónima en los informes.');
end $$;

create or replace function public.evaluacion_pendiente(p_token text, p_cedula text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a public.actividades%rowtype; v_hash text; v_insc uuid; v_asistio boolean;
begin
  select * into a from public.actividades where token_asistencia = p_token;
  if not found then return jsonb_build_object('pendiente', false); end if;
  v_hash := app.hash_cedula(p_cedula);
  select i.id into v_insc from public.inscripciones i
   where i.actividad_id = a.id and i.cedula_hash = v_hash and i.estado <> 'anulada';
  if v_insc is null then return jsonb_build_object('pendiente', false); end if;
  select exists (select 1 from public.asistencias s
                   join public.jornadas j on j.id = s.jornada_id
                  where s.inscripcion_id = v_insc and j.actividad_id = a.id) into v_asistio;
  return jsonb_build_object(
    'pendiente', v_asistio and not exists (
      select 1 from public.evaluaciones e where e.inscripcion_id = v_insc),
    'ultima_jornada', app.hoy() >= (a.fecha_inicio + (a.dias - 1)));
end $$;

-- ── Agregados para el panel: sin identidad, solo indicadores ───────────────────
create or replace function public.satisfaccion_de(p_actividad uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'respuestas',    count(*),
    'contenido',     round(avg(contenido)::numeric, 2),
    'expositor',     round(avg(expositor)::numeric, 2),
    'organizacion',  round(avg(organizacion)::numeric, 2),
    'recursos',      round(avg(recursos)::numeric, 2),
    'aplicabilidad', round(avg(aplicabilidad)::numeric, 2),
    'promedio',      round(avg((contenido + expositor + organizacion
                              + recursos + aplicabilidad + global) / 6.0)::numeric, 2),
    'csat',          case when count(*) = 0 then 0
                     else round(100.0 * count(*) filter (where global >= 4) / count(*)) end,
    'nps',           case when count(*) = 0 then 0
                     else round(100.0 * (count(*) filter (where recomendacion >= 9)
                                       - count(*) filter (where recomendacion <= 6)) / count(*)) end,
    'promotores',    count(*) filter (where recomendacion >= 9),
    'pasivos',       count(*) filter (where recomendacion between 7 and 8),
    'detractores',   count(*) filter (where recomendacion <= 6))
  from public.evaluaciones e
  where e.actividad_id = p_actividad
    and (app.es('admin','coordinacion','secretaria','auditor')
         or exists (select 1 from public.actividades a
                     where a.id = p_actividad and a.docente_responsable = auth.uid()))
$$;

-- Comentarios sin identidad ni orden cronológico: insumo de mejora, no trazas.
create or replace function public.comentarios_de(p_actividad uuid)
returns table (comentario text)
language sql stable security definer set search_path = '' as $$
  select e.comentario from public.evaluaciones e
   where e.actividad_id = p_actividad and e.comentario is not null
     and (app.es('admin','coordinacion')
          or exists (select 1 from public.actividades a
                      where a.id = p_actividad and a.docente_responsable = auth.uid()))
   order by md5(e.id::text)
$$;
