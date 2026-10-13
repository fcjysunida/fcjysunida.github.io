-- Convalidación de la pasantía para todos los egresados sin registro (art. 35
-- del Reglamento de Práctica y Pasantía). El título acredita el cumplimiento;
-- se deja un registro individual por persona con su fundamento, en lugar de
-- darla por cumplida en silencio.
with pendientes as (
  select pp.cedula_hash, pp.matricula, pp.nombre, pp.carrera, pp.periodo, pp.cohorte
    from pasantias_personas pp
   where pp.condicion = 'egresado'
     and not pp.cumple
),
insertadas as (
  insert into pasantias (
    cedula_hash, matricula, nombre, carrera, periodo,
    modalidad, estado, horas, motivo, certificacion, convalidacion_resuelta_en)
  select cedula_hash, matricula, nombre, carrera, periodo,
         'convalidacion', 'convalidada',
         app.parametro('pasantia_horas_meta', 264),
         'Convalidación por egreso (art. 35 del Reglamento de Práctica y Pasantía): el '
         'título acredita el cumplimiento del requisito, anterior a esta plataforma.',
         'Título de grado otorgado por la UNIDA. Cohorte de ingreso ' ||
           coalesce(cohorte, 'sin determinar') || '.',
         current_date
    from pendientes
  returning matricula
)
insert into auditoria (accion, entidad, motivo, detalle)
select 'pasantias_convalidadas_por_egreso', 'pasantias',
       'Convalidación por egreso de todos los egresados sin registro, a pedido de la Dirección.',
       jsonb_build_object(
         'personas', count(*),
         'horas_por_persona', app.parametro('pasantia_horas_meta', 264),
         'cohortes', (select array_agg(distinct left(matricula, 4) order by left(matricula, 4))
                        from insertadas),
         'via', 'migración convalidar_pasantia_de_los_egresados')
  from insertadas;;
