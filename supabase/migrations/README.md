# Migraciones

El historial autoritativo vive en el proyecto Supabase `fcjysunida`
(`mpsajgoycmmciobnnmjy`, región São Paulo).

```
supabase link --project-ref mpsajgoycmmciobnnmjy
supabase db pull        # trae al repositorio todo lo aplicado
supabase db push        # aplica lo que falte
```

## Estado

Los archivos `2026082700xx_*.sql` de esta carpeta cubren el núcleo del sistema:
esquema, RLS, cifrado, funciones públicas, evaluación de satisfacción,
indicadores, consentimiento, endurecimiento de permisos, claves y tareas.

**Aplicadas en el proyecto y todavía no volcadas acá** (se traen con
`supabase db pull`):

| Migración | Qué trae |
| --- | --- |
| `padron_academico` | Períodos, padrón, `condicion_verificada()`, columnas nuevas en inscripciones |
| `padron_importacion_y_cruce` | `padron_importar()`, `recruzar_padron()`, `padron_resumen()` |
| `inscribir_cruza_padron` | `inscribir()` verifica la condición contra el padrón |
| `certificados` | Plantillas, emisión por lote, código de verificación, anulación |
| `plantillas_certificado_iniciales` | Las dos plantillas calcadas de Autocrat |
| `proyectos_extension` | Proyectos, participantes, informes, escala de horas del anexo |
| `cola_de_correo` | Cola, lote con tope diario, resultado y reintentos |
| `configuracion_y_cron_correo` | Tabla de configuración y disparo por `pg_cron` + `pg_net` |
| `correos_de_sistema` | Confirmación, constancia y recordatorio de jornada |
| `disparadores_de_correo` | Encolado por disparador, aislado de la operación |
| `app_es_no_devuelve_null` | **Corrección de autorización**, ver abajo |
| `certificados_fecha_es_y_plantilla` | Mes en español y elección correcta de plantilla |
| `clave_servicio_en_vault` | `clave_servicio_guardar()` para la tarea de correo |
| `gestion_de_usuarios` | Alta, cambio de rol y baja de cuentas del panel |
| `padron_documentos_extranjeros` | El padrón acepta documentos que no son cédula paraguaya |
| `padron_vinculo_por_matricula` | Cruce por matrícula cuando no hay documento |
| `cruce_reconoce_egresados_por_matricula` | Egresados identificados por matrícula |
| `proyectos_importar_memorias` | Carga de las memorias institucionales 2021-2025 |
| `enriquecer_proyectos` | Texto completo de los PDF de memoria sobre cada proyecto |
| `participantes_de_proyecto` | Nómina por proyecto y desglose por condición |
| `participantes_altas_y_desglose` | `proyecto_participantes_agregar()` y verificación por período |
| `registro_de_docentes` | Registro de docentes responsables, cátedra y correo |
| `proyecto_desde_formato_oficial` | `proyecto_desde_formato()` para los formatos 9 y 10 |
| `aviso_certificados_con_autorizacion` | El aviso de constancia exige autorización previa |
| `docentes_normalizar_nombre` | Normaliza tratamientos al registrar un docente |
| `participantes_sin_documento_no_duplican` | Deduplica por nombre cuando no hay documento |
| `certificados_imprimibles` | `certificados_imprimibles()` para la impresión por lote |
| `carga_manual_derecho_en_un_minuto` | Proyecto cuyo informe llegó en prosa, no en el formato oficial |
| `carga_manual_workshop_chake_la_cita` | Alta de docentes del workshop de citación |
| `enriquecer_chake_la_cita_con_formato_9` | Formato 9 del workshop sobre el registro de la memoria |
| `horas_de_extension_por_persona` | Tabla `horas_extension` y meta de horas de la carrera |
| `vista_extension_por_persona` | Vista `extension_personas`: horas respaldadas frente a históricas |
| `meta_horas_configurable_y_escala_en_proyectos` | Meta en `configuracion` y escala del anexo aplicada a los proyectos |
| `acreditacion_de_horas_de_extension` | `horas_extension_agregar()` y acreditación por egreso |
| `exploracion_de_horas_por_periodo` | `extension_resumen()` y `extension_nomina()` |
| `acreditar_egresados_cohortes_2020_2021` | 693 horas acreditadas a 21 egresados |
| `periodos_disponibles_incluye_proyectos` | El selector de período abarca desde 2021 |
| `indicadores_incluyen_proyectos` | Los indicadores cuentan los proyectos, no solo las actividades |
| `cerrar_cuentas_de_servicio_y_de_prueba` | Cierre de las cuentas que no son personas reales |

## Reglas

- Nunca se edita una migración ya aplicada: se agrega una nueva.
- El texto de consentimiento no se corrige con `UPDATE`: se inserta una versión
  nueva y se cierra la anterior con `vigente_hasta`.
- Las claves de cifrado viven en Supabase Vault (`fcjys_cifrado_clave`,
  `fcjys_cedula_pepper`) y no aparecen en ningún archivo.
- Al agregar una función a `public`, revocar `execute` de `public, anon` salvo
  que deba ser llamable sin sesión.

## Sobre `app_es_no_devuelve_null`

`app.es()` era `select public.rol_actual() = any(p_roles)`. Cuando `rol_actual()`
es NULL —sesión sin fila en `usuarios`, o usuario desactivado— la comparación da
NULL, y en plpgsql `if not NULL then raise exception ... end if` **no entra al
cuerpo**. Todos los controles escritos así se salteaban en silencio.

Las políticas RLS no estaban afectadas (allí NULL se trata como falso) y `anon`
no tiene `execute` sobre esas funciones, pero cualquier cuenta autenticada sin
rol asignado podía crear actividades, emitir constancias, exportar y aplicar la
retención. La corrección es `coalesce(..., false)`.

## Divergencia conocida

`separar_cifrado_de_sensible` está aplicada en el proyecto pero su contenido se
incorporó a `…000100_esquema_base.sql` y `…000400_funciones_publicas.sql`, de
modo que un `db push` sobre una base vacía produce el mismo estado.
