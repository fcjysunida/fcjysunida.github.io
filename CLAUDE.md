# Operación del sistema desde Claude Code

Este archivo es el contrato de trabajo para agentes. Leelo antes de tocar el repo.

## Reglas invariables

1. **Nunca** imprimas, loguees ni copies en un archivo el contenido descifrado de
   `inscripciones.cedula_cif`, `inscripciones.accesibilidad_cif`, `inscripciones.telefono_cif`
   ni de `respuestas.valor_cif`. Trabajá con `id`, con la máscara y con agregados.
2. Toda operación que lea o exporte datos identificables inserta una fila en `auditoria`.
   Las funciones ya lo hacen: no las esquives escribiendo SQL suelto.
3. `auditoria` es *append only*. Hay disparadores que rechazan `UPDATE` y `DELETE`.
   Si necesitás dejar constancia de algo, insertá una fila nueva.
4. No se crea ninguna actividad sin `tipo` de la tipología cerrada ni sin una versión vigente
   en `consentimiento_versiones`. El marco es la Ley N° 7593/2025.
5. El texto de consentimiento **no se corrige con `UPDATE`**: se inserta una versión nueva y
   se cierra la anterior con `vigente_hasta`. Las inscripciones ya registradas conservan la
   versión que su titular aceptó — es la prueba del consentimiento del artículo 6.°.
6. `SUPABASE_SERVICE_ROLE_KEY` no se commitea ni se usa desde el frontend. Solo lo usan
   `claves:inicializar` y `usuarios:alta`.
7. Las claves de cifrado viven en Supabase Vault. Se generan dentro de la base con
   `claves_inicializar()`. **Nunca** las leas ni las muestres: rotarlas invalida todo lo cifrado.
8. Cambios de esquema: migración nueva en `supabase/migrations`, jamás edición destructiva
   de una migración ya aplicada.
9. Al agregar una función al esquema `public`, revocá `execute` de `public, anon` salvo que
   deba ser llamable sin sesión. Postgres las crea abiertas; ya hay `alter default privileges`
   puesto, pero verificalo.

## Modelo de permisos

El navegador anónimo **no tiene permiso sobre ninguna tabla**. Solo puede invocar ocho
funciones: `consentimiento_vigente`, `actividad_por_token`, `inscribir`, `asistencia_contexto`,
`registrar_asistencia`, `evaluacion_pendiente`, `evaluar_actividad` y `solicitar_derecho`.

El panel entra con sesión y lee por vistas `security_invoker`, que respetan las políticas RLS.
Las escrituras pasan por funciones que verifican el rol y auditan.

| Rol | Ve inscriptos | Cédula | Sensibles | Exporta | Edita | Configura |
| --- | --- | --- | --- | --- | --- | --- |
| `admin` (Dirección) | Todas | Completa, con motivo | Sí | Sí, con cédula | Sí | Sí |
| `coordinacion` | Todas | Enmascarada | Agregados | Con motivo | Sí | Actividades |
| `docente` | Solo las suyas | Enmascarada | Solo las suyas | No | Asistencia | No |
| `secretaria` | Todas | Completa, con motivo | No | Con motivo | Sí | No |
| `auditor` | Todas | Enmascarada | No | No | No | No |

## Campos del formulario

`actividades.campos` es un arreglo ordenado en jsonb. Cada elemento:

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

`cifrado` y `sensible` son cosas distintas y no hay que confundirlas:

- **`cifrado`** — identificador que se guarda cifrado por minimización (cédula, teléfono).
  No activa ninguna casilla extra.
- **`sensible`** — dato del artículo 3.° numeral 7 (salud, accesibilidad). Implica cifrado,
  **exige el consentimiento expreso separado** del artículo 20 numeral 1 y se elimina antes
  que el resto en la retención.

Marcar la cédula como «sensible» obligaría a todo el mundo a firmar la casilla de datos
sensibles, que es exactamente lo que la ley quiere evitar.

`mapa` vuelca la respuesta a una columna propia de `inscripciones` (`nombre`, `cedula`, `email`,
`telefono`, `institucion`, `carrera`, `condicion`, `ciudad`, `modalidad`, `certificado`,
`accesibilidad`, `origen_difusion`). Sin `mapa`, la respuesta va a `respuestas` y no alimenta
ningún indicador. Los campos con `mapa: "nombre"` y `mapa: "cedula"` son imprescindibles.

## Módulos

