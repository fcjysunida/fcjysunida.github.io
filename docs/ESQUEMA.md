# Esquema

El esquema autoritativo son las migraciones de `supabase/migrations`, aplicadas al proyecto
`fcjysunida` (`mpsajgoycmmciobnnmjy`). Este archivo es el mapa; el detalle está en el SQL.

| Migración | Qué trae |
| --- | --- |
| `…000100_esquema_base` | Tipos, tablas, índices |
| `…000200_cifrado_y_roles` | Vault, cifrado de columna, HMAC de cédula, rol de sesión, auditoría inmutable |
| `…000300_rls` | Políticas de fila por rol |
| `…000400_funciones_publicas` | Las funciones que puede llamar un visitante anónimo |
| `…000500_operacion` | Crear actividad, regenerar enlaces y códigos, exportar, cerrar |
| `…000600_evaluacion_satisfaccion` | Encuesta ISO 10004, agregados y comentarios sin identidad |
| `…000700_vistas_e_indicadores` | Vistas del panel e `indicadores(periodo)` |
| `…000800_consentimiento_v1` | Texto de consentimiento versión 1.0 |
| `…000900_endurecer_superficie_rpc` | Revoca `execute` a `anon` salvo en las ocho públicas |
| `…001000_claves_y_tareas` | `claves_inicializar()` y las tareas de `pg_cron` |
| `…001100_cerrar_tablas_a_anon` | Revoca las tablas a `anon` y fija los privilegios por defecto |

## Tablas

| Tabla | Para qué |
| --- | --- |
| `usuarios` | Personas del panel, con su rol. Cuelga de `auth.users` |
| `consentimiento_versiones` | Textos versionados. Nunca se actualizan: se agrega una versión |
| `actividades` | La actividad, sus tokens y la definición de campos (jsonb) |
| `jornadas` | Una por día, con su código de sala de cuatro dígitos |
| `inscripciones` | Columnas propias; cédula, teléfono y accesibilidad cifrados |
| `respuestas` | Respuestas a campos sin columna propia |
| `asistencias` | `unique (inscripcion_id, jornada_id)`: no hay doble registro |
| `evaluaciones` | Encuesta de satisfacción, `unique (inscripcion_id)` |
| `difusiones` | Publicaciones y alcance, para el bloque 6 |
| `indicadores_manuales` | Los dos indicadores que no se calculan |
| `auditoria` | *Append only*, con disparadores que rechazan `UPDATE` y `DELETE` |
| `solicitudes_derechos` | Ejercicio de derechos, con `vence_en` a treinta días |
| `limites_tasa` | Contador del límite de tasa. Sin acceso desde ningún cliente |

## Vistas

`actividades_resumen`, `inscripciones_panel` y `jornadas_panel`, todas con
`security_invoker = on`: respetan las políticas RLS de quien consulta. `inscripciones_panel`
expone `cedula_mascara`, nunca el valor cifrado.

## Definición de un campo

```json
{
  "id": "c7f3a1",
  "tipo": "texto|parrafo|email|tel|cedula|numero|fecha|unica|casillas|lista|escala|archivo",
  "etiqueta": "Nombre y apellido",
  "ayuda": "Tal como debe figurar en el certificado",
  "obligatorio": true,
  "cifrado": false,
  "sensible": false,
  "opciones": ["Estudiante", "Docente"],
  "mapa": "nombre"
}
```

`cifrado` guarda el valor cifrado por minimización. `sensible` implica cifrado y además exige
el consentimiento expreso separado del artículo 20 numeral 1 y el borrado anticipado.
`mapa` vuelca la respuesta a una columna propia de `inscripciones`; sin `mapa` va a
`respuestas` y no alimenta ningún indicador.
