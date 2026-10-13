-- Acreditación por egreso para todas las cohortes, no solo 2020 y 2021.
-- Mismo fundamento: el título prueba que el requisito de Extensión
-- Universitaria se cumplió, y es anterior a esta plataforma.
with pendientes as (
  select e.cedula_hash, e.matricula, e.nombre, e.periodo, e.cohorte,
         (app.meta_horas_extension() - e.horas_total) as faltan
    from extension_personas e
   where e.condicion = 'egresado'
     and e.horas_total < app.meta_horas_extension()
),
insertadas as (
  insert into horas_extension (
    cedula_hash, matricula, nombre, periodo, horas, origen, motivo, detalle)
  select cedula_hash, matricula, nombre, periodo, faltan, 'historica',
         'Acreditación por egreso: el título prueba el cumplimiento del requisito de '
         'Extensión Universitaria, cursado antes de que existiera esta plataforma.',
         'Saldo acreditado para alcanzar la meta de ' || app.meta_horas_extension() ||
         ' horas de la carrera. Sin respaldo de asistencia en la plataforma. '
         'Cohorte de ingreso ' || coalesce(cohorte, 'sin determinar') || '.'
    from pendientes
  returning horas, matricula
)
insert into auditoria (accion, entidad, motivo, detalle)
select 'horas_extension_acreditadas_por_egreso', 'padron',
       'Acreditación por egreso extendida a todas las cohortes, a pedido de la Dirección.',
       jsonb_build_object(
         'meta', app.meta_horas_extension(),
         'personas', count(*), 'horas', sum(horas),
         'cohortes', (select array_agg(distinct left(matricula, 4) order by left(matricula, 4))
                        from insertadas),
         'via', 'migración acreditar_horas_a_todos_los_egresados')
  from insertadas;;
