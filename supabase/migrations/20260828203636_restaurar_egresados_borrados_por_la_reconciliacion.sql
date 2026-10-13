-- La reconciliación borró tres filas de egresado. Las planillas del sistema
-- académico traen solo alumnos matriculados, y `padron_reconciliar` comparaba
-- contra todo el período: los egresados que no seguían cursando quedaban fuera
-- de la planilla y se eliminaban. Se restauran desde el asiento de auditoría
-- —que guarda nombre, matrícula y máscara— y desde los registros de pasantía,
-- que conservan el cedula_hash. El documento cifrado se copia de la fila de
-- alumno de la misma persona, que sobrevivió en otro período.
with borrados as (
  select distinct
         a.detalle->>'periodo' as periodo,
         d->>'matricula'       as matricula,
         d->>'nombre'          as nombre,
         d->>'documento'       as mascara
    from auditoria a, jsonb_array_elements(a.detalle->'detalle') d
   where a.accion = 'padron_reconciliado'
),
egresados as (
  -- Solo los que tienen una convalidación de pasantía: son los que constaban
  -- como egresados. Los alumnos borrados de 2025-1 no se restauran, que es
  -- justamente lo que se pidió.
  select b.periodo, b.matricula, b.nombre, b.mascara,
         p.carrera, p.cedula_hash,
         (select q.cedula_cif from padron q
           where q.cedula_hash = p.cedula_hash and q.cedula_cif is not null
           limit 1) as cedula_cif,
         (select q.tipo_documento from padron q
           where q.cedula_hash = p.cedula_hash and q.tipo_documento is not null
           limit 1) as tipo_documento
    from borrados b
    join pasantias p
      on p.matricula = b.matricula and p.modalidad = 'convalidacion'
   where not exists (select 1 from padron x
                      where x.periodo = b.periodo and x.matricula = b.matricula)
),
repuestas as (
  insert into padron (periodo, condicion, nombre, cedula_hash, cedula_cif,
                      cedula_mascara, tipo_documento, matricula, carrera)
  select periodo, 'egresado', nombre, cedula_hash, cedula_cif,
         mascara, tipo_documento, matricula, carrera
    from egresados
  returning periodo, matricula
)
insert into auditoria (accion, entidad, motivo, detalle)
select 'padron_egresados_restaurados', 'padron',
       'Restauración de filas de egresado que la reconciliación eliminó por no figurar '
       'en la planilla de alumnos matriculados.',
       jsonb_build_object('repuestas', count(*),
                          'periodos', array_agg(distinct periodo),
                          'via', 'migración restaurar_egresados_borrados_por_la_reconciliacion')
  from repuestas;;
