# Mapeo al Informe Mensual de Extensión y Vinculación (DTC)

El panel de estadísticas replica los bloques del formulario oficial. Cada indicador se calcula
con `public.indicadores(periodo)`; solo dos se cargan a mano.

Exportación: `npm run cli -- informe:dtc --mes 2026-08 --docente "Nombre Apellido" --formato docx`
(también `md` y `csv`), o el botón «Exportar indicadores» del panel.

## 1. Datos generales
Docente, facultad y período: se toman del argumento `--docente` y del período seleccionado.
La exportación DOCX deja el bloque armado.

## 2. Actividades realizadas
| Indicador | Cálculo |
| --- | --- |
| Actividades ejecutadas | Actividades con `fecha_inicio` en el mes |
| Participantes alcanzados | Asistencias registradas en el mes |
| Horas de extensión desarrolladas | Suma de `horas_academicas` de tipos `extension` y `proyecto_extension` |
| Cobertura territorial | Ciudades distintas entre los inscriptos no anulados |

## 3. Proyectos de extensión
| Indicador | Cálculo |
| --- | --- |
| Proyectos ejecutados | Actividades de tipo `proyecto_extension` |
| Proyectos finalizados | Los anteriores con estado `finalizada` |
| Beneficiarios directos | Asistencias en actividades de extensión |
| Beneficiarios indirectos | Suma de `alcance_estimado` en `difusiones` |

## 4. Vinculación institucional
| Indicador | Cálculo |
| --- | --- |
| Instituciones vinculadas | Instituciones distintas declaradas por inscriptos |
| Actividades conjuntas | Actividades de tipo `vinculacion` |
| Convenios apoyados | *manual* — `indicadores_manuales`, clave `convenios_apoyados` |
| Nuevas alianzas generadas | *manual* — `indicadores_manuales`, clave `nuevas_alianzas` |

Los dos manuales se cargan así:

```sql
insert into indicadores_manuales (periodo, clave, valor, nota)
values ('2026-08', 'convenios_apoyados', 2, 'Convenio con el Ministerio Público')
on conflict (periodo, clave) do update set valor = excluded.valor;
```

## 5. Participación estudiantil
| Indicador | Cálculo |
| --- | --- |
| Estudiantes participantes | Inscriptos con condición `estudiante` |
| Carreras involucradas | Suma de `carreras_involucradas` de las actividades del mes |
| Horas de participación estudiantil | Horas de la actividad por cada asistencia estudiantil |
| Actividades con participación estudiantil | Actividades con al menos un inscripto estudiante |

## 6. Impacto alcanzado
| Indicador | Cálculo |
| --- | --- |
| Beneficiarios totales | Asistencias del mes |
| Instituciones beneficiadas | Suma de `instituciones_vinculadas` |
| Actividades difundidas | Suma de `publicaciones` en `difusiones` |
| Alcance en medios y redes | Suma de `alcance_estimado` |
| Nivel de satisfacción (CSAT) | Respuestas de 4 y 5 en la valoración general, sobre el total |
| Recomendación neta (NPS) | Promotores (9-10) menos detractores (0-6), en puntos |
| Valoración media | Promedio de las seis dimensiones, de 1 a 5 |
| Evaluaciones recibidas | Cantidad de respuestas a la encuesta |

### El instrumento de satisfacción

Sigue la **ISO 10004:2018** (seguimiento y medición de la satisfacción) y el requisito **9.1.2
de la ISO 9001:2015**. Seis dimensiones en escala Likert de cinco puntos:

1. Pertinencia y calidad del contenido
2. Desempeño de quien expuso
3. Organización y cumplimiento de los horarios
4. Materiales, recursos y ambiente
5. Utilidad y aplicabilidad de lo aprendido
6. Satisfacción general — es la que alimenta el CSAT

Más una pregunta de recomendación de 0 a 10 (NPS) y un comentario libre opcional.

- **CSAT** se calcula con el criterio estándar de *dos cajas superiores*: porcentaje de
  respuestas 4 o 5 en la dimensión 6.
- **NPS** = % promotores (9-10) − % detractores (0-6). Va de −100 a +100 y se informa en puntos,
  no en porcentaje.
- La **tasa de respuesta** (evaluaciones sobre asistencias) se muestra en la pestaña Calidad:
  sin ella, un CSAT alto sobre tres respuestas no dice nada.

Se responde una sola vez por persona y actividad, solo después de registrar asistencia, desde
el mismo enlace `/a/:token`. Es voluntaria.

## 7. Resumen ejecutivo
Campo libre: logros, dificultades y acciones de mejora. La exportación deja el bloque preparado
con los tres subtítulos y, cuando hay encuesta, un párrafo con CSAT, NPS y valoración media.

## 8. Evidencias anexadas
Listas de asistencia por jornada exportadas desde el panel, capturas de difusión y certificados
emitidos.
