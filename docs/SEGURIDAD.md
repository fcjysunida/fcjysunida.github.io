# Protección de datos y seguridad

Marco aplicable: **Ley N° 7593/2025 «De Protección de Datos Personales en la República del
Paraguay»**, la garantía constitucional de habeas data del artículo 135 de la Constitución
Nacional y, de modo supletorio para datos crediticios, la Ley N° 6534/2020.

- **Responsable del tratamiento:** Abg. Patricia Sequeira — `extensionderecho@unida.edu.py`
- **Autoridad de control:** Agencia Nacional de Protección de Datos Personales (art. 34)
- **Alojamiento:** Supabase, región São Paulo. Sin transferencia internacional fuera de las
  excepciones del artículo 19.

## 1. Bases legales y principios

| Exigencia legal | Cómo se cumple |
| --- | --- |
| Base legal del tratamiento (art. 5.° num. 1) | Consentimiento del titular, declarado en el formulario |
| Consentimiento previo, libre, informado e inequívoco (art. 6.°) | Casillas sin premarcar, con el aviso del art. 27 accesible antes de enviar |
| Prueba del consentimiento a cargo del responsable (art. 6.°) | `consentimiento_version_id` + `consentido_en` + texto versionado inmutable |
| Finalidad determinada y limitada (art. 4.° inc. c) | Inscripción, asistencia, certificación, evaluación de satisfacción y estadística |
| Minimización (art. 4.° inc. d) | Cédula enmascarada por defecto; el check-in no capta IP, ubicación ni dispositivo |
| Limitación del plazo de conservación (art. 4.° inc. e) | 24 meses y anonimización automática por `pg_cron` |
| Seguridad (arts. 4.° inc. i y 16) | TLS, cifrado en reposo, cifrado de columna, RLS por rol, auditoría append only |
| Transparencia (art. 4.° inc. f y art. 27) | Aviso de once rótulos en el formulario y en `/privacidad` |
| Sin decisiones automatizadas (art. 33) | Declarado expresamente; no se elaboran perfiles |

## 2. Datos sensibles y datos cifrados

El sistema distingue dos cosas que suelen confundirse:

- **Cifrado por minimización.** La cédula y el teléfono se guardan cifrados porque no hay razón
  para tenerlos en claro, pero **no son sensibles** en el sentido del artículo 3.° numeral 7.
  No activan ninguna casilla adicional.
- **Dato sensible.** Los requerimientos de accesibilidad o salud sí lo son. Se piden en un campo
  marcado como `sensible`, su declaración es **voluntaria**, requieren **consentimiento expreso
  en casilla separada** (art. 20 num. 1) —el alta se rechaza si hay contenido sin esa casilla—,
  se almacenan cifrados y se **eliminan** al vencer el plazo, no se anonimizan.

Marcar la cédula como «sensible» obligaría a todo el mundo a firmar la casilla de datos
sensibles, que es exactamente lo que la ley quiere evitar. Por eso son marcas independientes.

| Dato | Clasificación | Tratamiento |
| --- | --- | --- |
| Cédula | Identificador | Cifrada + HMAC para el check-in sin descifrar. Máscara de dos dígitos en el panel |
| Accesibilidad o salud | Sensible (art. 3.° num. 7) | Cifrada, voluntaria, consentimiento expreso, borrado anticipado |
| Teléfono | Contacto | Cifrado, uso operativo de la actividad |
| Correo | Contacto | Sin cifrar: es necesario para confirmación y certificado |
| Institución, carrera, ciudad | Ordinario | Base de los indicadores; excluidos de exportaciones públicas |
| Evaluación de satisfacción | Opinión | Vinculada a la inscripción solo para evitar duplicados; se informa en agregado |

## 3. Roles y permisos

| Rol | Ve inscriptos | Cédula | Sensibles | Exporta | Edita | Configura |
| --- | --- | --- | --- | --- | --- | --- |
| `admin` (Dirección) | Todas | Completa, con motivo | Sí | Sí, con cédula | Sí | Sí |
| `coordinacion` | Todas | Enmascarada | Agregados | Con motivo, sin cédula | Sí | Actividades |
| `docente` | Solo sus actividades | Enmascarada | Solo las suyas | No | Asistencia | No |
| `secretaria` | Todas | Completa, con motivo | No | Con motivo, sin cédula | Sí | No |
| `auditor` | Todas | Enmascarada | No | No | No | No |

