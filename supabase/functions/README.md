# Funciones de servidor

Desplegadas en el proyecto `fcjysunida`. Se traen al repositorio con:

```bash
supabase functions download redactar-informe
supabase functions download enviar-correos
```

| Función | Qué hace | Secretos que necesita |
| --- | --- | --- |
| `enviar-correos` | Drena la cola de correo respetando el tope diario del proveedor | `RESEND_API_KEY` |
| `redactar-informe` | Borrador del informe de proyecto con el proveedor de IA elegido en Ajustes | `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` o `XAI_API_KEY`, según el proveedor |

Los secretos se cargan con `supabase secrets set CLAVE=valor` y no viven en el
repositorio ni en la base.
