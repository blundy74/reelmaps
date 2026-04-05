import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.reelmaps.app',
  appName: 'ReelMaps',
  webDir: 'dist',
  server: {
    // Allow all external API calls (NOAA, NASA, Open-Meteo, etc.)
    androidScheme: 'https',
  },
  android: {
    // Allow mixed content for WMS tile loading
    allowMixedContent: true,
    // Use full-screen immersive mode
    backgroundColor: '#040c18',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#040c18',
      androidSplashResourceName: 'splash',
      launchShowDuration: 2000,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#040c18',
    },
  },
};

export default config;
