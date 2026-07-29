import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor shell config. The APK build is a later milestone (E12); for now this
// wraps the Vite `dist/` output so the same web build can target Android.
const config: CapacitorConfig = {
  appId: 'com.pcfutbol.ultimate',
  appName: 'PCFutbol Ultimate',
  webDir: 'dist',
};

export default config;
