// OS Notifications utility
import * as platform from './platform';

export class NotificationService {
  private permissionGranted = false;
  private sound: HTMLAudioElement | null = null;
  private soundPath: string = '';
  private soundPathResolved: boolean = false;

  constructor() {
    // Load sound file asynchronously after getting path from main process
    this.initializeSound();
  }

  private async initializeSound() {
    try {
      // Try to get sound path from platform (Electron returns full path)
      if (platform.isElectron()) {
        const path = await platform.getSoundPath('best-notification-1-286672.mp3');
        if (path) {
          this.soundPath = path;
          this.soundPathResolved = true;
          this.loadSound();
          return;
        }
      }
      
      // Fallback: Determine sound path based on environment
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
      
      this.soundPathResolved = true;
      console.log('🔊 Using fallback sound path:', this.soundPath);
      this.loadSound();
    } catch (error) {
      console.error('❌ Error initializing sound:', error);
      this.soundPathResolved = true;
      // Still try to load with fallback path
      this.soundPath = '/sound/best-notification-1-286672.mp3';
      this.loadSound();
    }
  }

  private loadSound() {
    if (!this.soundPath) {
      console.warn('⚠️ Sound path not set yet');
      return;
    }

    try {
      this.sound = new Audio(this.soundPath);
      this.sound.preload = 'auto';
      this.sound.volume = 0.7; // Set volume to 70%
      console.log('🔊 Notification sound loaded from:', this.soundPath);
      
      // Handle loading errors
      this.sound.addEventListener('error', (e) => {
        console.error('❌ Sound file failed to load:', e);
        console.error('❌ Tried path:', this.soundPath);
        console.error('❌ Error details:', {
          code: (this.sound as any)?.error?.code,
          message: (this.sound as any)?.error?.message,
        });
        
        // Only try alternatives if not using Electron
        if (!platform.isElectron()) {
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
                const altSound = new Audio(altPath);
                altSound.volume = 0.7;
                altSound.addEventListener('error', () => {
                  console.warn('⚠️ Alternative path also failed:', altPath);
                });
                altSound.addEventListener('canplaythrough', () => {
                  console.log('✅ Alternative path worked:', altPath);
                  this.sound = altSound;
                  this.soundPath = altPath;
                });
                break;
              } catch (err) {
                console.warn('⚠️ Alternative path failed:', altPath);
              }
            }
          }
        } else {
          console.warn('⚠️ Sound file not found. Notifications will work without sound.');
        }
      });
      
      // Log successful load
      this.sound.addEventListener('canplaythrough', () => {
        console.log('✅ Sound file ready to play');
      });
      
      this.sound.addEventListener('loadeddata', () => {
        console.log('✅ Sound file data loaded');
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
      const notification = new Notification(title, {
        icon: '/assets/icon.png',
        badge: '/assets/icon.png',
        silent: options?.silent ?? false,
        requireInteraction: options?.requireInteraction ?? false,
        tag: options?.tag,
        ...options,
      });

      // Handle notification click - focus window (Telegram-like behavior)
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds if not requiring interaction
      if (!options?.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return notification;
    }
  }

  notifyNewMessage(chatName: string, message: string, playSoundNow: boolean = true) {
    console.log('🔔 notifyNewMessage called:', { chatName, messageLength: message.length, playSoundNow });
    
    // Always play sound for new messages (if enabled in settings)
    if (playSoundNow) {
      console.log('🔊 Calling playSound() from notifyNewMessage');
      this.playSound();
    }

    // Clean message text (remove HTML tags, trim)
    const cleanMessage = message
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    // Truncate message for notification (Telegram style: first line + ellipsis if long)
    const maxLength = 150;
    const truncatedMessage = cleanMessage.length > maxLength 
      ? cleanMessage.substring(0, maxLength).trim() + '...'
      : cleanMessage;

    // Format notification like Telegram: Chat name on top, message below
    const notificationTitle = chatName;
    const notificationBody = truncatedMessage;

    // Show OS notification with Telegram-like styling
    this.showNotification(notificationTitle, {
      body: notificationBody,
      tag: 'new-message',
      requireInteraction: false,
      silent: false,
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

