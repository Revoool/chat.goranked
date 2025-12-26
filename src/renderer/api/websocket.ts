import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { notificationService } from '../utils/notifications';

// Reverb WebSocket configuration
// Values are injected by webpack DefinePlugin
declare const REVERB_HOST: string;
declare const REVERB_PORT: string;
declare const REVERB_SCHEME: string;
declare const REVERB_APP_KEY: string;
declare const WS_URL: string;

const REVERB_HOST_VAL = REVERB_HOST;
const REVERB_PORT_VAL = REVERB_PORT || '443';
const REVERB_SCHEME_VAL = REVERB_SCHEME || 'https';
const REVERB_APP_KEY_VAL = REVERB_APP_KEY;

if (!REVERB_APP_KEY_VAL) {
  console.error('❌ REVERB_APP_KEY is not set! WebSocket connection will fail.');
  throw new Error('REVERB_APP_KEY environment variable is required');
}

// Build WebSocket URL for Reverb (Pusher-compatible format)
const WS_URL_VAL = typeof WS_URL !== 'undefined' 
  ? WS_URL 
  : `${REVERB_SCHEME_VAL === 'https' ? 'wss' : 'ws'}://${REVERB_HOST_VAL}${REVERB_PORT_VAL === '443' ? '' : ':' + REVERB_PORT_VAL}/app/${REVERB_APP_KEY_VAL}`;

