import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goranked.chatdesk',
  appName: 'Goranked Chat Desk',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
