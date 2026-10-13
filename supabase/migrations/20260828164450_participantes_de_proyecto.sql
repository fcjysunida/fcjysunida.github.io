-- Participación en proyectos de extensión.
--
-- Tres caminos, según cómo se documentó la actividad:
--   1. Se inscribieron por el formulario y asistieron → se traen de la actividad
--      vinculada, con su condición ya verificada.
--   2. Es un proyecto retrospectivo → se busca a la persona en el padrón y se la
--      agrega. La condición se verifica contra el padrón DEL PERÍODO DEL
--      PROYECTO, no contra el de hoy: alguien que en 2022 era estudiante y hoy
--      es egresado debe figurar como estudiante en el informe de 2022.
--   3. Son personas externas sin registro académico → se cargan por nómina.

alter table public.proyecto_participantes
  add column condicion           public.condicion_participante,
  add column condicion_origen    text,
  add column periodo_verificado  text,
  add column inscripcion_id      uuid references public.inscripciones(id) on delete set null,
  add column asistio             boolean not null default false,
  add column jornadas            smallint not null default 0,
  add column fuente              text not null default 'manual';

comment on column public.proyecto_participantes.condicion is
  'Condición verificada contra el padrón del período del proyecto. Es la que va al informe.';
comment on column public.proyecto_participantes.fuente is
  'formulario (se inscribió), padron (agregado desde el registro académico), nomina (carga masiva), manual.';

create index proyparti_condicion_idx on public.proyecto_participantes (proyecto_id, condicion);

-- ── Condición en un período determinado ────────────────────────────────────────
-- Si el proyecto tiene fecha, se usa su período. Si solo tiene año, se miran los
-- dos semestres de ese año. Nunca se mira más adelante del proyecto: la
-- condición del informe es la que la persona tenía entonces.
create or replace function app.condicion_en_periodo(
  p_hash text, p_matricula text, p_fecha date, p_anio smallint,
  p_declarada public.condicion_participante default 'externo')
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_periodos text[];
  v_anio smallint;
  v_fila public.padron%rowtype;
  v_mats text[];
begin
  v_anio := coalesce(p_anio, extract(year from p_fecha)::smallint);
  if p_fecha is not null and app.periodo_de(p_fecha) is not null then
    v_periodos := array[app.periodo_de(p_fecha)];
  elsif v_anio is not null then
    v_periodos := array[v_anio || '-1', v_anio || '-2'];
  else
    v_periodos := '{}';
  end if;

  -- Matrículas conocidas de la persona, por documento o por la que se declaró.
  select coalesce(array_agg(distinct matricula), '{}') into v_mats
    from public.padron
   where matricula is not null
     and (cedula_hash = p_hash or matricula = p_matricula);
  if p_matricula is not null then v_mats := v_mats || p_matricula; end if;

  -- 1. Estudiante en el período del proyecto.
  select * into v_fila from public.padron
   where condicion = 'estudiante'
     and periodo = any(v_periodos)
     and (cedula_hash = p_hash or (matricula is not null and matricula = any(v_mats)))
   order by periodo desc limit 1;
  if found then
    return jsonb_build_object('condicion','estudiante','matricula',v_fila.matricula,
      'carrera',v_fila.carrera,'ciclo',v_fila.ciclo,'periodo',v_fila.periodo,
      'origen','padrón: matriculado en ' || v_fila.periodo);
  end if;

  -- 2. Ya era egresado a esa altura.
  select * into v_fila from public.padron
   where condicion = 'egresado'
     and (v_anio is null or split_part(periodo,'-',1)::smallint <= v_anio)
     and (cedula_hash = p_hash or (matricula is not null and matricula = any(v_mats)))
   order by periodo desc limit 1;
  if found then
    return jsonb_build_object('condicion','egresado','matricula',v_fila.matricula,
      'carrera',v_fila.carrera,'ciclo',null,'periodo',v_fila.periodo,
      'origen','padrón: egresado en ' || v_fila.periodo);
  end if;

  -- 3. Estudiante en otro período: participó siendo alumno, pero no de ese período.
  select * into v_fila from public.padron
   where condicion = 'estudiante'
     and (cedula_hash = p_hash or (matricula is not null and matricula = any(v_mats)))
   order by periodo desc limit 1;
  if found then
    return jsonb_build_object('condicion','estudiante','matricula',v_fila.matricula,
      'carrera',v_fila.carrera,'ciclo',v_fila.ciclo,'periodo',v_fila.periodo,
      'origen','padrón: matriculado en ' || v_fila.periodo ||
               ', no en el período del proyecto');
  end if;

  -- 4. No figura: queda lo declarado.
  return jsonb_build_object('condicion', p_declarada, 'matricula', p_matricula,
    'carrera', null, 'ciclo', null, 'periodo', null,
    'origen','sin registro en el padrón: ' || p_declarada);
end $$;

-- ── Búsqueda en el padrón, para agregar a mano ─────────────────────────────────
create or replace function public.padron_buscar(p_texto text, p_limite int default 25)
returns table (nombre text, matricula text, carrera text, ciclo text,
               periodo text, condicion public.condicion_academica,
               cedula_mascara text, cedula_hash text)
language sql stable security definer set search_path = '' as $$
  select d.nombre, d.matricula, d.carrera, d.ciclo, d.periodo, d.condicion,
         d.cedula_mascara, d.cedula_hash
    from public.padron d
   where app.es('admin','coordinacion','secretaria')
     and length(btrim(coalesce(p_texto,''))) >= 3
     and (d.nombre ilike '%' || btrim(p_texto) || '%'
          or d.matricula ilike btrim(p_texto) || '%')
   order by d.nombre, d.periodo desc
   limit greatest(1, least(p_limite, 100))
$$;
revoke execute on function public.padron_buscar(text, int) from public, anon;
grant  execute on function public.padron_buscar(text, int) to authenticated;;
