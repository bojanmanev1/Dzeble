import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dzeble.app',
  appName: 'dzeble',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
      iconColor: '#0f172a',
      smallIcon: 'ic_stat_dzeble_notification'
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_dzeble_notification',
      iconColor: '#0f172a'
    }
  }
};

export default config;