| Módulo | Dónde | Qué hace |
| --- | --- | --- |
| Inscripción y asistencia | `/f/:token`, `/a/:token` | Formulario, check-in por jornada |
| Evaluación de satisfacción | dentro de `/a/:token` | ISO 10004: seis dimensiones, CSAT, NPS |
| Padrón académico | `/admin/padron` | Nómina por período; fija la condición verificada |
| Constancias | `/admin/certificados`, `/c/:codigo` | Emisión por lote y verificación pública |
| Proyectos de extensión | `/admin/proyectos` | Formatos oficiales 9 y 10, exportación en Word |
| Correo | `/admin/ajustes` | Cola con tope diario; Resend |

## Tareas frecuentes

### Crear una actividad y su formulario
```
npm run cli -- actividad:crear \
  --titulo "Taller de Seguridad Digital" \
  --tipo extension --inicio 2026-09-15 --dias 2 \
  --modalidad hibrida --cupo 120 --horas 8 \
  --lugar "Aula Magna FCJYS UNIDA"
```
Devuelve el enlace de inscripción `/f/:token`, el enlace único de asistencia `/a/:token` y
los códigos de sala por jornada. Para ajustar los campos, el constructor del panel
(`/admin/nueva`) es más cómodo.

### Regenerar enlace o códigos
```
npm run cli -- actividad:regenerar-enlace --id <uuid>      # invalida el anterior y rota todo
npm run cli -- actividad:regenerar-codigo --id <uuid> --dia 2
```

### Inscripciones
```
npm run cli -- inscripciones:listar --actividad <uuid>       # cédula enmascarada
npm run cli -- inscripciones:editar --id <uuid> --campo estado --valor anulada
npm run cli -- inscripciones:exportar --actividad <uuid> --motivo "certificación"
```
La exportación exige `--motivo`: se guarda en auditoría. Nace sin cédula; `--con-cedula` solo
lo admite la Dirección.

### Calidad percibida
```
npm run cli -- calidad:ver --actividad <uuid>
```
CSAT (respuestas 4 y 5 sobre el total), NPS (promotores menos detractores) y promedio por
dimensión. Instrumento según ISO 10004:2018 y requisito 9.1.2 de ISO 9001:2015.

### Informe mensual DTC
```
npm run cli -- informe:dtc --mes 2026-08 --docente "Nombre Apellido" --formato docx
```
Genera el documento con los bloques 1 a 8 del formulario oficial. Los bloques 1, 7 y 8 quedan
preparados para completar a mano; el resto se calcula.

### Padrón académico
```
npm run cli -- periodo:crear --codigo 2025-1 --desde 2025-01-01 --hasta 2025-07-31
npm run cli -- padron:importar --archivo "alumnos de derecho.XLS" --periodo 2025-1 --dry-run
npm run cli -- padron:importar --archivo "alumnos de derecho.XLS" --periodo 2025-1
```
Lee `.XLS` (BIFF2, el que exporta el sistema académico), `.xlsx` y `.csv`. Reimportar el
mismo período actualiza en vez de duplicar: la clave es (período, cédula). No se importan
correos ni teléfonos: no hacen falta para clasificar. Ver `docs/PADRON.md`.

### Constancias
```
npm run cli -- certificados:emitir --actividad <uuid> --minimo 1 --dry-run
npm run cli -- certificados:emitir --actividad <uuid>
```
Las plantillas usan etiquetas `<<Etiqueta>>`, la misma sintaxis de Autocrat. Cada constancia
lleva un código verificable en `/c/:codigo` y congela nombre, fecha y horas.

### Proyectos de extensión
```
npm run cli -- proyecto:exportar --id <uuid>                        # formato 9
npm run cli -- proyecto:exportar --id <uuid> --informe <uuid>       # formato 10
```

### Retención
```
npm run cli -- retencion:aplicar --dry-run     # lista lo que se anonimizaría
npm run cli -- retencion:aplicar               # ejecuta y audita
```
Además corre sola el día 1 de cada mes por `pg_cron`.

## Convenciones de código

- TypeScript estricto, sin `any`. El build corre `tsc -b` antes de Vite.
- Acceso a datos solo por `src/data/publico.ts` (anónimo) y `src/data/panel.ts` (con sesión).
  Nada de consultas sueltas en los componentes.
- Estilos: los tokens de `src/ui/estilos.css`, en el registro editorial del prototipo —
  Spectral para títulos, Archivo para interfaz, rojo `#ec3013`, sin esquinas redondeadas,
  reglas finas y ausencia de mayúsculas decorativas. Fotografías siempre en blanco y negro.
- Todo texto de cara al público en español, registro institucional formal, y en las rutas
  públicas se trata de usted.
- Los datos institucionales (correo, responsable, dominio) viven en `src/lib/institucion.ts`.
  No los repitas en los componentes.
