# Cláusula de consentimiento y aviso de privacidad — versión 1.0

Texto vigente del formulario público, redactado según la Ley N° 7593/2025. Vive en la tabla
`consentimiento_versiones` y se sirve al formulario por `consentimiento_vigente()`.

Cada inscripción guarda la versión aceptada con fecha y hora. **Una modificación no se hace
con `UPDATE`**: se inserta la versión 1.1 y se cierra la anterior con `vigente_hasta`. Las
inscripciones ya registradas conservan la versión que su titular aceptó — es la prueba del
consentimiento que exige el artículo 6.°.

---

## Aviso previo (art. 27)

En el formulario aparece plegado tras un degradado, con un control «Leer el aviso completo»,
para no alargar la página. El texto está siempre en el documento: no se carga al desplegar,
de modo que un lector de pantalla lo alcanza igual.

**Responsable.** Facultad de Ciencias Jurídicas y Sociales de la Universidad de la Integración
de las Américas, con domicilio en Asunción. Responsable del tratamiento: Abg. Patricia
Sequeira. Contacto: extensionderecho@unida.edu.py.

**Finalidad.** Gestión de la inscripción, control de asistencia por jornada, emisión de
certificados, evaluación de la satisfacción de la actividad y elaboración de las estadísticas
institucionales de extensión universitaria.

**Base legal.** Consentimiento del titular, artículo 5.° numeral 1.

**Datos que se tratan.** Los declarados en el formulario. Los campos marcados con asterisco son
necesarios para procesar la inscripción; los demás son voluntarios.

**Datos sensibles.** Los requerimientos de accesibilidad o salud son sensibles conforme al
artículo 3.° numeral 7. Su declaración es voluntaria y requiere consentimiento expreso en
casilla separada. Omitirlos no impide inscribirse.

**Uso de imagen.** La actividad puede ser fotografiada o grabada para la difusión institucional.
Esta autorización está comprendida en el consentimiento general y puede revocarse en cualquier
momento, sin que ello afecte la inscripción ni el certificado.

**Evaluación de satisfacción.** Al finalizar la actividad se invita a responder una encuesta
breve. Es voluntaria y sus resultados se procesan solo de forma agregada.

**Destinatarios.** Dirección, Coordinación de Extensión, Secretaría y el docente responsable de
la actividad. No se ceden a terceros ni se transfieren fuera de la República del Paraguay.

**Conservación.** Veinticuatro meses desde el cierre de la actividad. Vencido el plazo los datos
se anonimizan y solo subsiste el agregado estadístico; los datos sensibles se eliminan.

**Decisiones automatizadas.** No se elaboran perfiles ni se adoptan decisiones automatizadas.

**Derechos.** Acceso, rectificación, oposición, supresión y portabilidad, además de la
revocación del consentimiento en cualquier momento, de forma gratuita y por medios sencillos, a
través de extensionderecho@unida.edu.py o de la ruta `/derechos`. Plazo máximo: treinta días
corridos. Sin perjuicio de la acción de habeas data, puede reclamarse ante la Agencia Nacional
de Protección de Datos Personales.

---

## Casillas de consentimiento

1. **(Obligatoria)** Tratamiento de los datos declarados con la finalidad de gestionar la
   inscripción, el registro de asistencia, la certificación, la evaluación de satisfacción y
   las estadísticas institucionales de extensión, **y autorización del uso de fotografías y
   grabaciones** de la actividad en la difusión institucional de la Facultad, revocable por
   separado y en cualquier momento sin afectar la inscripción.
2. **(Solo si completa un campo sensible)** Consentimiento expreso para el tratamiento de los
   datos sensibles declarados.
3. **(Opcional)** Recibir información sobre futuras actividades de extensión.

### Nota sobre la casilla 1

La autorización de imagen se integró a la casilla general por decisión de la Facultad, para
acortar el formulario. Conviene tener presente que el artículo 6.° pide un consentimiento
*libre* y diferenciado por finalidad, y la difusión institucional no es necesaria para
inscribirse. Las mitigaciones adoptadas son tres:

- la autorización se enuncia **explícitamente** dentro del texto de la casilla, no en letra
  chica ni por remisión;
- se guarda en su **propia columna** (`inscripciones.consent_imagen`), de modo que puede
  revocarse sin tocar la inscripción;
- la revocabilidad separada se informa en la casilla misma, en el aviso previo y en
  `/derechos`, donde la opción «Revocación» la menciona por su nombre.

Si en el futuro se prefiere volver al esquema de casilla independiente, alcanza con insertar
una versión 1.1 del texto y agregar la casilla en el formulario: la columna ya existe y las
inscripciones anteriores no se ven afectadas.

## Reglas de validación

- Sin la casilla 1 el formulario no se envía. Lo verifica el cliente **y** la función
  `inscribir()`, que es la que manda.
- Si hay contenido en un campo marcado como `sensible` y la casilla 2 no está marcada, el envío
  se rechaza con un mensaje que ofrece dejar el campo vacío.
- La casilla 3 nunca condiciona la inscripción.
- La versión del texto mostrado se guarda junto con la inscripción.
