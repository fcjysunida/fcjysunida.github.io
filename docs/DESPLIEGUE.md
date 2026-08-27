# Despliegue

## 1. Dominio público gratuito

- Repositorio `fcjysunida.github.io` → sirve en `https://fcjysunida.github.io` (raíz limpia).
  Requiere crear la organización `fcjysunida` en GitHub.
- Con el repositorio corriente (`leoberniga/fcjysunida`), la URL es
  `https://leoberniga.github.io/fcjysunida` y hay que fijar la variable
  `BASE_PUBLICA=/fcjysunida/`.
- Alternativa equivalente y también gratuita: Cloudflare Pages, que además permite configurar
  cabeceras de seguridad y límite de tasa sin servidor.
- Cuando la Facultad disponga del subdominio institucional, apuntar
  `inscripciones.fcjysunida.edu.py` por CNAME; Pages emite el certificado automáticamente.

## 2. Backend Supabase

El proyecto ya existe: `fcjysunida` (`mpsajgoycmmciobnnmjy`), región São Paulo.

```bash
supabase link --project-ref mpsajgoycmmciobnnmjy
supabase db push
npm run cli -- claves:inicializar
```

`claves:inicializar` genera las dos claves **dentro de la base** y las guarda en Supabase
Vault. Es idempotente. **No las rote**: invalidaría todo lo cifrado y todos los HMAC de cédula.

Después, el primer usuario:

```bash
npm run cli -- usuarios:alta --email direccion@unida.edu.py \
  --nombre "Patricia Sequeira" --rol admin
```

Activar el segundo factor para los roles `admin` y `secretaria` desde el panel de Supabase
(*Authentication → Multi-Factor*).

## 3. Variables de entorno

```
VITE_SUPABASE_URL=https://mpsajgoycmmciobnnmjy.supabase.co
VITE_SUPABASE_ANON_KEY=...        # pública por diseño, acotada por permisos y RLS
SUPABASE_SERVICE_ROLE_KEY=...     # solo para claves:inicializar y usuarios:alta. No se commitea.
```

En GitHub, cargar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como *secrets*, y
`BASE_PUBLICA` como *variable* del repositorio.

## 4. GitHub Actions

El workflow está en `.github/workflows/deploy.yml`. Cada push a `main` compila y publica.
El build copia `index.html` a `404.html` para que las rutas del cliente resuelvan.

## 5. Tareas programadas

Corren dentro de la base con `pg_cron`; no hace falta ningún servicio externo.

| Tarea | Frecuencia | Qué hace |
| --- | --- | --- |
| `fcjys-retencion-mensual` | Día 1, 03:10 UTC | Anonimiza lo vencido a los 24 meses y elimina los sensibles |
| `fcjys-purga-limites` | Diaria, 04:00 UTC | Limpia el contador del límite de tasa |
| Respaldo | Diario | Provisto por Supabase; verificación de restauración trimestral, manual |

Se consultan con `select * from cron.job;` y su historial con `select * from cron.job_run_details;`.

## 6. Antes de publicar

- [ ] Política de privacidad publicada en `/privacidad` y enlazada desde cada formulario.
- [ ] Texto de consentimiento aprobado por la Dirección y cargado como versión 1.0.
- [ ] Segundo factor activado para `admin` y `secretaria`.
- [ ] Cabeceras CSP y HSTS verificadas en el hosting.
- [ ] Prueba de restauración de respaldo documentada.
- [ ] Registro de actividades de tratamiento firmado por la Dirección.
- [ ] Evaluación de impacto completada para los formularios con campos sensibles.
- [ ] Sin analítica de terceros en las rutas públicas.
