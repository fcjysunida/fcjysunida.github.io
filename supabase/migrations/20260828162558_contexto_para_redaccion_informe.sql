-- Todo lo que hace falta para redactar un borrador de informe, en una sola
-- consulta. Se devuelven cifras reales: si la actividad tiene inscripción y
-- asistencia cargadas, el borrador se apoya en datos, no en suposiciones.
-- No incluye ningún dato personal: solo agregados y los nombres de los
-- participantes que el propio proyecto declara.

create or replace function public.proyecto_contexto(p_proyecto uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.proyectos%rowtype; v jsonb; a public.actividades%rowtype;
begin
  select * into p from public.proyectos where id = p_proyecto;
  if not found then raise exception 'El proyecto no existe.'; end if;

  if not (app.es('admin','coordinacion','secretaria')
          or p.docente_responsable = auth.uid() or p.creado_por = auth.uid()) then
    raise exception 'Su rol no accede a este proyecto.';
  end if;

  v := jsonb_build_object(
    'nombre', p.nombre,
    'clasificacion', p.clasificacion,
    'categoria', p.categoria_memoria,
    'anio', p.anio,
    'fecha_inicio', p.fecha_inicio,
    'fecha_fin', p.fecha_fin,
    'periodo_academico', p.periodo_academico,
    'carreras', p.carreras,
    'curso', p.curso,
    'lider', p.lider,
    'tutor', p.tutor,
    'localizacion', p.localizacion,
    'otras_organizaciones', p.otras_organizaciones,
    'entregable', p.entregable,
    'horas_reloj', p.horas_reloj,
    'horas_extension', p.horas_extension,
    'beneficiarios_directos_declarados', p.beneficiarios_directos,
    'beneficiarios_indirectos_declarados', p.beneficiarios_indirectos,
    'propuesta', p.propuesta,
    'participantes', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', pp.tipo, 'nombre', pp.nombre,
                                          'catedra', pp.catedra, 'organizacion', pp.organizacion,
                                          'carrera', pp.carrera, 'ciclo', pp.ciclo)
             order by pp.tipo, pp.orden)
        from public.proyecto_participantes pp where pp.proyecto_id = p.id), '[]'::jsonb),
    'informes_previos', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', pi.fecha_informe,
                                          'resumen', left(coalesce(pi.resumen,''), 400))
             order by pi.fecha_informe)
        from public.proyecto_informes pi where pi.proyecto_id = p.id), '[]'::jsonb));

  -- Si el proyecto está vinculado a una actividad, se suman las cifras reales.
  if p.actividad_id is not null then
    select * into a from public.actividades where id = p.actividad_id;
    v := v || jsonb_build_object('actividad', jsonb_build_object(
      'titulo', a.titulo, 'modalidad', a.modalidad, 'lugar', a.lugar,
      'jornadas', a.dias, 'cupo', a.cupo, 'horas_academicas', a.horas_academicas,
      'inscriptos', (select count(*) from public.inscripciones i
                      where i.actividad_id = a.id and i.estado <> 'anulada'),
      'asistencias', (select count(*) from public.asistencias s
                        join public.jornadas j on j.id = s.jornada_id
                       where j.actividad_id = a.id),
      'estudiantes', (select count(*) from public.inscripciones i
                       where i.actividad_id = a.id and i.condicion = 'estudiante'
                         and i.estado <> 'anulada'),
      'egresados', (select count(*) from public.inscripciones i
                     where i.actividad_id = a.id and i.condicion = 'egresado'
                       and i.estado <> 'anulada'),
      'externos', (select count(*) from public.inscripciones i
                    where i.actividad_id = a.id and i.condicion = 'externo'
                      and i.estado <> 'anulada'),
      'instituciones', (select count(distinct i.institucion) from public.inscripciones i
                         where i.actividad_id = a.id and i.institucion is not null),
      'ciudades', (select count(distinct i.ciudad) from public.inscripciones i
                    where i.actividad_id = a.id and i.ciudad is not null),
      'satisfaccion', public.satisfaccion_de(a.id),
      'comentarios', coalesce((select jsonb_agg(c.comentario)
                                 from public.comentarios_de(a.id) c), '[]'::jsonb)));
  end if;

  return v;
end $$;
revoke execute on function public.proyecto_contexto(uuid) from public, anon;
grant  execute on function public.proyecto_contexto(uuid) to authenticated;

-- Traza de cada uso de la redacción asistida: qué proyecto, quién y con qué modelo.
create table public.redacciones_ia (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references public.proyectos(id) on delete cascade,
  usuario_id    uuid references public.usuarios(id),
  modelo        text not null,
  tokens_entrada  integer,
  tokens_salida   integer,
  creado_en     timestamptz not null default now()
);
alter table public.redacciones_ia enable row level security;
create policy ia_lectura on public.redacciones_ia for select to authenticated
  using (app.es('admin','coordinacion','auditor'));
revoke all on public.redacciones_ia from anon;

create or replace function public.registrar_redaccion_ia(
  p_proyecto uuid, p_modelo text, p_entrada int, p_salida int)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.redacciones_ia (proyecto_id, usuario_id, modelo,
                                     tokens_entrada, tokens_salida)
  values (p_proyecto, auth.uid(), p_modelo, p_entrada, p_salida);
  perform public.auditar('redaccion_ia', 'proyectos', p_proyecto, null,
                         jsonb_build_object('modelo', p_modelo));
end $$;
revoke execute on function public.registrar_redaccion_ia(uuid, text, int, int)
  from public, anon;
grant execute on function public.registrar_redaccion_ia(uuid, text, int, int)
  to authenticated;;
