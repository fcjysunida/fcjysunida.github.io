-- El encolado va por disparador, no dentro de inscribir() ni de
-- emitir_certificados(): así ninguna falla del correo puede voltear el alta.

create or replace function app.tg_correo_inscripcion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform app.correo_inscripcion(new.id);
  exception when others then
    -- El correo es accesorio: si algo falla, la inscripción sigue siendo válida.
    insert into public.auditoria (accion, entidad, entidad_id, detalle)
    values ('correo_no_encolado', 'inscripciones', new.id,
            jsonb_build_object('error', sqlerrm));
  end;
  return null;
end $$;
create trigger correo_al_inscribir after insert on public.inscripciones
  for each row execute function app.tg_correo_inscripcion();

create or replace function app.tg_correo_certificado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform app.correo_certificado(new.id);
  exception when others then
    insert into public.auditoria (accion, entidad, entidad_id, detalle)
    values ('correo_no_encolado', 'certificados', new.id,
            jsonb_build_object('error', sqlerrm));
  end;
  return null;
end $$;
create trigger correo_al_emitir after insert on public.certificados
  for each row execute function app.tg_correo_certificado();;