type QueryClient = {
  invalidateQueries: (options: { queryKey: any[] }) => void;
};

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private queryClient: QueryClient | null = null;

  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  async connect(token: string) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    // Security: Validate token
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new Error('Invalid authentication token');
    }

    this.isConnecting = true;

    try {
      // Laravel Reverb uses Pusher-compatible protocol
      // Format: wss://host/app/app_key?protocol=7&client=js&version=8.4.0&flash=false
      // Note: Token authentication is handled server-side via Laravel Reverb authorization
      // The server validates the token when subscribing to private channels
      const url = `${WS_URL_VAL}?protocol=7&client=js&version=8.4.0&flash=false`;
      this.ws = new WebSocket(url);
      this.currentToken = token; // Store token for channel authorization

      this.ws.onopen = () => {
        console.log('WebSocket connected to Reverb');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.isConnecting = false;
        this.attemptReconnect(token);
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      this.isConnecting = false;
    }
  }

  private attemptReconnect(token: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect(token);
    }, delay);
  }

  private handleMessage(data: any) {
    // Handle Pusher protocol messages
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
        return;
      }
    }

    const { event, data: eventData, channel } = data;

    // Handle Pusher connection events
    if (event === 'pusher:connection_established') {
      console.log('Pusher connection established');
      // Subscribe to channels after connection
      this.subscribeToChannels();
      return;
    }

    // Handle Pusher subscription success
    if (event === 'pusher:subscription_succeeded') {
      console.log('Subscribed to channel:', channel);
      return;
    }

    // Parse eventData if it's a string (Laravel Reverb sends JSON strings)
    let parsedEventData = eventData;
    if (typeof eventData === 'string') {
      try {
        parsedEventData = JSON.parse(eventData);
        console.log('📦 Parsed eventData from string:', parsedEventData);
      } catch (e) {
        console.error('Failed to parse eventData:', e, 'Raw eventData:', eventData);
        return;
      }
    }

    // Handle Laravel Reverb events
    // Events are broadcast with class name: ManagerClientMessageSent, ManagerClientTyping, ManagerClientChatUpdated
    console.log('📡 WebSocket event received:', { event, channel, eventData: parsedEventData });
    
    switch (event) {
      case 'ManagerClientMessageSent':
        console.log('📨 ManagerClientMessageSent event received:', { event, eventData: parsedEventData, channel });
        this.handleNewMessage(parsedEventData);
        break;
      case 'ManagerClientTyping':
        this.handleTyping(parsedEventData);
        break;
      case 'ManagerClientChatUpdated':
        this.handleChatUpdate(parsedEventData);
        break;
      default:
        // Try to handle legacy event names for backward compatibility
        if (event === 'chat.message.created' || event === 'App\\Events\\ChatMessageCreated') {
          this.handleNewMessage(parsedEventData);
        } else if (event === 'chat.updated' || event === 'App\\Events\\ChatUpdated') {
          this.handleChatUpdate(parsedEventData);
        } else if (event === 'chat.typing' || event === 'App\\Events\\ChatTyping') {
          this.handleTyping(parsedEventData);
        } else {
          console.log('Unknown WebSocket event:', event, data);
        }
    }
  }


  private subscribeToChannels() {
    // Subscribe to manager-client-chats channel (public channel for all events)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Subscribe to main manager-client-chats channel
      const subscribeMessage = JSON.stringify({
        event: 'pusher:subscribe',
        data: {
          channel: 'manager-client-chats',
        },
      });
      this.ws.send(subscribeMessage);
      console.log('✅ Subscribed to manager-client-chats channel');
    }
  }

  subscribeToChat(chatId: number) {
    // Security: Validate chatId
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      console.error('Invalid chat ID for subscription:', chatId);
      return;
    }
    
    // Subscribe to specific chat channel
    // Note: Server-side authorization will validate token and chat access
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMessage = JSON.stringify({
        event: 'pusher:subscribe',
        data: {
          channel: `manager-client-chats.${chatId}`,
        },
      });
      this.ws.send(subscribeMessage);
    }
  }

  unsubscribeFromChat(chatId: number) {
    // Unsubscribe from specific chat channel
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const unsubscribeMessage = JSON.stringify({
        event: 'pusher:unsubscribe',
        data: {
          channel: `manager-client-chats.${chatId}`,
        },
      });
      this.ws.send(unsubscribeMessage);
      console.log(`✅ Unsubscribed from manager-client-chats.${chatId} channel`);
    }
  }

  private handleNewMessage(data: any) {
    console.log('📨 handleNewMessage called with data:', data);
    
    // Data format: { message: { id, chat_id, from_manager, user_id, body, type, ... } }
    // Or sometimes: { id, chat_id, from_manager, ... } directly
    const message = data.message || data;
    const chatId = message?.chat_id || message?.chatId || data?.chat_id || data?.chatId;
    
    console.log('📨 Extracted message:', message);
    console.log('📨 Extracted chatId:', chatId);
    
    if (!chatId && chatId !== 0) {
      console.warn('⚠️ Received message without chat_id:', {
        data,
        message,
        chatId,
        'message.chat_id': message?.chat_id,
        'data.chat_id': data?.chat_id,
      });
      return;
    }
    
    console.log('✅ Processing message for chatId:', chatId, 'from_manager:', message?.from_manager);
    
    if (this.queryClient) {
      this.queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      this.queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      this.queryClient.invalidateQueries({ queryKey: ['chats'] });
    }

    // Update chat store
    const { updateChat, chats, selectedChatId } = useChatStore.getState();
    const chat = chats.find((c) => c.id === chatId);
    
    console.log('📨 Chat found:', !!chat, 'from_manager:', message?.from_manager, 'selectedChatId:', selectedChatId);
    
    if (chat) {
      // Only increment unread_count for messages from clients (not from manager)
      // And only if this chat is not currently selected (user is not viewing it)
      const isChatSelected = selectedChatId === chatId;
      const shouldIncrementUnread = !message.from_manager && !isChatSelected;
      
      updateChat(chatId, {
        last_message_at: message.created_at,
        unread_count: shouldIncrementUnread 
          ? (chat.unread_count || 0) + 1 
          : (message.from_manager ? chat.unread_count : 0), // Reset to 0 if message from manager or chat is selected
        last_message: message, // Add last_message for preview
      });

      // Play sound and show notification for messages from clients (not from manager)
      // Always play sound regardless of which chat is selected or if app is focused
      if (!message.from_manager) {
        const clientName = chat.clientUser?.name || chat.client_name || 'Unknown';
        const messageText = message.body || '';
        
        console.log('🔔 New message from client:', {
          chatId,
          clientName,
          messageText: messageText.substring(0, 50),
          from_manager: message.from_manager,
          isChatSelected,
        });
        
        // Always play sound for new client messages (if enabled in settings)
        // Show notification only if chat is not currently selected
        notificationService.notifyNewMessage(
          clientName,
          messageText,
          true // playSoundNow = true
        );
      } else {
        console.log('📤 Message from manager, skipping sound');
      }
    } else {
      console.warn('⚠️ Chat not found in store for chatId:', chatId, 'Available chats:', chats.map(c => c.id));
    }
  }

  private handleChatUpdate(data: any) {
    // Data format: { chat: { id, client_user_id, source, status, assigned_manager_id, ... } }
    const chat = data.chat || data;
    const chatId = chat?.id || chat?.chat_id;
    
    if (!chatId) {
      console.warn('⚠️ Received chat update without id:', data);
      return;
    }
    
    if (this.queryClient) {
      this.queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      this.queryClient.invalidateQueries({ queryKey: ['chats'] });
    }

    const { updateChat } = useChatStore.getState();
    updateChat(chatId, chat);
  }

  private handleTyping(data: any) {
    // Data format: { chat_id, is_typing, user: {...} }
    const { chat_id, is_typing } = data;
    // Handle typing indicator
    console.log(`⌨️ Chat ${chat_id} typing: ${is_typing}`);
    // TODO: Update UI with typing indicator
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  send(event: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }
}

export const wsClient = new WebSocketClient();

