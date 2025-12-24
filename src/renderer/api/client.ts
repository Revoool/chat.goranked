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
    // Mock mode for local development (remove in production)
    const MOCK_MODE = process.env.MOCK_MODE === 'true';
    
    if (MOCK_MODE && (email === 'test@goranked.gg' || email === 'demo@test.com')) {
      // Mock response for testing
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

    console.log('Attempting login to:', this.client.defaults.baseURL + '/api/auth/login');
    const requestBody: any = { email, password };
    if (role) {
      requestBody.role = role;
    }
    const response = await this.client.post('/api/auth/login', requestBody);
    console.log('Login response:', response.data);
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
    console.log('🔍 Requesting chats with filters:', filters);
    
    // Convert filters to API format
    const params: any = {};
    if (filters.status) params.status = filters.status;
    if (filters.source) params.source = filters.source;
    if (filters.manager_id !== undefined && filters.manager_id !== null) {
      params.manager_id = filters.manager_id;
    }
    if (filters.priority) params.priority = filters.priority;
    if (filters.q || filters.search) params.search = filters.q || filters.search;
    if (filters.page) params.page = filters.page;
    if (filters.per_page) params.per_page = filters.per_page;
    
    console.log('🔍 Full URL:', this.client.defaults.baseURL + '/api/manager-client-chats', 'Params:', params);
    
    try {
      const response = await this.client.get('/api/manager-client-chats', { params });
      console.log('✅ Chats response received:', response);
      console.log('✅ Response data:', response.data);
      console.log('✅ Response meta:', response.data?.meta);
      
      if (response.data?.data) {
        console.log('✅ First chat example:', response.data.data[0]);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching chats:', error);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      throw error;
    }
  }

  async getChat(chatId: number): Promise<any> {
    console.log('🔍 Requesting chat details for chatId:', chatId);
    console.log('🔍 Endpoint:', this.client.defaults.baseURL + `/api/manager-client-chats/${chatId}`);
    
    try {
      const response = await this.client.get(`/api/manager-client-chats/${chatId}`);
      console.log('✅ Chat details response:', response);
      console.log('✅ Chat data:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching chat:', error);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      throw error;
    }
  }

  async getMessages(chatId: number, before?: string, limit: number = 50): Promise<any> {
    console.log('💬 Requesting messages for chatId:', chatId, 'before:', before, 'limit:', limit);
    
    const params: any = { limit };
    if (before) {
      params.before = before; // ISO timestamp
    }
    
    console.log('💬 Endpoint:', this.client.defaults.baseURL + `/api/manager-client-chats/${chatId}/messages`);
    
    try {
      const response = await this.client.get(`/api/manager-client-chats/${chatId}/messages`, { params });
      console.log('✅ Messages response:', response);
      console.log('✅ Messages data:', response.data);
      console.log('✅ Messages count:', response.data?.data?.length);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching messages:', error);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      throw error;
    }
  }

  async sendMessage(chatId: number, body: string, file?: File, type?: string): Promise<any> {
    console.log('📤 Sending message to chatId:', chatId, 'body:', body, 'hasFile:', !!file, 'file:', file?.name, 'type:', type);
    
    // Validate: need either body or file
    if (!body?.trim() && !file) {
      throw new Error('Message must have either text or file');
    }
    
    const formData = new FormData();
    
    // Body is required - ensure it's always a string
    // If no text but file exists, send empty string (API requires body field)
    const bodyValue = (body && body.trim()) ? body.trim() : '';
    console.log('📤 Body value to send:', bodyValue, 'type:', typeof bodyValue);
    formData.append('body', bodyValue);
    
    if (file) {
      formData.append('file', file);
      // Auto-detect type from file if not provided
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
      console.log('📤 File attached:', file.name, 'size:', file.size, 'mime:', file.type, 'detected type:', type);
    } else if (bodyValue) {
      // If no file but has text, set type to text
      formData.append('type', 'text');
    }
    
    try {
      const response = await this.client.post(`/api/manager-client-chats/${chatId}/messages`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('✅ Message sent successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      console.error('❌ Error message:', error.response?.data?.message || error.message);
      throw error;
    }
  }

  async assignChat(chatId: number, managerId: number): Promise<any> {
    console.log('👤 Assigning chat', chatId, 'to manager', managerId);
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/assign`, {
      manager_id: managerId,
    });
    return response.data;
  }

  async takeChat(chatId: number): Promise<any> {
    console.log('👤 Taking chat', chatId);
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/take`);
    return response.data;
  }

  async transferChat(chatId: number, managerId: number): Promise<any> {
    console.log('👤 Transferring chat', chatId, 'to manager', managerId);
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/transfer`, {
      manager_id: managerId,
    });
    return response.data;
  }

  async closeChat(chatId: number): Promise<any> {
    console.log('🔒 Closing chat', chatId);
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/close`);
    return response.data;
  }

  async reopenChat(chatId: number): Promise<any> {
    console.log('🔓 Reopening chat', chatId);
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/reopen`);
    return response.data;
  }

  async deferChat(chatId: number): Promise<any> {
    console.log('⏸️ Deferring chat', chatId);
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/defer`);
    return response.data;
  }

  async undeferChat(chatId: number): Promise<any> {
    console.log('▶️ Undeferring chat', chatId);
    const response = await this.client.post(`/api/manager-client-chats/${chatId}/undefer`);
    return response.data;
  }

  // Tags are stored in metadata field, no separate endpoint
  async updateChatTags(chatId: number, tags: string[]): Promise<any> {
    console.warn('⚠️ Tags endpoint not available. Tags should be stored in metadata field.');
    // Tags can be updated via metadata field in chat update
    return Promise.resolve({ success: false, message: 'Tags endpoint not available' });
  }

  async markAsRead(chatId: number): Promise<any> {
    console.log('✅ Marking chat as read:', chatId);
    try {
      const response = await this.client.post(`/api/manager-client-chats/${chatId}/read`);
      console.log('✅ Chat marked as read successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to mark chat as read:', error);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      throw error; // Throw error so caller can handle it
    }
  }

  async markMessageAsRead(chatId: number, messageId: number): Promise<any> {
    console.log('✅ Marking message as read:', chatId, messageId);
    try {
      const response = await this.client.post(`/api/manager-client-chats/${chatId}/messages/${messageId}/read`);
      return response.data;
    } catch (error: any) {
      console.warn('⚠️ Could not mark message as read:', error.response?.data?.message);
      return { success: false };
    }
  }

  async sendTyping(chatId: number, isTyping: boolean): Promise<any> {
    console.log('⌨️ Sending typing status:', chatId, isTyping);
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
}

export const apiClient = new ApiClient();

