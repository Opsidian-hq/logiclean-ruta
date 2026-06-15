import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mx.logiclean.ruta',
  appName: 'Logiclean Ruta',
  webDir: 'dist',
  // PWA mode: Capacitor envuelve la app web en un WebView
  // Para distribución nativa futura: npx cap add android/ios
  server: {
    // En desarrollo, usar el servidor Vite local
    // Comentar en producción (usará el bundle de dist/)
    // url: 'http://localhost:5173',
    // cleartext: true,
  },
  plugins: {
    // Configurar plugins de Capacitor aquí cuando se añadan
  },
};

export default config;
