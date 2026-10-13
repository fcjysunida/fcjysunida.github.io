-- Certificados. Se conserva la lógica de Autocrat: una plantilla con etiquetas
-- <<Etiqueta>> que se reemplazan por los datos de cada persona. La diferencia es
-- que el valor de cada etiqueta sale de la base, no de una planilla, y que cada
-- certificado emitido queda con un código de verificación público.

create type public.rol_certificado as enum
  ('participante','disertante','organizador','tutor','panelista','moderador');

create table public.certificado_plantillas (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  rol          public.rol_certificado,          -- null = sirve para cualquier rol
  cuerpo_html  text not null,
  fondo_url    text,                            -- fondo exportado del diseño institucional
  orientacion  text not null default 'horizontal'
               check (orientacion in ('horizontal','vertical')),
  vigente      boolean not null default true,
  creado_por   uuid references public.usuarios(id),
  creado_en    timestamptz not null default now()
);

create table public.certificados (
  id             uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references public.inscripciones(id) on delete cascade,
  actividad_id   uuid not null references public.actividades(id) on delete cascade,
  plantilla_id   uuid references public.certificado_plantillas(id),
  codigo         text not null unique,
  rol            public.rol_certificado not null default 'participante',
  -- Los datos se congelan al emitir: el certificado dice lo que decía ese día,
  -- aunque después se rectifique la inscripción o venza la retención.
  nombre         text not null,
  evento         text not null,
  fecha_texto    text not null,
  horas          numeric(5,1) not null default 0,
  jornadas       smallint not null default 0,
  emitido_en     timestamptz not null default now(),
  emitido_por    uuid references public.usuarios(id),
  anulado_en     timestamptz,
  motivo_anulacion text,
  unique (inscripcion_id, rol)
);
create index certificados_actividad_idx on public.certificados (actividad_id);

alter table public.certificado_plantillas enable row level security;
alter table public.certificados           enable row level security;

create policy plt_lectura on public.certificado_plantillas for select to authenticated using (true);
create policy plt_escritura on public.certificado_plantillas for all to authenticated
  using (app.es('admin','coordinacion')) with check (app.es('admin','coordinacion'));

create policy cert_lectura on public.certificados for select to authenticated using (
  app.es('admin','coordinacion','secretaria','auditor')
  or exists (select 1 from public.actividades a
              where a.id = actividad_id and a.docente_responsable = auth.uid()));

-- ── Código de verificación ─────────────────────────────────────────────────────
-- Legible en voz alta y sin caracteres ambiguos: FCJ-XXXX-XXXX
create or replace function app.codigo_certificado()
returns text language plpgsql volatile set search_path = '' as $$
declare abc text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; v text := ''; i int;
begin
  for i in 1..8 loop
    v := v || substr(abc, 1 + floor(random() * length(abc))::int, 1);
    if i = 4 then v := v || '-'; end if;
  end loop;
  return 'FCJ-' || v;
end $$;

