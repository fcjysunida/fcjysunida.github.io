# fcjysunida — Sistema de inscripciones y asistencia

Plataforma de la **Facultad de Ciencias Jurídicas y Sociales (UNIDA)** para crear formularios de
inscripción a actividades de extensión, registrar asistencia por jornada, medir la satisfacción
de los participantes y producir los indicadores del *Informe Mensual de Extensión y Vinculación —
Docente de Tiempo Completo (DTC)*.

- **Frontend:** Vite + React + TypeScript, build estático (GitHub Pages)
- **Backend:** Supabase — Postgres 17, Auth, RLS, Vault, pg_cron (proyecto `fcjysunida`, São Paulo)
- **Responsable del tratamiento:** Abg. Patricia Sequeira — `extensionderecho@unida.edu.py`
- **Marco legal:** Ley N° 7593/2025 de Protección de Datos Personales (Paraguay)

## Qué hace

1. **Constructor de formularios.** Título, tipo de actividad, fechas, jornadas, cupo, sede,
   portada y campos. Doce tipos de campo, con orden, duplicación, texto de ayuda y tres marcas
   independientes: *obligatorio*, *se guarda cifrado* y *dato sensible*.
2. **Formulario público** en `/f/:token`, con el aviso previo del artículo 27 plegado tras un
   degradado para no alargar la página, y el consentimiento en tres casillas.
3. **Asistencia por jornada con un solo enlace.** Un enlace por actividad (`/a/:token`); el
   **código de sala cambia cada día** y lo anuncia el docente. Regenerar el enlace lo invalida
   y rota todos los códigos.
4. **Evaluación de satisfacción** en el mismo enlace, después de registrar la presencia:
   seis dimensiones en escala Likert, CSAT y NPS. Se responde una sola vez y se informa
   siempre en agregado.
5. **Panel de administración.** Actividades, inscripciones, asistencia, calidad percibida,
   estadísticas del informe DTC y gobierno de datos.
6. **Padrón académico.** Nómina de estudiantes y egresados por período. Al recibir una
   inscripción, el sistema cruza la cédula y fija la condición efectiva en vez de creerle
   a lo declarado. El cruce se hace sobre el HMAC: no descifra ninguna cédula.
7. **Constancias.** Plantillas con etiquetas `<<Etiqueta>>` —la misma lógica de Autocrat—,
   emisión por lote según asistencia y verificación pública en `/c/:codigo`.
8. **Proyectos de extensión.** Propuesta e informe con la estructura de los formatos
   oficiales 9 y 10, incluida la escala de carga horaria del anexo. Se exportan en Word.
9. **Correo.** Cola con tope diario, para que el plan gratuito del proveedor no rompa una
   inscripción masiva. Confirmación, recordatorio de jornada y aviso de constancia.
10. **Protección de datos.** Cifrado de columna con clave en Vault, cédula enmascarada por
   defecto, auditoría inalterable, retención automática a los 24 meses y ruta pública para
   ejercer derechos.

## Puesta en marcha

### 1. Base de datos

El proyecto Supabase ya está creado y migrado. Para levantarlo desde cero:

```bash
supabase link --project-ref mpsajgoycmmciobnnmjy
supabase db push
```

Las claves de cifrado se generan **dentro** de la base y nunca pasan por el repositorio:

```bash
npm run cli -- claves:inicializar
```

Es idempotente: si ya existen, no las toca. Rotarlas invalidaría todo lo cifrado.

### 2. Primer usuario

Dos caminos. El más simple no necesita ninguna clave:

**a) Registro desde el panel.** Entre a `/admin`, elija «No tengo cuenta todavía» y
regístrese con su correo institucional y una contraseña propia. La cuenta nace **sin
permisos**. Después, alguien con acceso a la base le asigna el rol:

```sql
insert into usuarios (id, nombre, email, rol)
select id, 'Nombre Apellido', email, 'admin' from auth.users
 where email = 'extensionderecho@unida.edu.py'
on conflict (id) do update set rol = excluded.rol, activo = true;
```

**b) Alta desde la línea de comandos.** Necesita `SUPABASE_SERVICE_ROLE_KEY` en `.env`,
que se copia en *Project Settings → API Keys → `service_role` → Reveal*. **No se commitea.**

```bash
npm run cli -- usuarios:alta --email extensionderecho@unida.edu.py \
  --nombre "Patricia Sequeira" --rol admin
```

Roles: `admin`, `coordinacion`, `docente`, `secretaria`, `auditor`.

> Existe además una **cuenta de servicio** `sistema.padron@unida.edu.py` con rol
> `secretaria`, creada para la carga inicial del padrón. Su contraseña está solo en
> `.env` (que no se versiona). Puede rotarla, desactivarla desde el panel o dejarla
> para las importaciones periódicas.

### 3. Frontend

```bash
cp .env.example .env      # complete VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 4. Publicación

En el repositorio de GitHub, cargue los *secrets* `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY`, y la *variable* `BASE_PUBLICA` (`/` para
`fcjysunida.github.io`, `/fcjysunida/` para un repositorio corriente). Cada push a `main`
publica. Ver `docs/DESPLIEGUE.md`.

## Rutas

| Ruta | Qué es | Acceso |
| --- | --- | --- |
| `/f/:token` | Formulario de inscripción | Público, sin cuenta |
| `/a/:token` | Asistencia del día y evaluación | Público, sin cuenta |
| `/privacidad` | Política de tratamiento de datos | Público |
| `/derechos` | Solicitud de acceso, rectificación, supresión y demás | Público |
| `/c/:codigo` | Verificación pública de una constancia | Público |
| `/admin` | Panel | Sesión con rol |

## Tipología de actividad

`extension` · `publica` · `vinculacion` · `proyecto_extension` · `capacitacion_docente` ·
`actividad_estudiantil` · `investigacion`

Cada tipo determina en qué bloque del informe DTC se agrega la actividad.

## Estructura

```
src/publico/       Formulario, check-in con encuesta, privacidad, derechos
src/admin/         Panel, constructor, inscripciones, asistencia, calidad, indicadores, seguridad
src/data/          Repositorios: publico.ts (anónimo) y panel.ts (con sesión)
src/lib/           Tipos, formato, campos, sesión, cliente de Supabase, datos institucionales
supabase/migrations/  Esquema, RLS, funciones, encuesta, indicadores, tareas programadas
cli/               Operación desde la línea de comandos
docs/              Arquitectura, seguridad, consentimiento, informe DTC, padrón, despliegue
```

## Operación desde Claude Code

Ver `CLAUDE.md`: reglas invariables de datos personales y comandos de operación.
