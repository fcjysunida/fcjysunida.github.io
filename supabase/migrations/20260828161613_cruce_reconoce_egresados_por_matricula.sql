-- El cruce ahora reconoce al egresado aunque su nómina no traiga cédula: si la
-- persona figura en alguna nómina de alumnos con esa cédula, de ahí sale su
-- matrícula, y con la matrícula se la busca entre los egresados.

create or replace function app.condicion_verificada(
  p_hash text, p_fecha date, p_declarada public.condicion_participante)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_periodo text;
  v_fila public.padron%rowtype;
  v_matriculas text[];
begin
  v_periodo := app.periodo_de(p_fecha);

  -- Todas las matrículas conocidas de esta persona, por su documento.
  select coalesce(array_agg(distinct matricula), '{}') into v_matriculas
    from public.padron
   where cedula_hash = p_hash and matricula is not null;

  -- 1. Estudiante en el período de la actividad.
  if v_periodo is not null then
    select * into v_fila from public.padron
     where cedula_hash = p_hash and periodo = v_periodo and condicion = 'estudiante'
     limit 1;
    if found then
      return jsonb_build_object('condicion','estudiante','matricula',v_fila.matricula,
        'carrera',v_fila.carrera,'ciclo',v_fila.ciclo,'periodo',v_fila.periodo,
        'origen','padrón: estudiante en el período de la actividad');
    end if;
  end if;

  -- 2. Docente declarado.
  if p_declarada = 'docente' then
    select * into v_fila from public.padron
     where cedula_hash = p_hash order by periodo desc limit 1;
    return jsonb_build_object('condicion','docente','matricula',v_fila.matricula,
      'carrera',v_fila.carrera,'ciclo',null,'periodo',v_fila.periodo,
      'origen','declarado docente');
  end if;

  -- 3. Egresado: por documento, o por cualquiera de sus matrículas.
  select * into v_fila from public.padron
   where condicion = 'egresado'
     and (cedula_hash = p_hash
          or (matricula is not null and matricula = any(v_matriculas)))
   order by periodo desc limit 1;
  if found then
    return jsonb_build_object('condicion','egresado','matricula',v_fila.matricula,
      'carrera',v_fila.carrera,'ciclo',v_fila.ciclo,'periodo',v_fila.periodo,
      'origen', case when v_fila.cedula_hash = p_hash
                     then 'padrón: egresado en ' || v_fila.periodo
                     else 'padrón: egresado en ' || v_fila.periodo
                          || ', vinculado por matrícula ' || v_fila.matricula end);
  end if;

  -- 4. Estudiante en otro período.
  select * into v_fila from public.padron
   where cedula_hash = p_hash and condicion = 'estudiante'
   order by periodo desc limit 1;
  if found then
    return jsonb_build_object('condicion','estudiante','matricula',v_fila.matricula,
      'carrera',v_fila.carrera,'ciclo',v_fila.ciclo,'periodo',v_fila.periodo,
      'origen','padrón: estudiante en ' || v_fila.periodo);
  end if;

  -- 5. Sin registro en el padrón.
  return jsonb_build_object('condicion', p_declarada, 'matricula', null,
    'carrera', null, 'ciclo', null, 'periodo', null,
    'origen','declarado por la persona; no figura en el padrón');
end $$;

-- El resumen distingue las filas todavía sin documento.
drop function if exists public.padron_resumen();
create function public.padron_resumen()
returns table (periodo text, desde date, hasta date, estudiantes bigint,
               egresados bigint, doc_extranjero bigint, sin_documento bigint)
language sql stable security definer set search_path = '' as $$
  select p.codigo, p.desde, p.hasta,
         count(*) filter (where d.condicion = 'estudiante'),
         count(*) filter (where d.condicion = 'egresado'),
         count(*) filter (where d.tipo_documento is not null
                            and d.tipo_documento !~* 'c[eé]dula'),
         count(*) filter (where d.id is not null and d.cedula_hash is null)
    from public.periodos_academicos p
    left join public.padron d on d.periodo = p.codigo
   where app.es('admin','coordinacion','secretaria','auditor')
   group by p.codigo, p.desde, p.hasta
   order by p.codigo desc
$$;
revoke execute on function public.padron_resumen() from public, anon;
grant  execute on function public.padron_resumen() to authenticated;;
