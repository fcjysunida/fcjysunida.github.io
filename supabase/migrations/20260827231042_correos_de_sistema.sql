-- Los tres correos que manda el sistema. HTML sobrio y con alternativa en texto
-- plano: los mensajes recargados de imágenes y tablas anidadas son los que
-- terminan en la carpeta de correo no deseado.

create or replace function app.plantilla_correo(p_titulo text, p_cuerpo text)
returns text language sql immutable set search_path = '' as $$
  select
  '<!doctype html><html lang="es"><body style="margin:0;background:#f3f2f2;'
  || 'font-family:Georgia,serif;color:#201e1d;">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
  || '<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
  || 'style="max-width:560px;background:#fbfafa;border:1px solid #d5d3d2;margin:28px auto;">'
  || '<tr><td style="padding:28px 30px 0;border-top:4px solid #c8202e;">'
  || '<div style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#ae1800;'
  || 'font-family:Helvetica,Arial,sans-serif;">Facultad de Ciencias Jurídicas y Sociales — UNIDA</div>'
  || '<h1 style="font-size:22px;font-weight:600;margin:14px 0 0;line-height:1.25;">' || p_titulo || '</h1>'
  || '</td></tr><tr><td style="padding:18px 30px 26px;font-size:15px;line-height:1.6;">'
  || p_cuerpo
  || '</td></tr><tr><td style="padding:16px 30px 24px;border-top:1px solid #e0dedd;'
  || 'font-size:12px;line-height:1.5;color:#6b6968;font-family:Helvetica,Arial,sans-serif;">'
  || 'Responsable del tratamiento de datos: Abg. Patricia Sequeira — '
  || '<a href="mailto:extensionderecho@unida.edu.py" style="color:#ae1800;">extensionderecho@unida.edu.py</a>.<br>'
  || 'Puede ejercer sus derechos de acceso, rectificación, oposición, supresión, portabilidad '
  || 'y revocación en <a href="https://' || app.config('dominio_publico','fcjysunida.github.io')
  || '/derechos" style="color:#ae1800;">/derechos</a>.'
  || '</td></tr></table></td></tr></table></body></html>'
$$;

-- ── 1. Confirmación de inscripción ─────────────────────────────────────────────
create or replace function app.correo_inscripcion(p_inscripcion uuid)
returns void language plpgsql volatile set search_path = '' as $$
declare i public.inscripciones%rowtype; a public.actividades%rowtype;
        v_base text; v_cuerpo text; v_asunto text; v_fechas text;
begin
  select * into i from public.inscripciones where id = p_inscripcion;
  select * into a from public.actividades where id = i.actividad_id;
  v_base := 'https://' || app.config('dominio_publico','fcjysunida.github.io');
  v_fechas := case when a.dias = 1
    then to_char(a.fecha_inicio,'DD/MM/YYYY')
    else to_char(a.fecha_inicio,'DD/MM/YYYY') || ' al ' ||
         to_char(a.fecha_inicio + (a.dias - 1),'DD/MM/YYYY') end;

  v_asunto := case when i.estado = 'en_espera'
    then 'Quedó en lista de espera: ' || a.titulo
    else 'Inscripción confirmada: ' || a.titulo end;

  v_cuerpo :=
    '<p>Estimado/a ' || i.nombre || ':</p>' ||
    case when i.estado = 'en_espera' then
      '<p>Registramos su solicitud de inscripción a <strong>' || a.titulo ||
      '</strong>. El cupo está completo, de modo que queda en lista de espera; '
      'le avisaremos a esta misma dirección si se libera un lugar.</p>'
    else
      '<p>Su inscripción a <strong>' || a.titulo || '</strong> quedó confirmada.</p>'
    end ||
    '<p><strong>Fechas:</strong> ' || v_fechas ||
    '<br><strong>Modalidad:</strong> ' || a.modalidad ||
    coalesce('<br><strong>Lugar:</strong> ' || a.lugar, '') ||
    coalesce('<br><strong>Carga horaria:</strong> ' || a.horas_academicas || ' horas', '') ||
    '</p>' ||
    case when i.estado = 'confirmada' then
      '<p>El día de la actividad registre su asistencia en este enlace:<br>' ||
      '<a href="' || v_base || '/a/' || a.token_asistencia || '" style="color:#ae1800;">' ||
      v_base || '/a/' || a.token_asistencia || '</a><br>' ||
      'Le pedirá su cédula y el código de sala, que el docente anuncia al comenzar cada jornada.</p>'
    else '' end ||
    '<p style="font-size:13px;color:#6b6968;">Constancia de consentimiento registrada el ' ||
    to_char(i.consentido_en at time zone 'America/Asuncion','DD/MM/YYYY HH24:MI') || '.</p>';

  perform app.encolar_correo(i.email::text, i.nombre, v_asunto,
    app.plantilla_correo(case when i.estado = 'en_espera' then 'Quedó en lista de espera'
                              else 'Inscripción confirmada' end, v_cuerpo),
    'Su inscripción a ' || a.titulo || ' quedó registrada. Fechas: ' || v_fechas || '. ' ||
    'Registro de asistencia: ' || v_base || '/a/' || a.token_asistencia,
    'confirmacion_inscripcion', 'inscripciones', i.id);
