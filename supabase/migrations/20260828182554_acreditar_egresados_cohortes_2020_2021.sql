-- Acreditación por egreso de las cohortes 2020 y 2021, resuelta por migración
-- porque no hay sesión de panel en este contexto. Es el mismo efecto que
-- horas_extension_acreditar_egresados(), con la fila de auditoría escrita a mano.
--
-- Se acredita el saldo hasta la meta, imputado al período de egreso, y se deja
-- constancia de que no hay respaldo de asistencia: el fundamento es el título.
-- Deliberadamente NO se los inscribe como participantes de proyectos concretos:
-- eso afirmaría una asistencia que nadie registró y contaminaría los conteos de
-- beneficiarios de esos proyectos.
with pendientes as (
  select e.cedula_hash, e.matricula, e.nombre, e.periodo,
         (app.meta_horas_extension() - e.horas_total) as faltan
    from extension_personas e
   where e.condicion = 'egresado'
     and e.cohorte in ('2020', '2021')
     and e.horas_total < app.meta_horas_extension()
),
insertadas as (
  insert into horas_extension (
    cedula_hash, matricula, nombre, periodo, horas, origen, motivo, detalle)
  select cedula_hash, matricula, nombre, periodo, faltan, 'historica',
         'Acreditación por egreso: el título prueba el cumplimiento del requisito de '
         'Extensión Universitaria, cursado antes de que existiera esta plataforma.',
         'Saldo acreditado para alcanzar la meta de ' || app.meta_horas_extension() ||
         ' horas de la carrera. Sin respaldo de asistencia en la plataforma.'
    from pendientes
  returning horas
)
insert into auditoria (accion, entidad, motivo, detalle)
select 'horas_extension_acreditadas_por_egreso', 'padron',
       'Acreditación por egreso de las cohortes 2020 y 2021.',
       jsonb_build_object(
         'cohortes', array['2020', '2021'],
         'meta', app.meta_horas_extension(),
         'personas', count(*),
         'horas', sum(horas),
         'via', 'migración acreditar_egresados_cohortes_2020_2021')
  from insertadas;;
