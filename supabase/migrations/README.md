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

## Diferencia entre este historial y el aplicado

El proyecto tiene doce migraciones aplicadas; acá hay once. La diferencia es
`separar_cifrado_de_sensible`, que corrigió sobre la marcha la confusión entre «identificador
cifrado» y «dato sensible». Su contenido está incorporado a `…000100_esquema_base.sql` y
`…000400_funciones_publicas.sql`, de modo que **un `db push` sobre una base vacía produce
exactamente el mismo estado**. Es la única divergencia; de acá en adelante, cada cambio va en
su propia migración nueva.
