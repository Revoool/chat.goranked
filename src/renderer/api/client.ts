import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.API_URL || 'https://goranked.gg';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add token
    this.client.interceptors.request.use(async (config) => {
      const token = await this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          await this.deleteToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  private async getToken(): Promise<string | null> {
    if (window.electronAPI) {
      const result = await window.electronAPI.getToken();
      return result.success ? result.token : null;
    }
    return localStorage.getItem('token');
  }

  private async deleteToken(): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.deleteToken();
    } else {
      localStorage.removeItem('token');
    }
  }

  async login(email: string, password: string, role?: string): Promise<any> {
    // Security: Validate inputs
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new Error('Email is required');
    }
    if (!password || typeof password !== 'string' || password.length === 0) {
      throw new Error('Password is required');
    }
    if (email.length > 255) {
      throw new Error('Email too long');
    }
    
    // Mock mode ONLY for local development (disabled in production)
    const MOCK_MODE = process.env.MOCK_MODE === 'true';
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Security: Never allow mock mode in production builds
    if (isProduction && MOCK_MODE) {
      throw new Error('Mock mode is disabled in production for security reasons');
    }
    
    if (MOCK_MODE && !isProduction && (email === 'test@goranked.gg' || email === 'demo@test.com')) {
      return {
        accessToken: 'mock-token-' + Date.now(),
        userData: {
          id: 1,
          name: 'Test Agent',
          email: email,
          role: 'agent',
        },
      };
    }

    const requestBody: any = { email: email.trim(), password };
    if (role && ['agent', 'manager', 'admin'].includes(role)) {
      requestBody.role = role;
    }
    const response = await this.client.post('/api/auth/login', requestBody);
    return response.data;
  }

  async verify2FA(tmpToken: string, code?: string, recoveryCode?: string, rememberDevice?: boolean): Promise<any> {
    console.log('Verifying 2FA with tmp_token');
    const requestBody: any = { tmp_token: tmpToken };
    if (code) {
      requestBody.code = code;
    }
    if (recoveryCode) {
      requestBody.recovery_code = recoveryCode;
    }
    if (rememberDevice !== undefined) {
      requestBody.remember_device = rememberDevice;
    }
    const response = await this.client.post('/api/auth/2fa/verify', requestBody);
    console.log('2FA verification successful:', response.data);
    // API returns { accessToken, userData, userAbilityRules, userAbilityPages, userAbilityFields }
    return response.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/api/logout');
  }

  async getMe(): Promise<any> {
    console.log('👤 Requesting user info from /api/user');
    try {
      const response = await this.client.get('/api/user');
      console.log('✅ User info received:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching user info:', error);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      
      // Try alternative endpoint for full profile
      try {
        console.log('🔄 Trying alternative endpoint: /api/users/profile');
        const response = await this.client.get('/api/users/profile');
        console.log('✅ User info from profile endpoint:', response.data);
        return response.data;
      } catch (err: any) {
        console.log(`⚠️ /api/users/profile also failed:`, err.response?.status);
      }
      throw error;
    }
  }

  async getChats(filters: any = {}): Promise<any> {
    // Security: Validate and sanitize filters
    const params: any = {};
    
    // Validate status
    if (filters.status && ['new', 'in_progress', 'closed', 'snoozed'].includes(filters.status)) {
      params.status = filters.status;
    }
    
    // Validate source
    if (filters.source && typeof filters.source === 'string') {
      params.source = filters.source;
    }
    
    // Validate manager_id
    if (filters.manager_id !== undefined && filters.manager_id !== null) {
      const managerId = Number(filters.manager_id);
      if (Number.isInteger(managerId) && managerId > 0) {
        params.manager_id = managerId;
      }
    }
    
    // Validate priority
    if (filters.priority && ['low', 'normal', 'high', 'urgent'].includes(filters.priority)) {
      params.priority = filters.priority;
    }
    
    // Validate search (sanitize)
    if (filters.q || filters.search) {
      const search = String(filters.q || filters.search).trim().substring(0, 100);
      if (search) {
        params.search = search;
      }
    }
    
    // Validate pagination
    if (filters.page) {
      const page = Number(filters.page);
      if (Number.isInteger(page) && page > 0) {
        params.page = page;
      }
    }
    
    if (filters.per_page) {
      const perPage = Number(filters.per_page);
      if (Number.isInteger(perPage) && perPage > 0 && perPage <= 100) {
        params.per_page = perPage;
      }
    }
    
    try {
      const response = await this.client.get('/api/manager-client-chats', { params });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  }

  async getChat(chatId: number): Promise<any> {
    // Security: Validate chatId
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Requesting chat details for chatId:', chatId);
    }
    
    try {
      const response = await this.client.get(`/api/manager-client-chats/${chatId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied to this chat');
      }
      if (error.response?.status === 404) {
        throw new Error('Chat not found');
      }
      throw error;
    }
  }

  async getMessages(chatId: number, before?: string, limit: number = 50): Promise<any> {
    // Security: Validate chatId and limit
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
      limit = 50; // Enforce max limit
    }
    
    const params: any = { limit };
    if (before && typeof before === 'string') {
      params.before = before;
    }
    
    try {
      const response = await this.client.get(`/api/manager-client-chats/${chatId}/messages`, { params });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied to this chat');
      }
      if (error.response?.status === 404) {
        throw new Error('Chat not found');
      }
      throw error;
    }
  }

  async sendMessage(chatId: number, body: string, file?: File, type?: string): Promise<any> {
    // Security: Validate chatId
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    
    // Validate: need either body or file
    if (!body?.trim() && !file) {
      throw new Error('Message must have either text or file');
    }
    
    // Security: Validate file size (max 50MB)
    if (file && file.size > 50 * 1024 * 1024) {
      throw new Error('File size exceeds maximum allowed size (50MB)');
    }
    
    // Security: Validate body length (max 10000 characters)
    const bodyValue = body ? String(body).trim() : '';
    if (bodyValue.length > 10000) {
      throw new Error('Message body exceeds maximum length (10000 characters)');
    }
    
    const formData = new FormData();
    formData.append('body', bodyValue);
    
    if (file) {
      // Security: Validate file name length
      if (file.name.length > 255) {
        throw new Error('File name too long');
      }
      formData.append('file', file);
      if (!type) {
        if (file.type.startsWith('image/')) {
          type = 'image';
        } else if (file.type.startsWith('video/')) {
          type = 'video';
        } else if (file.type.startsWith('audio/')) {
          type = 'audio';
        } else {
          type = 'file';
        }
      }
      formData.append('type', type);
    } else if (bodyValue) {
      formData.append('type', 'text');
    }
    
    try {
      const response = await this.client.post(`/api/manager-client-chats/${chatId}/messages`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied to this chat');
      }
      throw error;
    }
  }

  async updateMessage(chatId: number, messageId: number, body: string): Promise<any> {
    // Security: Validate inputs
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    if (!messageId || !Number.isInteger(messageId) || messageId <= 0) {
      throw new Error('Invalid message ID');
    }
    if (!body?.trim()) {
      throw new Error('Message body cannot be empty');
    }
    
    try {
      const response = await this.client.put(`/api/manager-client-chats/${chatId}/messages/${messageId}`, {
        body: body.trim(),
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  async assignChat(chatId: number, managerId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    if (!managerId || !Number.isInteger(managerId) || managerId <= 0) {
      throw new Error('Invalid manager ID');
    }
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/assign`, {
      manager_id: managerId,
    });
    return response.data;
  }

  async takeChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/take`);
    return response.data;
  }

  async transferChat(chatId: number, managerId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    if (!managerId || !Number.isInteger(managerId) || managerId <= 0) {
      throw new Error('Invalid manager ID');
    }
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/transfer`, {
      manager_id: managerId,
    });
    return response.data;
  }

  async closeChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/close`);
    return response.data;
  }

  async reopenChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/reopen`);
    return response.data;
  }

  async deferChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/defer`);
    return response.data;
  }

  async undeferChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/undefer`);
    return response.data;
  }

  // Update chat metadata (including tags)
  async updateChatMetadata(chatId: number, metadata: any): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('Invalid metadata');
    }
    try {
      try {
        const response = await this.client.post(`/api/manager-client-chats/${chatId}/metadata`, {
          metadata,
        });
        return response.data;
      } catch (metadataError: any) {
        try {
          const response = await this.client.put(`/api/manager-client-chats/${chatId}`, {
            metadata,
          });
          return response.data;
        } catch (putError: any) {
          const response = await this.client.post(`/api/manager-client-chats/${chatId}/update`, {
            metadata,
          });
          return response.data;
        }
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  // Tags are stored in metadata field, no separate endpoint
  async updateChatTags(chatId: number, tags: string[]): Promise<any> {
    console.warn('⚠️ Tags endpoint not available. Tags should be stored in metadata field.');
    // Tags can be updated via metadata field in chat update
    return Promise.resolve({ success: false, message: 'Tags endpoint not available' });
  }

  async markAsRead(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    try {
      const response = await this.client.post(`/api/manager-client-chats/${chatId}/read`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  async markMessageAsRead(chatId: number, messageId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    if (!messageId || !Number.isInteger(messageId) || messageId <= 0) {
      throw new Error('Invalid message ID');
    }
    try {
      const response = await this.client.post(`/api/manager-client-chats/${chatId}/messages/${messageId}/read`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      return { success: false };
    }
  }

  async pinMessage(chatId: number, messageId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    if (!messageId || !Number.isInteger(messageId) || messageId <= 0) {
      throw new Error('Invalid message ID');
    }
    try {
      const response = await this.client.post(`/api/manager-client-chats/${chatId}/messages/${messageId}/pin`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  async unpinMessage(chatId: number, messageId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    if (!messageId || !Number.isInteger(messageId) || messageId <= 0) {
      throw new Error('Invalid message ID');
    }
    try {
      const response = await this.client.delete(`/api/manager-client-chats/${chatId}/messages/${messageId}/pin`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  async markMessageAsUnread(chatId: number, messageId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    if (!messageId || !Number.isInteger(messageId) || messageId <= 0) {
      throw new Error('Invalid message ID');
    }
    try {
      const response = await this.client.post(`/api/manager-client-chats/${chatId}/messages/${messageId}/unread`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  async sendTyping(chatId: number, isTyping: boolean): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    if (typeof isTyping !== 'boolean') {
      throw new Error('Invalid typing status');
    }
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/typing`, {
      is_typing: isTyping,
    });
    return response.data;
  }

  // Files are uploaded together with messages, no separate endpoint for manager-client-chats
  async uploadFile(file: File): Promise<any> {
    console.warn('⚠️ Separate file upload endpoint not available for manager-client-chats. Files should be uploaded with messages.');
    return Promise.reject(new Error('Use sendMessage with file parameter instead'));
  }

  // Quick Replies (Быстрые ответы)
  async getQuickReplies(locale?: string): Promise<any> {
    console.log('⚡ Requesting quick replies', locale ? `for locale: ${locale}` : '');
    try {
      const params: any = {};
      if (locale) {
        params.locale = locale;
      }
      const response = await this.client.get('/api/quick-replies', { params });
      console.log('✅ Quick replies received:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching quick replies:', error);
      throw error;
    }
  }

  async getQuickReply(id: number): Promise<any> {
    console.log('⚡ Requesting quick reply:', id);
    try {
      const response = await this.client.get(`/api/quick-replies/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching quick reply:', error);
      throw error;
    }
  }

  // Priority management
  async updateChatPriority(chatId: number, priority: 'low' | 'normal' | 'high' | 'urgent'): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
      throw new Error('Invalid priority value');
    }
    try {
      const response = await this.client.put(`/api/manager-client-chats/${chatId}/priority`, {
        priority,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  // Skip chat (mark as no response needed)
  async skipChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    try {
      const response = await this.client.post(`/api/manager-client-chats/${chatId}/skip`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  async unskipChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    try {
      const response = await this.client.post(`/api/manager-client-chats/${chatId}/unskip`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  // SLA violations
  async getSlaViolations(): Promise<any> {
    console.log('⚠️ Requesting SLA violations');
    try {
      const response = await this.client.get('/api/manager-client-chats/sla/violations');
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching SLA violations:', error);
      throw error;
    }
  }

  async getSlaStats(): Promise<any> {
    console.log('📊 Requesting SLA stats');
    try {
      const response = await this.client.get('/api/manager-client-chats/sla/stats');
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching SLA stats:', error);
      throw error;
    }
  }

  async ignoreSlaViolation(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    try {
      const response = await this.client.post(`/api/manager-client-chats/${chatId}/ignore-sla`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  // Unread count
  async getUnreadCount(): Promise<any> {
    console.log('🔔 Requesting unread count');
    try {
      const response = await this.client.get('/api/manager-client-chats/unread-count');
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching unread count:', error);
      throw error;
    }
  }

  // Chat config
  async getChatConfig(): Promise<any> {
    console.log('⚙️ Requesting chat config');
    try {
      const response = await this.client.get('/api/manager-client-chats/config');
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching chat config:', error);
      throw error;
    }
  }

  // Client info (информация о клиенте)
  async getClientInfo(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    try {
      const response = await this.client.get(`/api/manager-client-chats/${chatId}/client-info`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  async getClientOrders(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('Invalid chat ID');
    }
    try {
      const response = await this.client.get(`/api/manager-client-chats/${chatId}/client-orders`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Access denied');
      }
      throw error;
    }
  }

  // Get available managers for assignment
  async getAvailableManagers(): Promise<any> {
    console.log('👥 Requesting available managers');
    try {
      const response = await this.client.get('/api/manager-kpi/managers');
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching managers:', error);
      throw error;
    }
  }

  // Get user by ID (для получения аватара и дополнительной информации)
  async getUser(userId: number): Promise<any> {
    console.log('👤 Requesting user info:', userId);
    try {
      const response = await this.client.get(`/api/users/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching user:', error);
      throw error;
    }
  }
}

export const apiClient = new ApiClient();

