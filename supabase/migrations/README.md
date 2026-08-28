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
