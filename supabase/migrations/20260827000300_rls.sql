-- Row Level Security. Ningún rol anónimo toca las tablas: todo lo público pasa
-- por funciones SECURITY DEFINER que devuelven únicamente lo que corresponde.

alter table public.usuarios                 enable row level security;
alter table public.consentimiento_versiones enable row level security;
alter table public.actividades              enable row level security;
alter table public.jornadas                 enable row level security;
alter table public.inscripciones            enable row level security;
alter table public.respuestas               enable row level security;
alter table public.asistencias              enable row level security;
alter table public.difusiones               enable row level security;
alter table public.indicadores_manuales     enable row level security;
alter table public.auditoria                enable row level security;
alter table public.solicitudes_derechos     enable row level security;
alter table public.limites_tasa             enable row level security;

revoke all on all tables in schema public from anon;
revoke update, delete on public.auditoria from public, authenticated;

-- ── usuarios ───────────────────────────────────────────────────────────────────
create policy usuarios_lectura on public.usuarios for select to authenticated
  using (id = auth.uid() or app.es('admin','coordinacion','auditor'));
create policy usuarios_escritura on public.usuarios for all to authenticated
  using (app.es('admin')) with check (app.es('admin'));

-- ── consentimiento: todo el panel lo lee; solo Dirección crea versiones ────────
create policy consent_lectura on public.consentimiento_versiones
  for select to authenticated using (true);
create policy consent_escritura on public.consentimiento_versiones
  for all to authenticated using (app.es('admin')) with check (app.es('admin'));

-- ── actividades ────────────────────────────────────────────────────────────────
create policy act_lectura on public.actividades for select to authenticated using (
  app.es('admin','coordinacion','secretaria','auditor')
  or docente_responsable = auth.uid()
);
create policy act_escritura on public.actividades for all to authenticated
  using (app.es('admin','coordinacion'))
  with check (app.es('admin','coordinacion'));

-- ── jornadas ───────────────────────────────────────────────────────────────────
create policy jor_lectura on public.jornadas for select to authenticated using (
  exists (select 1 from public.actividades a where a.id = actividad_id)
);
create policy jor_escritura on public.jornadas for all to authenticated
  using (app.es('admin','coordinacion')
         or exists (select 1 from public.actividades a
                     where a.id = actividad_id and a.docente_responsable = auth.uid()))
  with check (app.es('admin','coordinacion')
         or exists (select 1 from public.actividades a
                     where a.id = actividad_id and a.docente_responsable = auth.uid()));

-- ── inscripciones ──────────────────────────────────────────────────────────────
create policy insc_lectura on public.inscripciones for select to authenticated using (
  app.es('admin','coordinacion','secretaria','auditor')
  or exists (select 1 from public.actividades a
              where a.id = actividad_id and a.docente_responsable = auth.uid())
);
create policy insc_edicion on public.inscripciones for update to authenticated
  using (app.es('admin','coordinacion','secretaria'))
  with check (app.es('admin','coordinacion','secretaria'));
-- El alta es siempre pública y validada: pasa por public.inscribir(). No hay
-- política de INSERT para el panel.

-- ── respuestas ─────────────────────────────────────────────────────────────────
create policy resp_lectura on public.respuestas for select to authenticated using (
  app.es('admin','coordinacion','secretaria')
  or exists (select 1 from public.inscripciones i
               join public.actividades a on a.id = i.actividad_id
              where i.id = inscripcion_id and a.docente_responsable = auth.uid())
);

-- ── asistencias ────────────────────────────────────────────────────────────────
create policy asis_lectura on public.asistencias for select to authenticated using (
  app.es('admin','coordinacion','secretaria','auditor')
  or exists (select 1 from public.jornadas j
               join public.actividades a on a.id = j.actividad_id
              where j.id = jornada_id and a.docente_responsable = auth.uid())
);
create policy asis_escritura on public.asistencias for all to authenticated
  using (app.es('admin','coordinacion')
         or exists (select 1 from public.jornadas j
                      join public.actividades a on a.id = j.actividad_id
                     where j.id = jornada_id and a.docente_responsable = auth.uid()))
  with check (app.es('admin','coordinacion')
         or exists (select 1 from public.jornadas j
                      join public.actividades a on a.id = j.actividad_id
                     where j.id = jornada_id and a.docente_responsable = auth.uid()));

-- ── difusiones e indicadores manuales ──────────────────────────────────────────
create policy dif_lectura on public.difusiones for select to authenticated using (true);
create policy dif_escritura on public.difusiones for all to authenticated
  using (app.es('admin','coordinacion')) with check (app.es('admin','coordinacion'));

create policy indm_lectura on public.indicadores_manuales for select to authenticated using (true);
create policy indm_escritura on public.indicadores_manuales for all to authenticated
  using (app.es('admin','coordinacion')) with check (app.es('admin','coordinacion'));

-- ── auditoría: se lee, no se escribe desde el cliente ──────────────────────────
create policy audit_lectura on public.auditoria for select to authenticated
  using (app.es('admin','auditor'));

-- ── solicitudes de derechos ────────────────────────────────────────────────────
create policy der_lectura on public.solicitudes_derechos for select to authenticated
  using (app.es('admin','secretaria','auditor'));
create policy der_edicion on public.solicitudes_derechos for update to authenticated
  using (app.es('admin','secretaria')) with check (app.es('admin','secretaria'));
-- El alta pública pasa por public.solicitar_derecho().

-- ── límites de tasa: nadie los lee desde el cliente ────────────────────────────
-- (sin políticas: solo service_role, que las omite)