Implementado con RLS por fila y funciones `SECURITY DEFINER` para el descifrado; nunca con
lógica de frontend. Los permisos del cliente se verificaron contra el proyecto real: el
visitante anónimo recibe `42501` en toda tabla, toda vista y toda función del panel.

## 4. Superficie de ataque

- El navegador anónimo no tiene permiso sobre **ninguna** tabla ni vista, solo sobre las ocho
  funciones públicas listadas en `ARQUITECTURA.md`.
- Hay `alter default privileges … revoke` puesto para tablas, secuencias y funciones, de modo
  que nada nuevo nazca abierto. Es un error fácil de cometer: Postgres concede `execute` a
  `PUBLIC` en toda función nueva, y Supabase concede acceso a `anon` en toda tabla nueva.
- `inscribir()` recorre los campos declarados en la actividad, no lo que envía el cliente: no
  se puede escribir en una columna que el formulario no ofrece.
- Límite de tasa: 60 inscripciones por minuto y actividad; 5 intentos de check-in cada diez
  minutos por cédula y jornada; 5 solicitudes de derechos por hora y correo. Se calcula sobre
  la actividad y el HMAC de la cédula, **no** sobre la dirección IP.

## 5. Derechos de los titulares (arts. 26 a 33)

Ruta pública `/derechos` para acceso, rectificación, oposición, supresión, portabilidad y
revocación —incluida la del uso de imagen—. Compromisos:

- gratuito y por medios sencillos (art. 26);
- respuesta en **treinta días corridos** como máximo (art. 26), con `vence_en` calculado
  automáticamente y visible en el panel;
- oposición: cese del tratamiento en diez días hábiles (art. 30);
- supresión conforme al artículo 31, con las excepciones allí previstas.

Toda solicitud queda en `solicitudes_derechos` y su recepción en `auditoria`.

## 6. Auditoría

`auditoria` es *append only*. No hay política de `UPDATE` ni de `DELETE`, los permisos están
revocados y además hay disparadores que rechazan ambas operaciones con una excepción. Nadie
puede alterarla, tampoco la Dirección.

Se asientan: alta de actividad, alta de inscripción, alta de evaluación, edición de
inscripción, lectura de cédula completa, lectura de datos sensibles, exportación con el motivo
declarado, regeneración de enlaces y de códigos, cierre de actividad, solicitudes de derechos y
aplicación de la retención.

Las lecturas de cédula y de datos sensibles **exigen declarar un motivo**: sin motivo, la
función falla.

## 7. Incidentes de seguridad (art. 17)

Procedimiento escrito: contención, registro en auditoría, evaluación de riesgo y
**notificación a la Agencia Nacional de Protección de Datos Personales y a los titulares
afectados dentro de las setenta y dos horas** de conocido el incidente.

## 8. Diligencia debida (arts. 9.°, 14, 15 y 18)

- **Evaluación de impacto** obligatoria antes de publicar cualquier formulario que incluya
  campos sensibles. El constructor lo advierte en pantalla.
- **Oficial de protección de datos**: Abg. Patricia Sequeira, `extensionderecho@unida.edu.py`.
- **Privacidad desde el diseño y por defecto**: los campos sensibles nacen desmarcados, la
  cédula nace enmascarada y las exportaciones nacen sin cédula.
- **Registro de actividades de tratamiento** mantenido por la Coordinación.

## 9. Endurecimiento operativo

- Segundo factor obligatorio para `admin` y `secretaria`; cierre de sesión por inactividad a
  los 30 minutos, implementado en el cliente.
- Cabeceras CSP estricta, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy` restrictiva. Sin analítica de terceros en las rutas públicas.
- Respaldos diarios cifrados, retención de 30 días, prueba de restauración trimestral.
- Las claves de cifrado se generan dentro de la base y viven en Supabase Vault. No están en el
  repositorio, no pasaron por ninguna terminal y no deben rotarse: hacerlo invalidaría los
  datos cifrados y todos los HMAC de cédula.
