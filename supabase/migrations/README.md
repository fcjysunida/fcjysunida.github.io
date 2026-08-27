# Migraciones

El historial autoritativo vive en el proyecto Supabase `fcjysunida`
(`mpsajgoycmmciobnnmjy`, región São Paulo). Estos archivos lo reproducen para
poder levantar el esquema desde cero.

```
supabase link --project-ref mpsajgoycmmciobnnmjy
supabase db push        # aplica lo que falte
supabase db pull        # trae al repositorio lo aplicado a mano
```

Reglas:

- Nunca se edita una migración ya aplicada: se agrega una nueva.
- El texto de consentimiento no se corrige con `UPDATE`: se inserta una versión
  nueva y se cierra la anterior con `vigente_hasta`.
- Las claves de cifrado viven en Supabase Vault (`fcjys_cifrado_clave`,
  `fcjys_cedula_pepper`) y no aparecen en ningún archivo. Se crean una sola vez
  con `npm run cli -- claves:inicializar`.
