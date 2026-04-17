import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { notificationService } from '../utils/notifications';
import type { ConnectionStatus } from '../store/chatStore';

let chatStore: ReturnType<typeof useChatStore.getState> | null = null;
if (typeof window !== 'undefined') {
  useChatStore.subscribe((state) => { chatStore = state; });
  chatStore = useChatStore.getState();
}

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
  console.error('REVERB_APP_KEY is not set!');
  throw new Error('REVERB_APP_KEY environment variable is required');
}

const WS_URL_VAL = typeof WS_URL !== 'undefined'
  ? WS_URL
  : `${REVERB_SCHEME_VAL === 'https' ? 'wss' : 'ws'}://${REVERB_HOST_VAL}${REVERB_PORT_VAL === '443' ? '' : ':' + REVERB_PORT_VAL}/app/${REVERB_APP_KEY_VAL}`;

type QueryClient = {
  invalidateQueries: (options: { queryKey: any[] }) => void;
  setQueryData: <TData = unknown>(queryKey: any[], updater: TData | ((oldData: TData | undefined) => TData | undefined)) => void;
};

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private reconnectScheduled = false;
  private queryClient: QueryClient | null = null;
  private currentToken: string | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private subscribedChannels = new Set<number>();

  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  private notifyStatus(status: ConnectionStatus) {
    useChatStore.getState().setConnectionStatus(status);
  }

  async connect(token: string) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;
    if (!token || typeof token !== 'string' || token.trim().length === 0) throw new Error('Invalid token');

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState !== WebSocket.CLOSED) {
        try { this.ws.close(1000, 'Reconnecting'); } catch (_) {}
      }
      this.ws = null;
    }

    this.isConnecting = true;
    this.reconnectScheduled = false;

    try {
      const url = `${WS_URL_VAL}?protocol=7&client=js&version=8.4.0&flash=false`;
      this.ws = new WebSocket(url);
      this.currentToken = token;

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.reconnectScheduled = false;
        this.startPing();
        this.notifyStatus('connected');
      };

      this.ws.onmessage = (event) => {
        try { this.handleMessage(JSON.parse(event.data)); } catch (_) {}
      };

      this.ws.onerror = () => { this.isConnecting = false; };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.stopPing();
        if (event.code === 1000 || event.code === 1001) return;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.notifyStatus('reconnecting');
          this.attemptReconnect(token);
        } else {
          this.notifyStatus('disconnected');
        }
      };
    } catch (_) {
      this.isConnecting = false;
    }
  }

  private attemptReconnect(token: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    if (this.isConnecting) return;
    if (this.reconnectScheduled) return;

    this.reconnectScheduled = true;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.reconnectScheduled = false;
      if (!this.isConnecting && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
        this.connect(token);
      }
    }, delay);
  }

  private handleMessage(data: any) {
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }
    const { event, data: eventData, channel } = data;

    if (event === 'pusher:connection_established') {
      this.subscribeToChannels();
      this.subscribedChannels.forEach((id) => this.sendSubscribe(`manager-client-chats.${id}`));
      return;
    }
    if (event === 'pusher:ping') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      }
      return;
    }
    if (event === 'pusher:subscription_succeeded') return;

    let parsedEventData = eventData;
    if (typeof eventData === 'string') {
      try { parsedEventData = JSON.parse(eventData); } catch { return; }
    }

    switch (event) {
      case 'ManagerClientMessageSent': this.handleNewMessage(parsedEventData); break;
      case 'ManagerClientTyping': this.handleTyping(parsedEventData); break;
      case 'ManagerClientChatUpdated': this.handleChatUpdate(parsedEventData); break;
      default:
        if (event === 'chat.message.created' || event === 'App\\Events\\ChatMessageCreated') this.handleNewMessage(parsedEventData);
        else if (event === 'chat.updated' || event === 'App\\Events\\ChatUpdated') this.handleChatUpdate(parsedEventData);
        else if (event === 'chat.typing' || event === 'App\\Events\\ChatTyping') this.handleTyping(parsedEventData);
    }
  }

  private sendSubscribe(channel: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel } }));
    }
  }

  private subscribeToChannels() {
    this.sendSubscribe('manager-client-chats');
  }

  subscribeToChat(chatId: number) {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) return;
    if (this.subscribedChannels.has(chatId)) return;
    this.subscribedChannels.add(chatId);
    this.sendSubscribe(`manager-client-chats.${chatId}`);
  }

  unsubscribeFromChat(chatId: number) {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) return;
    this.subscribedChannels.delete(chatId);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event: 'pusher:unsubscribe', data: { channel: `manager-client-chats.${chatId}` } }));
    }
  }

  private handleNewMessage(data: any) {
    if (!data || typeof data !== 'object') return;
    const message = data.message || data;
    const chatId = message?.chat_id || message?.chatId || data?.chat_id || data?.chatId;
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) return;

    if (this.queryClient) {
      this.queryClient.setQueryData(['messages', chatId], (oldData: any) => {
        const msgs = oldData?.data || oldData || [];
        if (!Array.isArray(msgs)) return oldData;
        if (msgs.some((m: any) => m.id === message.id)) return oldData;
        return oldData?.data ? { ...oldData, data: [...msgs, message] } : [...msgs, message];
      });
      this.queryClient.setQueryData(['chat', chatId], (old: any) =>
        old ? { ...old, last_message_at: message.created_at, last_message: message } : old
      );
      this.queryClient.invalidateQueries({ queryKey: ['chats'] });
    }

    const { updateChat, chats, selectedChatId } = useChatStore.getState();
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      const isChatSelected = selectedChatId === chatId;
      updateChat(chatId, {
        last_message_at: message.created_at,
        unread_count: !message.from_manager && !isChatSelected
          ? (chat.unread_count || 0) + 1
          : (message.from_manager ? chat.unread_count : 0),
        last_message: message,
      });
      if (!message.from_manager) {
        notificationService.notifyNewMessage(
          String(chat.clientUser?.name || chat.client_name || 'Unknown').substring(0, 100),
          String(message.body || '').substring(0, 200),
          true
        );
      }
    }
  }

  private handleChatUpdate(data: any) {
    if (!data || typeof data !== 'object') return;
    const chat = data.chat || data;
    const chatId = chat?.id || chat?.chat_id;
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) return;

    useChatStore.getState().updateChat(chatId, chat);
    if (this.queryClient) {
      this.queryClient.setQueryData(['chat', chatId], chat);
      this.queryClient.setQueryData(['chats'], (oldChats: any[] | undefined) => {
        if (!Array.isArray(oldChats)) return oldChats;
        return oldChats.map((c) => {
          if (c.id !== chatId) return c;
          return (chat.metadata && c.metadata)
            ? { ...c, ...chat, metadata: { ...c.metadata, ...chat.metadata } }
            : { ...c, ...chat };
        });
      });
    }
  }

  private handleTyping(data: any) {
    if (!data || typeof data !== 'object') return;
    const { chat_id: chatId, is_typing: isTyping, user_id: userId, user_name: userName } = data;
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) return;
    if (typeof isTyping !== 'boolean') return;
    if (userId === useAuthStore.getState().user?.id) return;
    if (chatStore) {
      if (isTyping) {
        chatStore.setTypingIndicator(chatId, { isTyping: true, userId: userId || null, userName: userName || 'Користувач' });
      } else {
        chatStore.setTypingIndicator(chatId, null);
      }
    }
  }

  reconnectIfNeeded(token: string) {
    if (!token || this.isConnecting) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.reconnectAttempts = 0;
    this.reconnectScheduled = false;
    this.connect(token);
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval !== null) { clearInterval(this.pingInterval); this.pingInterval = null; }
  }

  disconnect() {
    this.stopPing();
    this.subscribedChannels.clear();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.reconnectScheduled = false;
    this.isConnecting = false;
    this.notifyStatus('disconnected');
  }

  send(event: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }
}

export const wsClient = new WebSocketClient();
