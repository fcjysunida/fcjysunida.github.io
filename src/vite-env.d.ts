/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Dominio público del sitio, sin protocolo. Sin definir, el de la FCJYS
   *  UNIDA. Es lo único que hay que cambiar para publicar otra institución. */
  readonly VITE_DOMINIO_PUBLICO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
