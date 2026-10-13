-- Los participantes de proyecto se verificaron cuando el padrón solo tenía
-- 2025-1 y las nóminas de egresados. Ahora que están los diez períodos, se
-- vuelve a resolver la condición de cada uno contra el padrón del período que
-- corresponde al proyecto.
do $$
declare r record; v jsonb; v_cambios int := 0; v_total int := 0;
begin
  for r in
    select pp.id, pp.cedula_hash, pp.matricula, pp.condicion, pp.periodo_verificado,
           p.fecha_inicio, p.anio
      from public.proyecto_participantes pp
      join public.proyectos p on p.id = pp.proyecto_id
  loop
    v_total := v_total + 1;
    v := app.condicion_en_periodo(
           r.cedula_hash, r.matricula, r.fecha_inicio, r.anio::smallint,
           coalesce(r.condicion, 'externo'));

    update public.proyecto_participantes set
      tipo = case when (v->>'condicion') = 'estudiante' then 'estudiante'::public.tipo_participante
                  when (v->>'condicion') = 'docente'    then 'docente'::public.tipo_participante
                  else 'externo'::public.tipo_participante end,
      condicion          = (v->>'condicion')::public.condicion_participante,
      condicion_origen   = v->>'origen',
      periodo_verificado = v->>'periodo',
      matricula          = coalesce(v->>'matricula', matricula),
      carrera            = coalesce(v->>'carrera', carrera),
      ciclo              = coalesce(v->>'ciclo', ciclo)
     where id = r.id
       and (condicion::text is distinct from (v->>'condicion')
         or periodo_verificado is distinct from (v->>'periodo'));

    if found then v_cambios := v_cambios + 1; end if;
  end loop;

  insert into public.auditoria (accion, entidad, motivo, detalle)
  values ('participantes_revalidados', 'proyecto_participantes',
          'Revalidación tras cargar el padrón completo de 2021-2 a 2026-1.',
          jsonb_build_object('revisados', v_total, 'reclasificados', v_cambios,
                             'via', 'migración revalidar_participantes_con_padron_completo'));
end $$;;
