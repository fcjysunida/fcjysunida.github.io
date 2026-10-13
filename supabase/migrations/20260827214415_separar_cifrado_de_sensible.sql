-- Un campo puede cifrarse por minimización (cédula, teléfono) sin ser sensible
-- en el sentido del art. 3.° num. 7. Solo `sensible` activa el consentimiento
-- expreso separado del art. 20 num. 1 y el borrado anticipado.
--   cifrado  = se guarda cifrado en columna
--   sensible = dato sensible; implica cifrado + consentimiento expreso
-- Marcar la cédula como «sensible» obligaría a todo el mundo a firmar la casilla
-- de datos sensibles, que es justamente lo que la ley quiere evitar.

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
    (case lower(coalesce(v_cols->>'condicion',''))
       when 'estudiante' then 'estudiante' when 'docente' then 'docente'
       when 'egresado'   then 'egresado'   else 'externo' end
    )::public.condicion_participante,
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

  -- Campos personalizados. Se cifran los marcados `cifrado` o `sensible`.
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

-- La restricción de respuestas debe permitir «cifrado sin ser sensible».
alter table public.respuestas drop constraint respuesta_sensible_cifrada;
alter table public.respuestas add constraint respuesta_una_sola_forma
  check (valor is null or valor_cif is null);;
