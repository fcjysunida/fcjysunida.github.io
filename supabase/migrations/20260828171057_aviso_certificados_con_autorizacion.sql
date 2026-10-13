-- El aviso de constancia deja de salir solo al emitir. Emitir y avisar son dos
-- decisiones distintas: se puede emitir un lote, revisarlo, corregir un nombre
-- mal escrito y recién entonces avisar. Un correo con una constancia mal emitida
-- no se puede desenviar.

drop trigger if exists correo_al_emitir on public.certificados;

alter table public.certificados
  add column aviso_enviado_en timestamptz,
  add column aviso_autorizado_por uuid references public.usuarios(id);

comment on column public.certificados.aviso_enviado_en is
  'Cuándo se encoló el aviso. Nulo mientras nadie lo haya autorizado.';

create or replace function public.avisar_certificados(
  p_actividad uuid, p_solo_simulacion boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r record; v_n int := 0; v_ya int := 0; v_sin_correo int := 0;
begin
  if not app.es('admin','coordinacion','secretaria') then
    raise exception 'Su rol no envía avisos de constancias.';
  end if;

  for r in
    select c.id, i.email::text as email, c.aviso_enviado_en
      from public.certificados c
      join public.inscripciones i on i.id = c.inscripcion_id
     where c.actividad_id = p_actividad and c.anulado_en is null
  loop
    if r.aviso_enviado_en is not null then v_ya := v_ya + 1; continue; end if;
    if r.email is null or r.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
       or r.email like 'anonimo+%' or r.email like 'sin-correo@%' then
      v_sin_correo := v_sin_correo + 1; continue;
    end if;
    v_n := v_n + 1;
    if p_solo_simulacion then continue; end if;

    perform app.correo_certificado(r.id);
    update public.certificados
       set aviso_enviado_en = now(), aviso_autorizado_por = auth.uid()
     where id = r.id;
  end loop;

  if not p_solo_simulacion then
    perform public.auditar('aviso_certificados', 'actividades', p_actividad, null,
      jsonb_build_object('encolados', v_n, 'ya_avisados', v_ya, 'sin_correo', v_sin_correo));
  end if;

  return jsonb_build_object('ok', true, 'simulacion', p_solo_simulacion,
    'a_enviar', v_n, 'ya_avisados', v_ya, 'sin_correo_valido', v_sin_correo);
end $$;
revoke execute on function public.avisar_certificados(uuid, boolean) from public, anon;
grant  execute on function public.avisar_certificados(uuid, boolean) to authenticated;

drop function if exists public.certificados_de(uuid);
create function public.certificados_de(p_actividad uuid)
returns table (id uuid, codigo text, nombre text, rol public.rol_certificado,
               horas numeric, jornadas smallint, emitido_en timestamptz,
               anulado_en timestamptz, email text, aviso_enviado_en timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.codigo, c.nombre, c.rol, c.horas, c.jornadas,
         c.emitido_en, c.anulado_en, i.email::text, c.aviso_enviado_en
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
