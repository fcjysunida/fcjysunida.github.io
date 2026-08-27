-- Superficie pública. El navegador anónimo no toca ninguna tabla: solo llama a
-- estas funciones, que devuelven exactamente lo que corresponde y nada más.

-- Zona horaria institucional para resolver «la jornada de hoy».
create or replace function app.hoy() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Asuncion')::date
$$;

-- Límite de tasa sin dirección IP ni identificación de dispositivo.
create or replace function app.limite(p_clave text, p_maximo int, p_ventana interval)
returns boolean language plpgsql volatile set search_path = '' as $$
declare v_conteo int; v_ventana timestamptz;
begin
  insert into public.limites_tasa (clave, conteo, ventana)
       values (p_clave, 1, now())
  on conflict (clave) do update
     set conteo  = case when public.limites_tasa.ventana < now() - p_ventana
                        then 1 else public.limites_tasa.conteo + 1 end,
         ventana = case when public.limites_tasa.ventana < now() - p_ventana
                        then now() else public.limites_tasa.ventana end
  returning conteo, ventana into v_conteo, v_ventana;
  delete from public.limites_tasa where ventana < now() - interval '1 day';
  return v_conteo <= p_maximo;
end $$;

-- ── Consentimiento vigente ─────────────────────────────────────────────────────
create or replace function public.consentimiento_vigente()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'version', c.version, 'aviso', c.aviso,
    'tratamiento', c.texto_tratamiento, 'sensibles', c.texto_sensibles,
    'imagen', c.texto_imagen, 'comunicaciones', c.texto_comunicaciones)
  from public.consentimiento_versiones c
  where c.vigente_hasta is null
  order by c.vigente_desde desc limit 1
$$;
grant execute on function public.consentimiento_vigente() to anon, authenticated;

-- ── Formulario público: /f/:token ──────────────────────────────────────────────
create or replace function public.actividad_por_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'titulo', a.titulo, 'tipo', a.tipo, 'descripcion', a.descripcion,
    'modalidad', a.modalidad, 'fecha_inicio', a.fecha_inicio, 'dias', a.dias,
    'lugar', a.lugar, 'portada', a.portada, 'portada_credito', a.portada_credito,
    'campos', a.campos, 'estado', a.estado,
    'cupo', a.cupo,
    'lugares_libres', greatest(0, a.cupo - (
        select count(*) from public.inscripciones i
         where i.actividad_id = a.id and i.estado = 'confirmada')),
    'consentimiento', public.consentimiento_vigente())
  into v
  from public.actividades a
  where a.token_formulario = p_token
    and a.estado in ('publicada','cerrada');
  if v is null then
    return jsonb_build_object('error', 'no_encontrada');
  end if;
  return v;
end $$;
grant execute on function public.actividad_por_token(text) to anon, authenticated;

