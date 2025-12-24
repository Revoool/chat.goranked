export interface User {
  id: number;
  name: string;
  email: string;
  role: 'agent' | 'supervisor' | 'admin';
}

export interface Client {
  id: number;
  name: string;
  username?: string;
  phone?: string;
  country?: string;
  language?: string;
}

export interface Message {
  id: number;
  chat_id: number;
  from_manager: boolean; // true if from manager, false if from client
  user_id: number;
  body: string; // API uses 'body' (required)
  type?: 'text' | 'image' | 'file' | 'video' | 'audio';
  seen: boolean;
  delivered: boolean;
  created_at: string;
  metadata?: any;
  user?: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
  };
  files?: Attachment[];
}

export interface Attachment {
  id: number;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
}

export interface Chat {
  id: number; // chat.id from manager_client_chats table
  client_user_id?: number;
  external_id?: string;
  source: 'telegram' | 'instagram' | 'web' | string;
  telegram_id?: string;
  instagram_id?: string;
  client_name?: string;
  client_username?: string;
  client_phone?: string;
  client_ip?: string;
  client_session_id?: string;
  assigned_manager_id?: number;
  status: 'new' | 'in_progress' | 'closed' | 'snoozed';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  last_message_at?: string;
  first_message_at?: string;
  assigned_at?: string;
  closed_at?: string;
  metadata?: any;
  unread_count?: number; // computed field
  client_avatar?: string; // computed field
  // Relations
  clientUser?: User; // User object for client
  assignedManager?: User; // User object for assigned manager
  messages?: Message[]; // Last 50 messages (from getChat)
  last_message?: Message; // Last message preview (from getChats)
  metrics?: any;
}

export interface LoginRequest {
  email: string;
  password: string;
  role?: string; // optional, for seller
}

export interface LoginResponse {
  accessToken: string;
  userData: User;
  userAbilityRules?: any[];
  userAbilityPages?: any[];
  userAbilityFields?: any[];
  token_type?: string;
}

export interface ChatsResponse {
  data: Chat[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface MessagesResponse {
  data: Message[];
  chat: Chat; // Chat object with client_avatar
}

export interface ChatFilters {
  status?: 'new' | 'in_progress' | 'closed' | 'snoozed';
  source?: string;
  manager_id?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  search?: string; // or 'q' for backward compatibility
  q?: string; // backward compatibility
  page?: number;
  per_page?: number;
}

