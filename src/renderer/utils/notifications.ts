// OS Notifications utility
export class NotificationService {
  private permissionGranted = false;
  private sound: HTMLAudioElement | null = null;
  private soundPath: string;

  constructor() {
    // Determine sound path based on environment
    // In dev: webpack dev server serves from src/renderer/sound/
    // In production (packaged): files are in app.asar.unpacked/sound/ or resources/sound/
    // In production (unpacked): files are in dist/sound/
    const isDev = process.env.NODE_ENV === 'development' || !window.location.protocol.includes('file');
    const isPackaged = window.location.protocol === 'file:';
    
    if (isDev) {
      this.soundPath = '/sound/best-notification-1-286672.mp3';
    } else if (isPackaged) {
      // In packaged app, sound files are in extraResources
      // Path depends on platform: resources/sound/ (macOS) or resources/sound/ (Windows)
      this.soundPath = './sound/best-notification-1-286672.mp3';
    } else {
      // In unpacked production build
      this.soundPath = './sound/best-notification-1-286672.mp3';
    }
    
    // Load sound file
    this.loadSound();
  }

  private loadSound() {
    try {
      this.sound = new Audio(this.soundPath);
      this.sound.preload = 'auto';
      this.sound.volume = 0.7; // Set volume to 70%
      console.log('🔊 Notification sound loaded from:', this.soundPath);
      
      // Handle loading errors
      this.sound.addEventListener('error', (e) => {
        console.error('❌ Sound file failed to load:', e);
        console.error('❌ Tried path:', this.soundPath);
        // Try alternative paths
        const alternatives = [
          '/sound/best-notification-1-286672.mp3',
          './sound/best-notification-1-286672.mp3',
          '../sound/best-notification-1-286672.mp3',
        ];
        
        for (const altPath of alternatives) {
          if (altPath !== this.soundPath) {
            console.log('🔄 Trying alternative path:', altPath);
            try {
              this.sound = new Audio(altPath);
              this.sound.volume = 0.7;
              this.soundPath = altPath;
              break;
            } catch (err) {
              console.warn('⚠️ Alternative path failed:', altPath);
            }
          }
        }
      });
      
      // Log successful load
      this.sound.addEventListener('canplaythrough', () => {
        console.log('✅ Sound file ready to play');
      });
    } catch (error) {
      console.error('Failed to initialize notification sound:', error);
    }
  }

  private shouldPlaySound(): boolean {
    // Check settings from localStorage
    // Default to true if not set (first time use)
    const notificationsEnabled = localStorage.getItem('settings.notifications.enabled');
    const soundEnabled = localStorage.getItem('settings.notifications.sound');
    const doNotDisturb = localStorage.getItem('settings.notifications.doNotDisturb') === 'true';
    
    // If settings are not set, default to enabled
    const notificationsEnabledValue = notificationsEnabled === null ? true : notificationsEnabled !== 'false';
    const soundEnabledValue = soundEnabled === null ? true : soundEnabled !== 'false';

    const result = notificationsEnabledValue && soundEnabledValue && !doNotDisturb;
    console.log('🔊 shouldPlaySound check:', {
      notificationsEnabled: notificationsEnabledValue,
      soundEnabled: soundEnabledValue,
      doNotDisturb,
      result,
    });
    
    return result;
  }

  private playSound() {
    console.log('🔊 playSound() called');
    console.log('🔊 shouldPlaySound():', this.shouldPlaySound());
    console.log('🔊 sound loaded:', !!this.sound);
    
    if (!this.shouldPlaySound()) {
      console.log('🔇 Sound disabled by settings');
      const notificationsEnabled = localStorage.getItem('settings.notifications.enabled');
      const soundEnabled = localStorage.getItem('settings.notifications.sound');
      const doNotDisturb = localStorage.getItem('settings.notifications.doNotDisturb');
      console.log('🔇 Settings:', { notificationsEnabled, soundEnabled, doNotDisturb });
      return;
    }

    if (!this.sound) {
      console.warn('⚠️ Sound file not loaded, trying to reload...');
      this.loadSound();
      if (!this.sound) {
        console.error('❌ Failed to load sound file');
        return;
      }
    }

    try {
      console.log('🔊 Attempting to play sound from:', this.soundPath);
      // Reset sound to start and play
      this.sound.currentTime = 0;
      const playPromise = this.sound.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('✅ Sound playing successfully');
          })
          .catch((error) => {
            console.error('❌ Failed to play notification sound:', error);
            console.error('❌ Error details:', {
              name: error.name,
              message: error.message,
              code: (error as any).code,
            });
            
            // Try to reload and play again
            console.log('🔄 Attempting to reload sound...');
            this.sound = new Audio(this.soundPath);
            this.sound.volume = 0.7;
            this.sound.play()
              .then(() => {
                console.log('✅ Sound played after reload');
              })
              .catch((err) => {
                console.error('❌ Failed to play sound after reload:', err);
              });
          });
      }
    } catch (error) {
      console.error('❌ Error playing sound:', error);
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === 'granted';
      return this.permissionGranted;
    }

    return false;
  }

  async showNotification(title: string, options?: NotificationOptions) {
    const notificationsEnabled = localStorage.getItem('settings.notifications.enabled') !== 'false';
    const doNotDisturb = localStorage.getItem('settings.notifications.doNotDisturb') === 'true';

    if (!notificationsEnabled || doNotDisturb) {
      return;
    }

    if (!this.permissionGranted) {
      const granted = await this.requestPermission();
      if (!granted) {
        return;
      }
    }

    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/assets/icon.png',
        badge: '/assets/icon.png',
        ...options,
      });
    }
  }

  notifyNewMessage(chatName: string, message: string, playSoundNow: boolean = true) {
    console.log('🔔 notifyNewMessage called:', { chatName, messageLength: message.length, playSoundNow });
    
    // Always play sound for new messages (if enabled in settings)
    if (playSoundNow) {
      console.log('🔊 Calling playSound() from notifyNewMessage');
      this.playSound();
    }

    // Show OS notification
    this.showNotification(`Новое сообщение от ${chatName}`, {
      body: message.substring(0, 100),
      tag: 'new-message',
      requireInteraction: false,
    });
  }

  notifyChatAssigned(chatName: string) {
    this.playSound();
    this.showNotification(`Чат назначен: ${chatName}`, {
      body: 'Вам назначен новый чат',
      tag: 'chat-assigned',
    });
  }
}

export const notificationService = new NotificationService();

