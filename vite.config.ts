import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` se resuelve en tiempo de build: GitHub Pages sirve el repositorio de
// usuario en la raíz (fcjysunida.github.io) y cualquier otro bajo /<repo>/.
export default defineConfig({
  base: process.env.BASE_PUBLICA ?? '/',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
})
