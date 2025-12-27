export interface User {
  id: number;
  name: string;
  email: string;
  role: 'agent' | 'supervisor' | 'admin';
  avatar?: string;
  is_online?: boolean;
  last_seen_at?: string;
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
  updated_at?: string;
  pinned?: boolean;
  unread?: boolean;
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
  assigned_manager?: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
  }; // Assigned manager object
  assignedManager?: User; // User object for assigned manager (alias)
  messages?: Message[]; // Last 50 messages (from getChat)
  last_message?: Message; // Last message preview (from getChats)
  metrics?: any;
  active_sla_violation?: any; // SLA violation data
  sla_attention?: any; // SLA attention flag
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

// ==================== TASKS TYPES ====================

export interface TaskStatus {
  id: number;
  name: string;
  color?: string;
  order?: number;
}

export interface TaskCategory {
  id: number;
  name: string;
  color?: string;
  visible_role_ids?: number[];
  visible_user_ids?: number[];
  create_role_ids?: number[];
  create_user_ids?: number[];
}

export interface Board {
  id: number;
  name: string;
  description?: string;
  background?: string;
}

export interface Task {
  id: number;
  board_id: number;
  name: string;
  content?: string;
  status_id?: number;
  user_id?: number; // Первый исполнитель (legacy)
  assignee_ids?: number[]; // Все исполнители
  assignees?: User[]; // Массив пользователей-исполнителей
  author?: User; // Автор задачи
  order_id?: number;
  order_type?: string;
  finish_at?: string;
  start_at?: string;
  completed_by?: number;
  completed_at?: string;
  completed_by_user?: User; // Пользователь, который выполнил задачу
  category_id?: number;
  is_priority?: boolean;
  created_at?: string;
  updated_at?: string;
  status?: TaskStatus;
  category?: TaskCategory;
  board?: Board;
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  comment: string;
  file_path?: string;
  file_name?: string;
  created_at: string;
  updated_at?: string;
  user?: User;
}

export interface TaskGroup {
  key: string;
  label: string;
  tasks: Task[];
}

export interface TasksSubdata {
  statuses: TaskStatus[];
  users: User[];
  boards: Board[];
  categories: TaskCategory[];
}

export interface TaskFilters {
  category_id?: number;
  status_id?: number;
  assignee_id?: number;
  board_id?: number;
  status_filter?: 'open' | 'closed';
}

export interface AutomationRule {
  id?: number;
  name: string;
  description?: string;
  is_active: boolean;
  is_recurring: boolean;
  task_name: string;
  task_content?: string;
  status_id?: number;
  category_id?: number;
  assignee_ids?: number[];
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  schedule_times?: string[];
  schedule_days?: number[];
  cron_expression?: string;
  start_date?: string;
  end_date?: string;
  max_creations?: number;
}

export interface Role {
  id: number;
  name: string;
  display_name?: string;
}

