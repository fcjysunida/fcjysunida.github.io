-- Estado de la pasantía de cada persona del padrón, con la nota ponderada del
-- art. 28 y el control de los plazos de los arts. 15, 16 y 27.
create or replace view pasantias_detalle with (security_invoker = true) as
select p.*,
       round(coalesce(p.nota_empresa, 0)     * app.parametro('pasantia_peso_empresa', 40) / 100.0
           + coalesce(p.nota_universidad, 0) * app.parametro('pasantia_peso_universidad', 60) / 100.0, 2)
         as nota_final,
       (p.nota_empresa is not null and p.nota_universidad is not null
        and round(p.nota_empresa     * app.parametro('pasantia_peso_empresa', 40) / 100.0
                + p.nota_universidad * app.parametro('pasantia_peso_universidad', 60) / 100.0, 2)
            >= app.parametro('pasantia_nota_minima', 70)) as nota_suficiente,
       (p.horas >= app.parametro('pasantia_horas_meta', 264))       as horas_suficientes,
       greatest(0, app.parametro('pasantia_horas_meta', 264) - p.horas) as horas_faltantes,
       -- art. 15: ocho días hábiles desde el fin de la pasantía.
       app.dias_habiles(p.fecha_fin, p.informe_presentado_en)        as dias_hasta_informe,
       (p.informe_presentado_en is not null and p.fecha_fin is not null
        and app.dias_habiles(p.fecha_fin, p.informe_presentado_en) > 8) as informe_fuera_de_plazo,
       -- art. 16: ocho días para subsanar lo observado.
       (p.informe_observado_en is not null and p.informe_subsanado_en is null
        and app.dias_habiles(p.informe_observado_en, current_date) > 8) as subsanacion_vencida,
       -- art. 27: treinta días hábiles para el informe de conformidad.
       app.dias_habiles(p.fecha_fin, coalesce(p.conformidad_en, current_date)) as dias_hasta_conformidad,
       (p.conformidad_en is null and p.fecha_fin is not null
        and app.dias_habiles(p.fecha_fin, current_date) > 30)        as conformidad_vencida,
       -- art. 7 inc. b: obligatoria desde el sexto semestre.
       (p.semestre is not null and p.semestre < app.parametro('pasantia_semestre_minimo', 6)::int)
         as semestre_insuficiente,
       (p.estado in ('aprobada', 'convalidada'))                     as cumple
  from pasantias p;

revoke all on pasantias_detalle from public, anon;
grant select on pasantias_detalle to authenticated;

-- Una fila por persona del padrón: si tiene pasantía, cuál es su estado; si no
-- la tiene, queda a la vista como pendiente. Se toma la pasantía más avanzada.
create or replace view pasantias_personas with (security_invoker = true) as
with gente as (
  select distinct on (coalesce(pa.cedula_hash, 'm:' || pa.matricula))
         coalesce(pa.cedula_hash, 'm:' || pa.matricula) as clave,
         pa.cedula_hash, pa.matricula, pa.nombre, pa.carrera,
         pa.cedula_mascara, pa.condicion, pa.periodo
    from padron pa
   order by coalesce(pa.cedula_hash, 'm:' || pa.matricula),
            (pa.condicion = 'egresado') desc, pa.periodo desc
),
mejor as (
  select distinct on (coalesce(d.cedula_hash, 'm:' || d.matricula))
         coalesce(d.cedula_hash, 'm:' || d.matricula) as clave, d.*
    from pasantias_detalle d
   order by coalesce(d.cedula_hash, 'm:' || d.matricula),
            (d.estado in ('aprobada', 'convalidada')) desc,
            d.horas desc, d.creado_en desc
)
select g.clave, g.cedula_hash, g.matricula, g.nombre, g.carrera,
       g.cedula_mascara, g.condicion, g.periodo,
       nullif(left(g.matricula, 4), '') as cohorte,
       m.id            as pasantia_id,
       m.modalidad,
       m.estado,
       m.organizacion,
       m.con_convenio,
       coalesce(m.horas, 0)                                        as horas,
       coalesce(m.horas_faltantes, app.parametro('pasantia_horas_meta', 264)) as horas_faltantes,
       m.nota_final,
       coalesce(m.nota_suficiente, false)   as nota_suficiente,
       coalesce(m.horas_suficientes, false) as horas_suficientes,
       coalesce(m.ficha_recibida, false)    as ficha_recibida,
       m.informe_presentado_en,
       coalesce(m.informe_fuera_de_plazo, false) as informe_fuera_de_plazo,
       coalesce(m.subsanacion_vencida, false)    as subsanacion_vencida,
       coalesce(m.conformidad_vencida, false)    as conformidad_vencida,
       m.conformidad_en,
       coalesce(m.cumple, false)            as cumple
  from gente g
  left join mejor m on m.clave = g.clave;

revoke all on pasantias_personas from public, anon;
grant select on pasantias_personas to authenticated;;