-- ── Alta de inscripción ────────────────────────────────────────────────────────
-- p_respuestas: { "<campo_id>": "<valor>" }
-- p_consentimientos: { "tratamiento": true, "sensible": false,
--                      "imagen": false, "comunicaciones": false }
create or replace function public.inscribir(
  p_token text, p_respuestas jsonb, p_consentimientos jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.actividades%rowtype;
  campo jsonb;
  v_valor text;
  v_mapa text;
  v_sensible boolean;
  v_faltan text[] := '{}';
  v_sensible_cargado boolean := false;
  v_cols jsonb := '{}'::jsonb;
  v_hash text;
  v_estado public.estado_inscripcion;
  v_id uuid;
  v_consent_id uuid;
  v_confirmadas int;
begin
  select * into a from public.actividades
   where token_formulario = p_token and estado = 'publicada';
  if not found then
    return jsonb_build_object('ok', false, 'error',
      'El formulario no está disponible o la inscripción ya fue cerrada.');
  end if;

  if not app.limite('insc:' || a.id::text, 60, interval '1 minute') then
    return jsonb_build_object('ok', false, 'error',
      'Demasiadas inscripciones seguidas. Aguarde un minuto y vuelva a intentar.');
  end if;

  if coalesce((p_consentimientos->>'tratamiento')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error',
      'Sin el consentimiento para el tratamiento de datos no es posible registrar la inscripción.');
  end if;

  -- Recorrido de los campos declarados en la actividad. Nada que no esté
  -- declarado se guarda: los pares sobrantes de p_respuestas se descartan.
  for campo in select * from jsonb_array_elements(a.campos) loop
    v_valor := nullif(btrim(coalesce(p_respuestas ->> (campo->>'id'), '')), '');
    v_sensible := coalesce((campo->>'sensible')::boolean, false);
    v_mapa := nullif(campo->>'mapa', '');
    if coalesce((campo->>'obligatorio')::boolean, false) and v_valor is null then
      v_faltan := v_faltan || coalesce(campo->>'etiqueta', 'campo sin título');
    end if;
    if v_sensible and v_valor is not null then
      v_sensible_cargado := true;
    end if;
    if v_mapa is not null and v_valor is not null then
      v_cols := v_cols || jsonb_build_object(v_mapa, v_valor);
    end if;
  end loop;

  if array_length(v_faltan, 1) is not null then
    return jsonb_build_object('ok', false, 'error',
      'Complete los campos obligatorios: ' || array_to_string(v_faltan, ', ') || '.');
  end if;

  if v_sensible_cargado
     and coalesce((p_consentimientos->>'sensible')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error',
      'Declaró un dato sensible: marque también el consentimiento expreso para ese campo o deje el campo vacío.');
  end if;

  if (v_cols->>'nombre') is null then
    return jsonb_build_object('ok', false, 'error', 'Falta el nombre y apellido.');
  end if;
  if (v_cols->>'cedula') is null then
    return jsonb_build_object('ok', false, 'error', 'Falta la cédula de identidad.');
  end if;

  v_hash := app.hash_cedula(v_cols->>'cedula');
  if exists (select 1 from public.inscripciones i
              where i.actividad_id = a.id and i.cedula_hash = v_hash
                and i.estado <> 'anulada') then
    return jsonb_build_object('ok', false, 'error',
      'Esa cédula ya figura inscripta en esta actividad.');
  end if;

  select count(*) into v_confirmadas from public.inscripciones i
   where i.actividad_id = a.id and i.estado = 'confirmada';
  v_estado := case when a.cupo > 0 and v_confirmadas >= a.cupo
                   then 'en_espera'::public.estado_inscripcion
                   else 'confirmada'::public.estado_inscripcion end;

  v_consent_id := ((public.consentimiento_vigente())->>'id')::uuid;

  insert into public.inscripciones (
    actividad_id, nombre, cedula_cif, cedula_hash, cedula_mascara, email,
    telefono_cif, institucion, carrera, condicion, ciudad, modalidad,
    requiere_certificado, accesibilidad_cif, origen_difusion, estado,
    consentimiento_version_id, consent_tratamiento, consent_sensible,
    consent_imagen, consent_comunicaciones)
  values (
    a.id,
    v_cols->>'nombre',
    app.cifrar(v_cols->>'cedula'),
    v_hash,
    app.mascara_cedula(v_cols->>'cedula'),
    lower(coalesce(v_cols->>'email', 'sin-correo@unida.edu.py')),
    app.cifrar(v_cols->>'telefono'),
    v_cols->>'institucion',
    v_cols->>'carrera',
    coalesce(
      case lower(coalesce(v_cols->>'condicion',''))
        when 'estudiante' then 'estudiante' when 'docente' then 'docente'
        when 'egresado'   then 'egresado'   else 'externo' end
      ::public.condicion_participante, 'externo'),
    v_cols->>'ciudad',
    v_cols->>'modalidad',
    coalesce(lower(coalesce(v_cols->>'certificado','sí')) in ('sí','si','true','1'), true),
    app.cifrar(v_cols->>'accesibilidad'),
    v_cols->>'origen_difusion',
    v_estado,
    v_consent_id,
    true,
    coalesce((p_consentimientos->>'sensible')::boolean, false),
    -- El uso de imagen viaja dentro del consentimiento general (versión 1.0);
    -- se guarda por separado para poder revocarlo sin tocar la inscripción.
    coalesce((p_consentimientos->>'imagen')::boolean,
             coalesce((p_consentimientos->>'tratamiento')::boolean, false)),
    coalesce((p_consentimientos->>'comunicaciones')::boolean, false))
  returning id into v_id;

  -- Campos sin columna propia.
  insert into public.respuestas (inscripcion_id, campo_id, etiqueta, valor, valor_cif, sensible)
  select v_id,
         c->>'id',
         coalesce(c->>'etiqueta', 'Pregunta sin título'),
         case when coalesce((c->>'sensible')::boolean, false)
                or coalesce((c->>'cifrado')::boolean, false) then null
              else nullif(btrim(coalesce(p_respuestas ->> (c->>'id'), '')), '') end,
         case when coalesce((c->>'sensible')::boolean, false)
                or coalesce((c->>'cifrado')::boolean, false)
              then app.cifrar(nullif(btrim(coalesce(p_respuestas ->> (c->>'id'), '')), ''))
              else null end,
         coalesce((c->>'sensible')::boolean, false)
    from jsonb_array_elements(a.campos) c
   where nullif(c->>'mapa', '') is null
     and nullif(btrim(coalesce(p_respuestas ->> (c->>'id'), '')), '') is not null;

  insert into public.auditoria (accion, entidad, entidad_id, detalle)
  values ('alta_inscripcion', 'inscripciones', v_id,
          jsonb_build_object('actividad', a.id, 'estado', v_estado));

  return jsonb_build_object(
    'ok', true, 'estado', v_estado,
    'consentimiento_version', (public.consentimiento_vigente())->>'version',
    'consentido_en', now());
end $$;
grant execute on function public.inscribir(text, jsonb, jsonb) to anon, authenticated;

-- ── Registro de asistencia: /a/:token ──────────────────────────────────────────
create or replace function public.asistencia_contexto(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a public.actividades%rowtype; j public.jornadas%rowtype; v_hay boolean;
begin
  select * into a from public.actividades where token_asistencia = p_token;
  if not found then
    return jsonb_build_object('error', 'no_encontrada');
  end if;
  select * into j from public.jornadas
   where actividad_id = a.id and fecha = app.hoy();
  v_hay := found;
  return jsonb_build_object(
    'titulo', a.titulo,
    'hay_jornada', v_hay,
    'jornada', case when v_hay then j.numero else null end,
    'fecha', case when v_hay then j.fecha else null end);
end $$;
grant execute on function public.asistencia_contexto(text) to anon, authenticated;

create or replace function public.registrar_asistencia(
  p_token text, p_cedula text, p_codigo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.actividades%rowtype; j public.jornadas%rowtype;
  v_hash text; v_insc uuid; v_filas int; v_nuevo boolean;
begin
  select * into a from public.actividades where token_asistencia = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'El enlace no es válido o fue regenerado.');
  end if;

  select * into j from public.jornadas where actividad_id = a.id and fecha = app.hoy();
  if not found then
    return jsonb_build_object('ok', false, 'error',
      'Hoy no hay jornada activa para esta actividad.');
  end if;

  v_hash := app.hash_cedula(p_cedula);

  -- Cinco intentos por cédula y jornada: frena el tanteo del código de cuatro dígitos.
  if not app.limite('chk:' || j.id::text || ':' || v_hash, 5, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'error',
      'Demasiados intentos. Aguarde diez minutos o pida ayuda al docente responsable.');
  end if;

  if btrim(coalesce(p_codigo,'')) <> j.codigo_sala then
    return jsonb_build_object('ok', false, 'error',
      'El código no corresponde a la jornada de hoy.');
  end if;

  select i.id into v_insc from public.inscripciones i
   where i.actividad_id = a.id and i.cedula_hash = v_hash and i.estado <> 'anulada';
  if v_insc is null then
    return jsonb_build_object('ok', false, 'error',
      'Esa cédula no figura entre las inscripciones confirmadas.');
  end if;

  insert into public.asistencias (inscripcion_id, jornada_id)
  values (v_insc, j.id)
  on conflict (inscripcion_id, jornada_id) do nothing;
  get diagnostics v_filas = row_count;
  v_nuevo := v_filas > 0;

  return jsonb_build_object('ok', true, 'jornada', j.numero, 'ya_estaba', not v_nuevo,
    'mensaje', case when v_nuevo
      then 'Asistencia registrada para la jornada ' || j.numero || '.'
      else 'Su asistencia de la jornada ' || j.numero || ' ya estaba registrada.' end);
end $$;
grant execute on function public.registrar_asistencia(text, text, text) to anon, authenticated;

-- ── Derechos del titular: /derechos ────────────────────────────────────────────
create or replace function public.solicitar_derecho(
  p_tipo text, p_email text, p_detalle text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_tipo not in ('acceso','rectificacion','oposicion','supresion','portabilidad','revocacion') then
    return jsonb_build_object('ok', false, 'error', 'Tipo de solicitud no reconocido.');
  end if;
  if coalesce(p_email,'') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'error', 'Indique un correo electrónico válido.');
  end if;
  if not app.limite('der:' || lower(p_email), 5, interval '1 hour') then
    return jsonb_build_object('ok', false, 'error',
      'Ya registramos varias solicitudes con ese correo. Aguarde una hora.');
  end if;
  insert into public.solicitudes_derechos (tipo, email, detalle)
  values (p_tipo, lower(p_email), nullif(btrim(coalesce(p_detalle,'')), ''))
  returning id into v_id;
  insert into public.auditoria (accion, entidad, entidad_id, detalle)
  values ('solicitud_derecho', 'solicitudes_derechos', v_id, jsonb_build_object('tipo', p_tipo));
  return jsonb_build_object('ok', true, 'id', v_id,
    'plazo', 'treinta días corridos', 'vence_en', now() + interval '30 days');
end $$;
grant execute on function public.solicitar_derecho(text, text, text) to anon, authenticated;
