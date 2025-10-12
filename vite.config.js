import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ⚠️ Reemplazá "alquileres-lite" por el NOMBRE EXACTO de tu repo
export default defineConfig({
  plugins: [react()],
  base: '/alquileres-lite/',
})