-- ── Emisión por lote ───────────────────────────────────────────────────────────
-- Emite a quienes pidieron certificado y asistieron al menos a `p_minimo_jornadas`.
create or replace function public.emitir_certificados(
  p_actividad uuid,
  p_rol public.rol_certificado default 'participante',
  p_minimo_jornadas smallint default 1,
  p_plantilla uuid default null,
  p_solo_simulacion boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.actividades%rowtype; r record;
  v_plantilla uuid; v_n int := 0; v_ya int := 0; v_fecha text;
begin
  if not app.es('admin','coordinacion','secretaria') then
    raise exception 'Su rol no emite certificados.';
  end if;
  select * into a from public.actividades where id = p_actividad;
  if not found then raise exception 'La actividad no existe.'; end if;

  v_plantilla := coalesce(p_plantilla, (
    select id from public.certificado_plantillas
     where vigente and (rol = p_rol or rol is null)
     order by (rol = p_rol) desc, creado_en desc limit 1));

  v_fecha := case when a.dias = 1
    then to_char(a.fecha_inicio, 'DD') || ' de ' ||
         trim(to_char(a.fecha_inicio, 'TMMonth')) || ' de ' || to_char(a.fecha_inicio, 'YYYY')
    else 'del ' || to_char(a.fecha_inicio, 'DD') || ' al ' ||
         to_char(a.fecha_inicio + (a.dias - 1), 'DD') || ' de ' ||
         trim(to_char(a.fecha_inicio + (a.dias - 1), 'TMMonth')) || ' de ' ||
         to_char(a.fecha_inicio + (a.dias - 1), 'YYYY') end;

  for r in
    select i.id, i.nombre,
           (select count(*) from public.asistencias s where s.inscripcion_id = i.id) as jornadas
      from public.inscripciones i
     where i.actividad_id = p_actividad
       and i.estado = 'confirmada'
       and i.requiere_certificado
       and i.anonimizada_en is null
  loop
    if r.jornadas < p_minimo_jornadas then continue; end if;
    if exists (select 1 from public.certificados c
                where c.inscripcion_id = r.id and c.rol = p_rol and c.anulado_en is null) then
      v_ya := v_ya + 1;
      continue;
    end if;
    v_n := v_n + 1;
    if p_solo_simulacion then continue; end if;

    insert into public.certificados (
      inscripcion_id, actividad_id, plantilla_id, codigo, rol,
      nombre, evento, fecha_texto, horas, jornadas, emitido_por)
    values (r.id, p_actividad, v_plantilla, app.codigo_certificado(), p_rol,
            r.nombre, a.titulo, v_fecha, a.horas_academicas, r.jornadas, auth.uid());
  end loop;

  if not p_solo_simulacion then
    perform public.auditar('emision_certificados', 'actividades', p_actividad, null,
      jsonb_build_object('rol', p_rol, 'emitidos', v_n, 'minimo_jornadas', p_minimo_jornadas));
  end if;

  return jsonb_build_object('ok', true, 'simulacion', p_solo_simulacion,
    'a_emitir', v_n, 'ya_tenian', v_ya, 'plantilla', v_plantilla,
    'sin_plantilla', v_plantilla is null);
end $$;
revoke execute on function public.emitir_certificados(
  uuid, public.rol_certificado, smallint, uuid, boolean) from public, anon;
grant execute on function public.emitir_certificados(
  uuid, public.rol_certificado, smallint, uuid, boolean) to authenticated;

create or replace function public.anular_certificado(p_id uuid, p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not app.es('admin','coordinacion') then
    raise exception 'Su rol no anula certificados.';
  end if;
  if coalesce(btrim(p_motivo),'') = '' then
    raise exception 'La anulación exige declarar un motivo.';
  end if;
  update public.certificados set anulado_en = now(), motivo_anulacion = p_motivo
   where id = p_id and anulado_en is null;
  perform public.auditar('anulacion_certificado', 'certificados', p_id, p_motivo, null);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.anular_certificado(uuid, text) from public, anon;
grant  execute on function public.anular_certificado(uuid, text) to authenticated;

-- ── Verificación pública: /c/:codigo ───────────────────────────────────────────
-- Devuelve lo justo para confirmar que el certificado es auténtico. No expone
-- cédula, correo ni ningún otro dato de la persona.
create or replace function public.certificado_por_codigo(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not app.limite('cert:' || upper(btrim(coalesce(p_codigo,''))), 20, interval '10 minutes') then
    return jsonb_build_object('error', 'demasiados_intentos');
  end if;
  select jsonb_build_object(
    'codigo', c.codigo, 'nombre', c.nombre, 'evento', c.evento,
    'fecha', c.fecha_texto, 'horas', c.horas, 'jornadas', c.jornadas,
    'rol', c.rol, 'emitido_en', c.emitido_en,
    'valido', c.anulado_en is null,
    'anulado_en', c.anulado_en,
    'modalidad', a.modalidad, 'lugar', a.lugar,
    'plantilla', (select jsonb_build_object('cuerpo_html', p.cuerpo_html,
                                            'fondo_url', p.fondo_url,
                                            'orientacion', p.orientacion)
                    from public.certificado_plantillas p where p.id = c.plantilla_id))
    into v
    from public.certificados c
    join public.actividades a on a.id = c.actividad_id
   where upper(c.codigo) = upper(btrim(p_codigo));
  if v is null then return jsonb_build_object('error', 'no_encontrado'); end if;
  return v;
end $$;
grant execute on function public.certificado_por_codigo(text) to anon, authenticated;

-- ── Listado para el panel ──────────────────────────────────────────────────────
create or replace function public.certificados_de(p_actividad uuid)
returns table (id uuid, codigo text, nombre text, rol public.rol_certificado,
               horas numeric, jornadas smallint, emitido_en timestamptz,
               anulado_en timestamptz, email text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.codigo, c.nombre, c.rol, c.horas, c.jornadas,
         c.emitido_en, c.anulado_en, i.email::text
    from public.certificados c
    join public.inscripciones i on i.id = c.inscripcion_id
   where c.actividad_id = p_actividad
     and (app.es('admin','coordinacion','secretaria','auditor')
          or exists (select 1 from public.actividades a
                      where a.id = p_actividad and a.docente_responsable = auth.uid()))
   order by c.nombre
$$;
revoke execute on function public.certificados_de(uuid) from public, anon;
grant  execute on function public.certificados_de(uuid) to authenticated;;
