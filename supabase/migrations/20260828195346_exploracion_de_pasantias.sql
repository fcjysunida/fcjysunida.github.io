create or replace function pasantias_resumen()
returns table (
  periodo text, condicion text, personas bigint, cumplen bigint,
  sin_registro bigint, en_curso bigint, convalidadas bigint, observadas bigint
)
language sql stable security definer set search_path to '' as $$
  select pp.periodo, pp.condicion::text, count(*),
         count(*) filter (where pp.cumple),
         count(*) filter (where pp.pasantia_id is null),
         count(*) filter (where pp.estado in ('inscrita', 'en_curso', 'informe_pendiente')),
         count(*) filter (where pp.estado = 'convalidada'),
         count(*) filter (where pp.estado = 'informe_observado'
                             or pp.subsanacion_vencida or pp.conformidad_vencida
                             or pp.informe_fuera_de_plazo)
    from public.pasantias_personas pp
   where app.es('admin', 'coordinacion', 'secretaria', 'auditor')
   group by 1, 2 order by 1 desc, 2
$$;

create or replace function pasantias_nomina(
  p_periodo    text default null,
  p_condicion  text default null,
  p_texto      text default null,
  p_solo_deuda boolean default false,
  p_limite     int default 300
)
returns table (
  padron_id uuid, pasantia_id uuid, nombre text, cedula_mascara text,
  matricula text, cohorte text, carrera text, condicion text, periodo text,
  modalidad text, estado text, organizacion text, con_convenio boolean,
  horas numeric, horas_faltantes numeric, nota_final numeric,
  ficha_recibida boolean, informe_presentado_en date,
  informe_fuera_de_plazo boolean, subsanacion_vencida boolean,
  conformidad_vencida boolean, cumple boolean
)
language sql stable security definer set search_path to '' as $$
  select (select pa.id from public.padron pa
           where (pa.cedula_hash is not null and pa.cedula_hash = pp.cedula_hash)
              or (pa.cedula_hash is null and pa.matricula = pp.matricula)
           order by pa.periodo desc limit 1),
         pp.pasantia_id, pp.nombre, pp.cedula_mascara, pp.matricula, pp.cohorte,
         pp.carrera, pp.condicion::text, pp.periodo,
         pp.modalidad::text, pp.estado::text, pp.organizacion, pp.con_convenio,
         pp.horas, pp.horas_faltantes, pp.nota_final, pp.ficha_recibida,
         pp.informe_presentado_en, pp.informe_fuera_de_plazo,
         pp.subsanacion_vencida, pp.conformidad_vencida, pp.cumple
    from public.pasantias_personas pp
   where app.es('admin', 'coordinacion', 'secretaria', 'auditor')
     and (p_periodo   is null or pp.periodo = p_periodo)
     and (p_condicion is null or pp.condicion::text = p_condicion)
     and (p_solo_deuda is not true or not pp.cumple)
     and (coalesce(btrim(p_texto), '') = ''
          or public.unaccent_simple(lower(pp.nombre))
             like '%' || public.unaccent_simple(lower(btrim(p_texto))) || '%'
          or pp.matricula like btrim(p_texto) || '%')
   order by pp.cumple, pp.horas desc, pp.nombre
   limit greatest(1, least(coalesce(p_limite, 300), 1000))
$$;

revoke execute on function pasantias_resumen() from public, anon;
revoke execute on function pasantias_nomina(text, text, text, boolean, int) from public, anon;
grant execute on function pasantias_resumen() to authenticated;
grant execute on function pasantias_nomina(text, text, text, boolean, int) to authenticated;;
