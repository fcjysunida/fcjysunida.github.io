# Padrón académico y clasificación de participantes

## Para qué

El informe DTC pide separar estudiantes, egresados y externos. Si eso depende de
lo que cada persona marca en el formulario, el indicador no vale nada: mucha
gente elige «externo» por descuido, o «estudiante» cuando ya egresó.

El padrón resuelve eso. Es la nómina oficial por período; al recibir una
inscripción, el sistema busca la cédula y fija la condición efectiva.

## Cómo decide

En este orden:

1. Si figura como **estudiante en el período de la actividad** → estudiante.
2. Si la persona declaró **docente** → docente (un docente puede además ser egresado).
3. Si figura como **egresado** en cualquier período → egresado.
4. Si figura como **estudiante** en otro período → estudiante.
5. Si **no figura** → lo que declaró.

La inscripción guarda las dos cosas: `condicion_declarada` (lo que la persona
eligió, sin tocar) y `condicion` (la efectiva), más `condicion_origen`, que
explica en una frase por qué es la que es. El panel muestra un ✓ junto a las
verificadas y, debajo, lo que la persona había declarado cuando difiere.

## Por qué el cruce no descifra nada

El padrón guarda `cedula_hash`, el mismo HMAC que usa el registro de asistencia.
El cruce compara hashes. La cédula en claro no aparece en ninguna consulta, y una
filtración de la base no revela cédulas sin la clave de la bóveda.

Los correos y teléfonos de las planillas **no se importan**: no hacen falta para
clasificar, y el principio de minimización dice que lo que no hace falta no se
guarda. Como la cédula es el vínculo estable, que la persona cambie de correo o
de celular con los años no rompe nada.

## Formato de las planillas

El sistema académico exporta un `.XLS` que en realidad es BIFF2 (Excel 2.1), con
95 columnas. El importador lo detecta y usa el mapeo exacto:

| Columna del sistema | Va a |
| --- | --- |
| `persona_ape_paterno` + `persona_ape_materno` + `persona_nombre` | `nombre` |
| `p_ndoc_identidad` | cédula (se cifra y se convierte en HMAC) |
| `p_gdoc_identidad` | filtro: solo se importan cédulas de identidad |
| `cingreso` | `matricula` |
| `scarrera` | `carrera` |
| `periodo_sigla` | control del período |

No se usa `dpersona` porque viene truncado. Si la planilla tiene otro formato, el
importador detecta los encabezados por palabra clave (`nombre`, `cédula`,
`matrícula`, `carrera`, `ciclo`/`semestre`/`curso`) y, si aun así falla, se le
indican las columnas a mano con `--col-nombre N --col-cedula N`.

## Uso

```bash
npm run cli -- periodo:crear --codigo 2025-1 --desde 2025-01-01 --hasta 2025-07-31
npm run cli -- padron:importar --archivo "alumnos de derecho.XLS" --periodo 2025-1 --dry-run
npm run cli -- padron:importar --archivo "alumnos de derecho.XLS" --periodo 2025-1
npm run cli -- padron:importar --archivo egresados-2024.xlsx --periodo 2024-2 --condicion egresado
```

`--dry-run` muestra cuántas filas reconoció, con qué columnas y una fila de
muestra con la cédula enmascarada, sin cargar nada.

Reimportar el mismo período **actualiza**: la clave es (período, cédula). Por eso
se puede volver a subir una planilla corregida sin duplicar a nadie.

Después de cada importación se recruza automáticamente todo lo ya inscripto. Para
correrlo a mano: `npm run cli -- padron:recruzar`.

## Desde el panel

`/admin/padron` permite crear períodos y pegar filas desde Excel o Sheets para
cargas chicas. Para varios años de planillas conviene la línea de comandos, que
lee el `.XLS` directamente.
