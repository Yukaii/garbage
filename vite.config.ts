import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin to replace environment variables in HTML
function htmlEnvPlugin(): Plugin {
  return {
    name: 'html-env-plugin',
    transformIndexHtml(html) {
      return html.replace(
        /%%VITE_ADSENSE_CLIENT_ID%%/g,
        process.env.VITE_ADSENSE_CLIENT_ID || ''
      )
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    htmlEnvPlugin(),
  ],
  base: '/',
  server: {
    port: 3000,
  },
})
