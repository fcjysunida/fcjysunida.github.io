# Activar el correo saliente

El sistema no envía en el momento: **encola**. Una tarea drena la cola cada quince
minutos respetando el tope diario del proveedor. Por eso una inscripción masiva o
una emisión de trescientas constancias no rompe nada ni pierde ningún aviso.

Mientras `correo_activo` sea `false`, los correos se siguen encolando pero no
salen. Nada se pierde: al activarlo, la cola se drena sola.

## 1. Elegir el proveedor

**Resend**, por dos razones: 3.000 envíos por mes en el plan gratuito, y **no
agrega su marca al pie del mensaje**. Brevo da más volumen diario (300 contra
100) pero en el plan gratuito mete su logo en cada correo, cosa impensable en un
mensaje que lleva una constancia institucional.

El tope de 100 diarios no es problema porque la cola lo respeta y reparte los
envíos en los días siguientes.

## 2. Crear la cuenta y verificar el dominio

1. Cuenta gratuita en `resend.com`.
2. **Domains → Add Domain.** Acá está la decisión importante: **no use
   `unida.edu.py` a secas.** Pida a Informática un subdominio propio, por
   ejemplo `extension.unida.edu.py`. Así la reputación de envío de este sistema
   queda aislada de la del correo institucional: si algo sale mal de un lado, no
   arrastra al otro.
3. Resend genera tres registros DNS. Hay que publicarlos en el subdominio:

   | Registro | Para qué |
   | --- | --- |
   | **SPF** (TXT) | Declara qué servidores pueden enviar en nombre del dominio |
   | **DKIM** (TXT) | Firma criptográfica de cada mensaje |
   | **DMARC** (TXT) | Qué hacer con lo que no pase SPF ni DKIM |

   **Sin estos tres registros el correo termina en la carpeta de no deseados.**
   No es opcional ni mejorable desde la aplicación: es lo único que decide si
   Gmail y Outlook confían en el remitente.
4. Esperar a que Resend marque el dominio como *Verified* (minutos a algunas
   horas, según la propagación del DNS).
5. **API Keys → Create API Key**, permiso de envío.

## 3. Cargar la clave

En el panel de Supabase: **Edge Functions → Secrets → Add new secret**

```
RESEND_API_KEY = re_...
```

O, si tiene la CLI instalada: `supabase secrets set RESEND_API_KEY=re_...`

La clave no se guarda en la base ni viaja al navegador.

## 4. La credencial de la tarea programada

La tarea que drena la cola necesita poder invocar la función de envío:

```bash
npm run cli -- correo:habilitar --clave <service_role de Supabase>
```

Se guarda en Supabase Vault, no en el repositorio. La clave `service_role` está
en *Project Settings → API Keys → service_role → Reveal*.

## 5. Configurar y activar

En `/admin/ajustes`:

- **Dirección remitente**: del dominio verificado, p. ej. `extension@extension.unida.edu.py`
- **Nombre visible**: `Extensión FCJYS UNIDA`
- **Responder a**: `extensionderecho@unida.edu.py` — acá llegan las respuestas
- **Tope diario**: `100` para el plan gratuito de Resend
- Botón **Activar el envío**

## 6. Comprobar

La misma pantalla muestra la cola: pendientes, enviados en 24 horas, enviados en
30 días y fallidos. Desde la línea de comandos, `npm run cli -- correo:estado`.

Los reintentos son con espera creciente —5, 25, 125 minutos— y a los cinco
intentos el mensaje queda como fallido con el error del proveedor.

## Qué manda el sistema

| Cuándo | Qué |
| --- | --- |
| Al inscribirse | Confirmación con fechas, lugar y el enlace de asistencia |
| 24 h antes de cada jornada | Recordatorio con el enlace |
| Al emitir una constancia | Aviso con el enlace de verificación y el código |

Todos llevan al pie el contacto del responsable del tratamiento y el enlace a
`/derechos`. El HTML es sobrio a propósito: los mensajes recargados de imágenes
y tablas anidadas son los que terminan marcados como no deseados.