end $$;

-- ── 2. Certificado disponible ──────────────────────────────────────────────────
create or replace function app.correo_certificado(p_certificado uuid)
returns void language plpgsql volatile set search_path = '' as $$
declare c public.certificados%rowtype; v_email text; v_base text; v_cuerpo text;
begin
  select * into c from public.certificados where id = p_certificado;
  select i.email::text into v_email from public.inscripciones i where i.id = c.inscripcion_id;
  v_base := 'https://' || app.config('dominio_publico','fcjysunida.github.io');

  v_cuerpo :=
    '<p>Estimado/a ' || c.nombre || ':</p>' ||
    '<p>Su constancia de ' || c.rol || ' en <strong>' || c.evento ||
    '</strong> ya está disponible.</p>' ||
    '<p style="text-align:center;margin:26px 0;">' ||
    '<a href="' || v_base || '/c/' || c.codigo || '" ' ||
    'style="display:inline-block;background:#c8202e;color:#fbfafa;padding:12px 22px;' ||
    'text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:15px;">' ||
    'Ver y descargar la constancia</a></p>' ||
    '<p><strong>Código de verificación:</strong> ' || c.codigo || '<br>' ||
    '<strong>Carga horaria:</strong> ' || c.horas || ' horas<br>' ||
    '<strong>Fecha:</strong> ' || c.fecha_texto || '</p>' ||
    '<p style="font-size:13px;color:#6b6968;">Cualquier persona puede comprobar la ' ||
    'autenticidad de esta constancia ingresando el código en ' || v_base || '/c/</p>';

  perform app.encolar_correo(v_email, c.nombre,
    'Su constancia de ' || c.evento,
    app.plantilla_correo('Constancia disponible', v_cuerpo),
    'Su constancia de ' || c.evento || ' está disponible en ' || v_base || '/c/' || c.codigo ||
    ' (código ' || c.codigo || ').',
    'certificado', 'certificados', c.id);
end $$;

-- ── 3. Recordatorio de jornada ─────────────────────────────────────────────────
create or replace function app.correos_recordatorio()
returns int language plpgsql volatile set search_path = '' as $$
declare r record; v_base text; v_n int := 0;
begin
  v_base := 'https://' || app.config('dominio_publico','fcjysunida.github.io');
  for r in
    select i.id, i.nombre, i.email::text as email, a.titulo, a.token_asistencia,
           a.lugar, a.modalidad, j.numero, j.fecha
      from public.jornadas j
      join public.actividades a on a.id = j.actividad_id
      join public.inscripciones i on i.actividad_id = a.id
     where j.fecha = app.hoy() + 1
       and i.estado = 'confirmada' and i.anonimizada_en is null
       and not exists (select 1 from public.correos c
                        where c.motivo = 'recordatorio_jornada'
                          and c.entidad_id = i.id
                          and c.creado_en > now() - interval '20 hours')
  loop
    perform app.encolar_correo(r.email, r.nombre,
      'Mañana: ' || r.titulo || ' — jornada ' || r.numero,
      app.plantilla_correo('Mañana es la jornada ' || r.numero,
        '<p>Estimado/a ' || r.nombre || ':</p>' ||
        '<p>Le recordamos que mañana ' || to_char(r.fecha,'DD/MM/YYYY') ||
        ' se realiza la jornada ' || r.numero || ' de <strong>' || r.titulo || '</strong>.</p>' ||
        coalesce('<p><strong>Lugar:</strong> ' || r.lugar || '</p>', '') ||
        '<p>Registre su asistencia en:<br><a href="' || v_base || '/a/' || r.token_asistencia ||
        '" style="color:#ae1800;">' || v_base || '/a/' || r.token_asistencia || '</a><br>' ||
        'El código de sala lo anuncia el docente al comenzar.</p>'),
      'Mañana ' || to_char(r.fecha,'DD/MM/YYYY') || ' es la jornada ' || r.numero || ' de ' ||
      r.titulo || '. Registro: ' || v_base || '/a/' || r.token_asistencia,
      'recordatorio_jornada', 'inscripciones', r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Se arman a las 15:00 UTC (12:00 en Asunción) del día anterior.
select cron.schedule('fcjys-recordatorios', '0 15 * * *',
  $cron$ select app.correos_recordatorio(); $cron$);;
