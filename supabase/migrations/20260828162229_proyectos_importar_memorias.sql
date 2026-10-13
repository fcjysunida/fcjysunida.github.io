-- Carga de las memorias históricas. Muchas actividades están documentadas solo
-- con el año, así que `fecha_inicio` queda nula y el año va en su propia
-- columna: poner una fecha inventada distorsionaría los indicadores mensuales.

alter table public.proyectos
  add column anio smallint,
  add column categoria_memoria text,
  add column fuente text;

create index proyectos_anio_idx on public.proyectos (anio);
create unique index proyectos_nombre_anio_idx
  on public.proyectos (lower(btrim(nombre)), anio) where anio is not null;

comment on column public.proyectos.anio is
  'Año de la actividad. Se usa cuando solo se documentó el año y no la fecha exacta.';
comment on column public.proyectos.fuente is
  'De dónde salió el registro: memoria anual, carga manual, formulario.';

-- p_filas: [{"nombre","anio","fecha","descripcion","clasificacion","categoria",
--            "carreras","lider"}]
create or replace function public.proyectos_importar(p_filas jsonb, p_fuente text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  f jsonb; v_fecha date; v_anio smallint; v_id uuid;
  v_alta int := 0; v_act int := 0; v_omitidas int := 0;
begin
  if not app.es('admin','coordinacion') then
    raise exception 'Su rol no importa proyectos.';
  end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    if coalesce(btrim(f->>'nombre'),'') = '' then
      v_omitidas := v_omitidas + 1; continue;
    end if;
    v_anio := nullif(f->>'anio','')::smallint;
    v_fecha := nullif(f->>'fecha','')::date;

    select id into v_id from public.proyectos
     where lower(btrim(nombre)) = lower(btrim(f->>'nombre'))
       and anio is not distinct from v_anio;

    if v_id is null then
      insert into public.proyectos (
        nombre, clasificacion, estado, anio, fecha_inicio, fecha_fin,
        periodo_academico, carreras, lider, categoria_memoria, fuente,
        propuesta, creado_por)
      values (
        btrim(f->>'nombre'),
        coalesce(nullif(f->>'clasificacion','')::public.clasificacion_proyecto,
                 'eventos_academicos'),
        'finalizado', v_anio, v_fecha, v_fecha,
        case when v_fecha is not null then app.periodo_de(v_fecha) else null end,
        nullif(btrim(coalesce(f->>'carreras','')),''),
        nullif(btrim(coalesce(f->>'lider','')),''),
        nullif(btrim(coalesce(f->>'categoria','')),''),
        p_fuente,
        jsonb_build_object('introduccion', f->>'descripcion'),
        auth.uid());
      v_alta := v_alta + 1;
    else
      -- Reimportar una memoria corregida actualiza en vez de duplicar.
      update public.proyectos set
        fecha_inicio = coalesce(v_fecha, fecha_inicio),
        fecha_fin    = coalesce(v_fecha, fecha_fin),
        periodo_academico = coalesce(
          case when v_fecha is not null then app.periodo_de(v_fecha) else null end,
          periodo_academico),
        categoria_memoria = coalesce(nullif(btrim(coalesce(f->>'categoria','')),''),
                                     categoria_memoria),
        propuesta = propuesta || jsonb_build_object('introduccion', f->>'descripcion'),
        actualizado_en = now()
       where id = v_id;
      v_act := v_act + 1;
    end if;
  end loop;

  perform public.auditar('proyectos_importados', 'proyectos', null, null,
    jsonb_build_object('fuente', p_fuente, 'altas', v_alta,
                       'actualizados', v_act, 'omitidas', v_omitidas));

  return jsonb_build_object('ok', true, 'altas', v_alta, 'actualizados', v_act,
    'omitidas', v_omitidas, 'total', (select count(*) from public.proyectos));
end $$;
revoke execute on function public.proyectos_importar(jsonb, text) from public, anon;
grant  execute on function public.proyectos_importar(jsonb, text) to authenticated;

-- La vista expone el año y la procedencia.
drop view public.proyectos_resumen;
create view public.proyectos_resumen
with (security_invoker = on) as
select p.id, p.nombre, p.clasificacion, p.estado, p.periodo_academico, p.carreras,
       p.lider, p.fecha_inicio, p.fecha_fin, p.anio, p.categoria_memoria, p.fuente,
       p.horas_reloj, p.horas_extension,
       p.beneficiarios_directos, p.beneficiarios_indirectos, p.actividad_id,
       p.docente_responsable, p.creado_en,
       to_char(p.fecha_inicio, 'YYYY-MM') as periodo_mes,
       (select count(*) from public.proyecto_participantes pp
         where pp.proyecto_id = p.id and pp.tipo = 'estudiante')  as estudiantes,
       (select count(*) from public.proyecto_participantes pp
         where pp.proyecto_id = p.id and pp.tipo = 'docente')     as docentes,
       (select count(*) from public.proyecto_informes pi
         where pi.proyecto_id = p.id)                             as informes,
       (select max(pi.fecha_informe) from public.proyecto_informes pi
         where pi.proyecto_id = p.id)                             as ultimo_informe
from public.proyectos p;
revoke all on public.proyectos_resumen from anon;;
