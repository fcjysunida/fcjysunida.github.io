-- Proyectos de Extensión Universitaria e informes finales.
-- Estructura calcada de los formatos oficiales:
--   «9. Formato Propuesta de Proyecto de Extensión Universitaria»
--   «10. Formato para Informe de Proyecto de Extensión Universitaria»
-- Los bloques de estructura fija van en columnas (alimentan indicadores);
-- las matrices y listas variables van en jsonb.

create type public.estado_proyecto as enum
  ('borrador','presentado','aprobado','en_ejecucion','finalizado','rechazado');

create type public.clasificacion_proyecto as enum
  ('cursos_extracurriculares','prestaciones_servicio','actos_culturales','deportes',
   'publicaciones','eventos_academicos','experiencia_conocimiento','otros');

create type public.tipo_participante as enum ('docente','funcionario','externo','estudiante');

-- ── Escala de carga horaria del anexo del formato oficial ──────────────────────
create table public.escala_extension (
  clasificacion   public.clasificacion_proyecto primary key,
  etiqueta        text not null,
  ejemplos        text not null,
  regla           text not null,
  max_total       numeric(4,1),
  max_actividad   numeric(4,1),
  -- horas de EU por cada hora reloj; null cuando la regla no es proporcional
  factor_hora     numeric(4,2)
);

insert into public.escala_extension values
('cursos_extracurriculares','Cursos extracurriculares',
 'Programas de capacitación a la comunidad, charlas educativas de interés social, campañas de concienciación',
 '1 hora de EU por cada 2 horas reloj', 10, 5, 0.5),
('prestaciones_servicio','Prestaciones de servicio',
 'Servicios a la comunidad, asistencia social, campamentos con trabajo de campo',
 '1 hora de EU por cada hora reloj; campamentos, 5 horas de EU por día', 20, 5, 1),
('actos_culturales','Actos vinculados con el arte y la cultura',
 'Música, teatro, danza, festivales, conciertos',
 '1 hora de EU por actividad; 2 por méritos (primer, segundo o tercer puesto)', 4, 1, null),
('deportes','Deportes','Torneos universitarios',
 '1 hora de EU por actividad; 2 por méritos (primer, segundo o tercer puesto)', 4, 1, null),
('publicaciones','Publicaciones',
 'Artículos en periódicos y revistas; radio, TV y artículos en páginas web',
 '2 horas de EU por artículo impreso; 1 hora por actividad en radio, TV o web', 20, null, null),
('eventos_academicos','Eventos académicos',
 'Congresos, seminarios, simposios, foros, paneles, conferencias, exposiciones, videoconferencias, talleres',
 '1 hora de EU por día de actividad', 10, null, null),
('experiencia_conocimiento','Adquisición de experiencia y conocimientos',
 'Trabajos de campo, censos, entrevistas, encuestas, viajes de estudio, pasantías',
 '1 hora de EU por actividad; 2 por viaje de estudio; pasantías 5/10/15 según duración', 15, null, null),
('otros','Otros','A especificar', 'A determinar por la Coordinación de Extensión', null, null, null);

-- ── Proyectos ──────────────────────────────────────────────────────────────────
create table public.proyectos (
  id                       uuid primary key default gen_random_uuid(),
  nombre                   text not null check (length(btrim(nombre)) > 0),
  clasificacion            public.clasificacion_proyecto not null,
  clasificacion_otros      text,
  estado                   public.estado_proyecto not null default 'borrador',
  periodo_academico        text references public.periodos_academicos(codigo),
  facultad                 text not null default 'Facultad de Ciencias Jurídicas y Sociales',
  carreras                 text,
  curso                    text,
  localizacion             text,
  otras_organizaciones     text,
  lider                    text,
  tutor                    text,
  entregable               text,
  proyectos_relacionados   text,
  fecha_inicio             date,
  fecha_fin                date,
  horas_reloj              numeric(6,1) not null default 0,
  horas_extension          numeric(5,1) not null default 0,
  beneficiarios_directos   integer not null default 0,
  beneficiarios_indirectos integer not null default 0,
  -- Vínculo opcional con la actividad que lleva la inscripción y la asistencia.
  actividad_id             uuid references public.actividades(id) on delete set null,
  -- Bloques del formato 9 que son listas o matrices:
  --   introduccion, justificacion, alcance {antecedentes, situacion_actual,
  --   situacion_deseada, poblacion_directa, poblacion_indirecta, cantidad},
  --   resultados [{resultado, indicadores, verificacion}],
  --   objetivo_general, objetivos_especificos [], metas [],
  --   metodologia, actividades [{actividad, inicio, fin, responsable}],
  --   presupuesto {rubro: {estado, unida, prestamos, donaciones, otros}},
  --   creditos {certificados: {docentes, estudiantes, otros}, ...},
  --   anexos []
  propuesta                jsonb not null default '{}'::jsonb,
  docente_responsable      uuid references public.usuarios(id),
  creado_por               uuid references public.usuarios(id),
  creado_en                timestamptz not null default now(),
  actualizado_en           timestamptz not null default now(),
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);
create index proyectos_periodo_idx  on public.proyectos (periodo_academico);
create index proyectos_estado_idx   on public.proyectos (estado);
create index proyectos_inicio_idx   on public.proyectos (fecha_inicio);

