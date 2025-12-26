import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { notificationService } from '../utils/notifications';

// Get store instance outside of component
let chatStore: ReturnType<typeof useChatStore.getState> | null = null;

// Subscribe to store changes to keep reference updated
if (typeof window !== 'undefined') {
  useChatStore.subscribe((state) => {
    chatStore = state;
  });
  // Initialize
  chatStore = useChatStore.getState();
}

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
  private currentToken: string | null = null;

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
    // Security: Validate chatId
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      return;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const unsubscribeMessage = JSON.stringify({
        event: 'pusher:unsubscribe',
        data: {
          channel: `manager-client-chats.${chatId}`,
        },
      });
      this.ws.send(unsubscribeMessage);
    }
  }

  private handleNewMessage(data: any) {
    // Security: Validate and sanitize incoming data
    if (!data || typeof data !== 'object') {
      return;
    }
    
    const message = data.message || data;
    const chatId = message?.chat_id || message?.chatId || data?.chat_id || data?.chatId;
    
    // Security: Validate chatId
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      return;
    }
    
    if (this.queryClient) {
      this.queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      this.queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      this.queryClient.invalidateQueries({ queryKey: ['chats'] });
    }

    const { updateChat, chats, selectedChatId } = useChatStore.getState();
    const chat = chats.find((c) => c.id === chatId);
    
    if (chat) {
      const isChatSelected = selectedChatId === chatId;
      const shouldIncrementUnread = !message.from_manager && !isChatSelected;
      
      updateChat(chatId, {
        last_message_at: message.created_at,
        unread_count: shouldIncrementUnread 
          ? (chat.unread_count || 0) + 1 
          : (message.from_manager ? chat.unread_count : 0),
        last_message: message,
      });

      if (!message.from_manager) {
        const clientName = String(chat.clientUser?.name || chat.client_name || 'Unknown').substring(0, 100);
        const messageText = String(message.body || '').substring(0, 200);
        
        notificationService.notifyNewMessage(
          clientName,
          messageText,
          true
        );
      }
    }
  }

  private handleChatUpdate(data: any) {
    // Security: Validate incoming data
    if (!data || typeof data !== 'object') {
      return;
    }
    
    const chat = data.chat || data;
    const chatId = chat?.id || chat?.chat_id;
    
    // Security: Validate chatId
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
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
    // Security: Validate incoming data
    if (!data || typeof data !== 'object') {
      return;
    }
    
    const chatId = data.chat_id;
    const isTyping = data.is_typing;
    const userId = data.user_id;
    const userName = data.user_name || null;
    
    // Security: Validate chatId and is_typing
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      return;
    }
    if (typeof isTyping !== 'boolean') {
      return;
    }
    
    // Get current user to filter out own typing indicator
    const authStore = useAuthStore.getState();
    const currentUserId = authStore.user?.id;
    
    // Don't show typing indicator for current user (they see their own typing in the input)
    if (userId === currentUserId) {
      return;
    }
    
    // Update typing indicator in store
    if (chatStore) {
      if (isTyping) {
        chatStore.setTypingIndicator(chatId, {
          isTyping: true,
          userId: userId || null,
          userName: userName || 'Користувач',
        });
      } else {
        chatStore.setTypingIndicator(chatId, null);
      }
    }
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

