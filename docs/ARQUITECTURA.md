# Arquitectura

## Stack

| Capa | Elección | Por qué |
| --- | --- | --- |
| Frontend | Vite + React + TypeScript, build estático | Se publica gratis en GitHub Pages |
| Hosting | GitHub Pages | Gratuito, HTTPS, dominio con las siglas |
| Datos y auth | Supabase (Postgres 17, Auth, RLS, Vault) | Plan gratuito, RLS por fila, cifrado en reposo |
| Lógica de servidor | Funciones `SECURITY DEFINER` en el propio Postgres | Menos piezas, menos superficie, todo transaccional |
| Tareas programadas | `pg_cron` dentro de la base | Retención y purga sin infraestructura extra |
| CI/CD | GitHub Actions | Build y publicación en cada push a `main` |

Proyecto Supabase: `fcjysunida` (`mpsajgoycmmciobnnmjy`), región São Paulo (`sa-east-1`).
Dato del registro de actividades de tratamiento: **no hay transferencia internacional** fuera
de las excepciones del artículo 19.

## Por qué funciones de base y no Edge Functions

La especificación original preveía Edge Functions en Deno para el alta, el check-in y la
exportación. Se resolvió con funciones `SECURITY DEFINER` en Postgres porque:

- **Menos superficie.** No hay un segundo runtime, ni una segunda clave, ni un segundo lugar
  donde pueda filtrarse el `service_role`.
- **Transaccionalidad real.** Validar cupo, consentimiento y unicidad de cédula e insertar
  ocurre en una sola transacción. Con una función externa habría carreras.
- **El cifrado no sale de la base.** La clave del Vault se lee dentro del mismo proceso que
  cifra; nunca viaja a un runtime intermedio.
- **La auditoría no se puede saltear.** Está en la misma función que hace la operación.

Si más adelante hace falta enviar correos (confirmaciones, certificados), eso sí pide una
Edge Function o un webhook: es la única pieza que no puede vivir en Postgres.

## Superficie pública

El navegador anónimo **no tiene permiso sobre ninguna tabla ni vista**. Se le concedió
`execute` sobre exactamente ocho funciones:

| Función | Para qué |
| --- | --- |
| `consentimiento_vigente()` | Texto y versión del consentimiento |
| `actividad_por_token(token)` | Datos públicos de la actividad y sus campos |
| `inscribir(token, respuestas, consentimientos)` | Alta validada |
| `asistencia_contexto(token)` | ¿Hay jornada hoy? ¿cuál? |
| `registrar_asistencia(token, cédula, código)` | Check-in |
| `evaluacion_pendiente(token, cédula)` | ¿Corresponde ofrecer la encuesta? |
| `evaluar_actividad(token, cédula, respuestas)` | Encuesta de satisfacción |
| `solicitar_derecho(tipo, correo, detalle)` | Ejercicio de derechos |

Cualquier otra llamada devuelve `42501 permission denied`. Hay un
`alter default privileges` puesto para que ninguna tabla ni función futura nazca abierta.

## Rutas

| Ruta | Qué es | Acceso |
| --- | --- | --- |
| `/f/:token` | Formulario de inscripción | Público, sin cuenta |
| `/a/:token` | Asistencia del día y evaluación | Público, sin cuenta |
| `/privacidad` | Política de tratamiento de datos | Público |
| `/derechos` | Solicitud de acceso, rectificación y demás | Público |
| `/admin` | Panel | Requiere sesión y rol |

GitHub Pages no conoce las rutas del cliente: el build copia `index.html` a `404.html`, de modo
que abrir `/f/:token` directamente funciona.

## Flujo de inscripción

1. El formulario lee `actividad_por_token` y arma los campos desde `actividades.campos` (jsonb).
2. Al enviar, `inscribir()` recorre **los campos declarados en la actividad**, no lo que mandó
   el cliente: los pares sobrantes se descartan.
3. Valida obligatorios, consentimiento general, consentimiento expreso si hay algún campo
   `sensible` con contenido, unicidad de cédula y cupo.
4. Cifra cédula, teléfono y sensibles; calcula el HMAC de la cédula y guarda la máscara.
5. Inserta la inscripción, las respuestas libres y la fila de auditoría, todo en una transacción.

## Flujo de asistencia (un enlace, código por día)

1. La actividad tiene **un** `token_asistencia`. El enlace `/a/:token` se reparte una sola vez.
2. Cada jornada tiene su fila en `jornadas` con `codigo_sala` de cuatro dígitos.
3. Al abrir el enlace, la base resuelve **qué jornada corresponde a hoy** en hora de Asunción;
   si no hay jornada para la fecha, responde «sin jornada activa» y no acepta registros.
4. La persona ingresa cédula y código. Se compara el HMAC de la cédula contra los inscriptos:
   **no se descifra nada** para tomar asistencia.
5. Cinco intentos por cédula y jornada; después, diez minutos de espera. Es lo que impide
   tantear un código de cuatro dígitos.
6. Se registra `asistencias(inscripcion_id, jornada_id)`. Único por par: no hay doble registro.
7. Regenerar el enlace cambia `token_asistencia` y **rota todos los códigos**.

## Flujo de la encuesta

Después de registrar la presencia, `evaluacion_pendiente` decide si ofrecerla: solo a quien
asistió y no respondió todavía. `evaluar_actividad` guarda seis valoraciones Likert, el NPS y
un comentario libre, con `unique (inscripcion_id)`. El panel accede a agregados
(`satisfaccion_de`) y a comentarios sin identidad ni orden cronológico (`comentarios_de`).

## Flujo del informe DTC

`actividades` + `inscripciones` + `asistencias` + `evaluaciones` + `difusiones` →
`indicadores(periodo)` → panel de estadísticas → exportación DOCX, Markdown o CSV con la
estructura del formulario oficial. Ver `INFORME_DTC.md`.