-- ── Participantes del proyecto ─────────────────────────────────────────────────
create table public.proyecto_participantes (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos(id) on delete cascade,
  tipo           public.tipo_participante not null,
  nombre         text not null,
  cedula_hash    text,
  cedula_cif     bytea,
  cedula_mascara text,
  matricula      text,
  carrera        text,
  ciclo          text,
  catedra        text,
  organizacion   text,
  orden          smallint not null default 0
);
create index proyparti_proyecto_idx on public.proyecto_participantes (proyecto_id);
create index proyparti_hash_idx     on public.proyecto_participantes (cedula_hash);

-- ── Informes ───────────────────────────────────────────────────────────────────
create table public.proyecto_informes (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos(id) on delete cascade,
  elaborado_por  text not null,
  aprobado_por   text,
  fecha_informe  date not null default current_date,
  lugar_ejecucion text,
  beneficiarios  text,
  resumen        text,
  metodologia    text,
  conclusiones   text,
  -- Bloques del formato 10:
  --   analisis [{fila, planteado, alcanzado}],
  --   plan [{actividad, responsables, cronograma}],
  --   metas [{meta, indicadores, recursos}],
  --   rendicion {rubro: {estado, unida, prestamos, donaciones, otros}},
  --   anexos []
  informe        jsonb not null default '{}'::jsonb,
  estado         public.estado_proyecto not null default 'borrador',
  creado_por     uuid references public.usuarios(id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index proyinf_proyecto_idx on public.proyecto_informes (proyecto_id);

-- ── RLS ────────────────────────────────────────────────────────────────────────
alter table public.escala_extension       enable row level security;
alter table public.proyectos              enable row level security;
alter table public.proyecto_participantes enable row level security;
alter table public.proyecto_informes      enable row level security;

create policy esc_lectura on public.escala_extension for select to authenticated using (true);

create policy proy_lectura on public.proyectos for select to authenticated using (
  app.es('admin','coordinacion','secretaria','auditor')
  or docente_responsable = auth.uid() or creado_por = auth.uid());
create policy proy_escritura on public.proyectos for all to authenticated
  using (app.es('admin','coordinacion')
         or docente_responsable = auth.uid() or creado_por = auth.uid())
  with check (app.es('admin','coordinacion')
         or docente_responsable = auth.uid() or creado_por = auth.uid());

create policy parti_todo on public.proyecto_participantes for all to authenticated
  using (exists (select 1 from public.proyectos p where p.id = proyecto_id))
  with check (exists (select 1 from public.proyectos p where p.id = proyecto_id));

create policy inf_todo on public.proyecto_informes for all to authenticated
  using (exists (select 1 from public.proyectos p where p.id = proyecto_id))
  with check (exists (select 1 from public.proyectos p where p.id = proyecto_id));

revoke all on public.escala_extension, public.proyectos,
               public.proyecto_participantes, public.proyecto_informes from anon;

-- ── Horas de extensión sugeridas por la escala del anexo ───────────────────────
create or replace function public.horas_extension_sugeridas(
  p_clasificacion public.clasificacion_proyecto,
  p_horas_reloj numeric default 0,
  p_dias smallint default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare e public.escala_extension%rowtype; v numeric;
begin
  select * into e from public.escala_extension where clasificacion = p_clasificacion;
  if not found then return jsonb_build_object('horas', 0, 'regla', 'sin escala definida'); end if;

  if e.factor_hora is not null then
    v := round(p_horas_reloj * e.factor_hora, 1);
  elsif p_clasificacion = 'eventos_academicos' then
    v := greatest(1, coalesce(p_dias, 1));                -- 1 hora de EU por día
  elsif p_clasificacion in ('actos_culturales','deportes','experiencia_conocimiento') then
    v := 1;                                               -- 1 hora de EU por actividad
  else
    v := 0;
  end if;

  if e.max_actividad is not null then v := least(v, e.max_actividad); end if;

  return jsonb_build_object(
    'horas', v, 'regla', e.regla, 'etiqueta', e.etiqueta,
    'max_total', e.max_total, 'max_actividad', e.max_actividad,
    'nota', 'Al terminar la carrera el estudiante debe acumular un mínimo de 30 horas de '
         || 'Extensión Universitaria en, por lo menos, tres actividades diferentes.');
end $$;
revoke execute on function public.horas_extension_sugeridas(
  public.clasificacion_proyecto, numeric, smallint) from public, anon;
grant execute on function public.horas_extension_sugeridas(
  public.clasificacion_proyecto, numeric, smallint) to authenticated;

-- ── Vista de resumen ───────────────────────────────────────────────────────────
create view public.proyectos_resumen
with (security_invoker = on) as
select p.id, p.nombre, p.clasificacion, p.estado, p.periodo_academico, p.carreras,
       p.lider, p.tutor, p.fecha_inicio, p.fecha_fin, p.horas_reloj, p.horas_extension,
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
