import axios, { AxiosInstance } from "axios";
import { Board } from "../types";

// Security: Validate API URL - ensure HTTPS in production
const getApiBaseUrl = (): string => {
  const url = process.env.API_URL || "https://goranked.gg";
  if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
    console.error("SECURITY: API URL must use HTTPS in production");
    return "https://goranked.gg";
  }
  return url;
};

const API_BASE_URL = getApiBaseUrl();

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
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
          window.location.href = "/login";
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
    return localStorage.getItem("token");
  }

  private async deleteToken(): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.deleteToken();
    } else {
      localStorage.removeItem("token");
    }
  }

  async login(email: string, password: string, role?: string): Promise<any> {
    // Security: Validate inputs
    if (!email || typeof email !== "string" || email.trim().length === 0) {
      throw new Error("Email is required");
    }
    if (!password || typeof password !== "string" || password.length === 0) {
      throw new Error("Password is required");
    }
    if (email.length > 255) {
      throw new Error("Email too long");
    }

    // Mock mode ONLY for local development (disabled in production)
    const MOCK_MODE = process.env.MOCK_MODE === "true";
    const isProduction = process.env.NODE_ENV === "production";

    // Security: Never allow mock mode in production builds
    if (isProduction && MOCK_MODE) {
      throw new Error(
        "Mock mode is disabled in production for security reasons"
      );
    }

    if (
      MOCK_MODE &&
      !isProduction &&
      (email === "test@goranked.gg" || email === "demo@test.com")
    ) {
      return {
        accessToken: "mock-token-" + Date.now(),
        userData: {
          id: 1,
          name: "Test Agent",
          email: email,
          role: "agent",
        },
      };
    }

    const requestBody: any = { email: email.trim(), password };
    if (role && ["agent", "manager", "admin"].includes(role)) {
      requestBody.role = role;
    }
    const response = await this.client.post("/api/auth/login", requestBody);
    return response.data;
  }

  async verify2FA(
    tmpToken: string,
    code?: string,
    recoveryCode?: string,
    rememberDevice?: boolean
  ): Promise<any> {
    // Security: Validate inputs
    if (
      !tmpToken ||
      typeof tmpToken !== "string" ||
      tmpToken.trim().length === 0
    ) {
      throw new Error("Invalid temporary token");
    }
    if (!code && !recoveryCode) {
      throw new Error("Either 2FA code or recovery code is required");
    }
    if (code && (typeof code !== "string" || code.length !== 6)) {
      throw new Error("Invalid 2FA code format");
    }
    if (
      recoveryCode &&
      (typeof recoveryCode !== "string" || recoveryCode.length < 8)
    ) {
      throw new Error("Invalid recovery code format");
    }

    const requestBody: any = { tmp_token: tmpToken.trim() };
    if (code) {
      requestBody.code = code.trim();
    }
    if (recoveryCode) {
      requestBody.recovery_code = recoveryCode.trim();
    }
    if (rememberDevice !== undefined && typeof rememberDevice === "boolean") {
      requestBody.remember_device = rememberDevice;
    }
    const response = await this.client.post(
      "/api/auth/2fa/verify",
      requestBody
    );
    return response.data;
  }

  async logout(): Promise<void> {
    await this.client.post("/api/logout");
  }

  async getMe(): Promise<any> {
    console.log("👤 Requesting user info from /api/user");
    try {
      const response = await this.client.get("/api/user");
      console.log("✅ User info received:", response.data);
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching user info:", error);
      console.error("❌ Error status:", error.response?.status);
      console.error("❌ Error data:", error.response?.data);

      // Try alternative endpoint for full profile
      try {
        console.log("🔄 Trying alternative endpoint: /api/users/profile");
        const response = await this.client.get("/api/users/profile");
        console.log("✅ User info from profile endpoint:", response.data);
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
    if (
      filters.status &&
      ["new", "in_progress", "closed", "snoozed"].includes(filters.status)
    ) {
      params.status = filters.status;
    }

    // Validate source
    if (filters.source && typeof filters.source === "string") {
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
    if (
      filters.priority &&
      ["low", "normal", "high", "urgent"].includes(filters.priority)
    ) {
      params.priority = filters.priority;
    }

    // Validate search (sanitize)
    if (filters.q || filters.search) {
      const search = String(filters.q || filters.search)
        .trim()
        .substring(0, 100);
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
      const response = await this.client.get("/api/manager-client-chats", {
        params,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  }

  async getChat(chatId: number): Promise<any> {
    // Security: Validate chatId
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }

    if (process.env.NODE_ENV === "development") {
      console.log("🔍 Requesting chat details for chatId:", chatId);
    }

    try {
      const response = await this.client.get(
        `/api/manager-client-chats/${chatId}`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied to this chat");
      }
      if (error.response?.status === 404) {
        throw new Error("Chat not found");
      }
      throw error;
    }
  }

  async getMessages(
    chatId: number,
    before?: string,
    limit: number = 50
  ): Promise<any> {
    // Security: Validate chatId and limit
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
      limit = 50; // Enforce max limit
    }

    const params: any = { limit };
    if (before && typeof before === "string") {
      params.before = before;
    }

    try {
      const response = await this.client.get(
        `/api/manager-client-chats/${chatId}/messages`,
        { params }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied to this chat");
      }
      if (error.response?.status === 404) {
        throw new Error("Chat not found");
      }
      throw error;
    }
  }

  async sendMessage(
    chatId: number,
    body: string,
    file?: File,
    type?: string,
    metadata?: any
  ): Promise<any> {
    // Security: Validate chatId
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }

    // Validate: need either body or file
    if (!body?.trim() && !file) {
      throw new Error("Message must have either text or file");
    }

    // Security: Validate file size (max 50MB)
    if (file && file.size > 50 * 1024 * 1024) {
      throw new Error("File size exceeds maximum allowed size (50MB)");
    }

    // Security: Validate body length (max 10000 characters)
    const bodyValue = body ? String(body).trim() : "";
    if (bodyValue.length > 10000) {
      throw new Error("Message body exceeds maximum length (10000 characters)");
    }

    const formData = new FormData();
    formData.append("body", bodyValue);

    // Add metadata if provided (for AI learning)
    if (metadata) {
      formData.append("metadata", JSON.stringify(metadata));
    }

    if (file) {
      // Security: Validate file name length
      if (file.name.length > 255) {
        throw new Error("File name too long");
      }
      formData.append("file", file);
      if (!type) {
        if (file.type.startsWith("image/")) {
          type = "image";
        } else if (file.type.startsWith("video/")) {
          type = "video";
        } else if (file.type.startsWith("audio/")) {
          type = "audio";
        } else {
          type = "file";
        }
      }
      formData.append("type", type);
    } else if (bodyValue) {
      formData.append("type", "text");
    }

    try {
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/messages`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied to this chat");
      }
      throw error;
    }
  }

  async updateMessage(
    chatId: number,
    messageId: number,
    body: string
  ): Promise<any> {
    // Security: Validate inputs
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (!messageId || !Number.isInteger(messageId) || messageId <= 0) {
      throw new Error("Invalid message ID");
    }
    if (!body?.trim()) {
      throw new Error("Message body cannot be empty");
    }

    try {
      const response = await this.client.put(
        `/api/manager-client-chats/${chatId}/messages/${messageId}`,
        {
          body: body.trim(),
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw error;
    }
  }

  async assignChat(chatId: number, managerId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (!managerId || !Number.isInteger(managerId) || managerId <= 0) {
      throw new Error("Invalid manager ID");
    }
    const response = await this.client.post(
      `/api/manager-client-chats/${chatId}/assign`,
      {
        manager_id: managerId,
      }
    );
    return response.data;
  }

  async takeChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    const response = await this.client.post(
      `/api/manager-client-chats/${chatId}/take`
    );
    return response.data;
  }

  async transferChat(chatId: number, managerId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (!managerId || !Number.isInteger(managerId) || managerId <= 0) {
      throw new Error("Invalid manager ID");
    }
    const response = await this.client.post(
      `/api/manager-client-chats/${chatId}/transfer`,
      {
        manager_id: managerId,
      }
    );
    return response.data;
  }

  async closeChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    const response = await this.client.post(
      `/api/manager-client-chats/${chatId}/close`
    );
    return response.data;
  }

  async reopenChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    const response = await this.client.post(
      `/api/manager-client-chats/${chatId}/reopen`
    );
    return response.data;
  }

  async deferChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    const response = await this.client.post(
      `/api/manager-client-chats/${chatId}/defer`
    );
    return response.data;
  }

  async undeferChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    const response = await this.client.post(
      `/api/manager-client-chats/${chatId}/undefer`
    );
    return response.data;
  }

  // Update chat metadata (including tags)
  async updateChatMetadata(chatId: number, metadata: any): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (!metadata || typeof metadata !== "object") {
      throw new Error("Invalid metadata");
    }
    try {
      // Try the dedicated metadata endpoint first
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/metadata`,
        {
          metadata,
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // If metadata endpoint doesn't exist, try PUT to update the whole chat
        try {
          const response = await this.client.put(
            `/api/manager-client-chats/${chatId}`,
            {
              metadata,
            }
          );
          return response.data;
        } catch (putError: any) {
          throw new Error(
            putError.response?.data?.message ||
              putError.message ||
              "Failed to update metadata"
          );
        }
      }
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Failed to update metadata"
      );
    }
  }

  // Update chat note (visible to all managers)
  async updateChatNote(chatId: number, note: string | null): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (note !== null && (typeof note !== "string" || note.length > 5000)) {
      throw new Error("Invalid note (max 5000 characters)");
    }
    try {
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/note`,
        {
          note: note || null,
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Failed to update note"
      );
    }
  }

  // Update client nickname (for display in chat list)
  async updateClientNickname(
    chatId: number,
    clientNickname: string | null
  ): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (
      clientNickname !== null &&
      (typeof clientNickname !== "string" || clientNickname.length > 255)
    ) {
      throw new Error("Invalid client nickname (max 255 characters)");
    }
    try {
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/client-nickname`,
        {
          client_nickname: clientNickname || null,
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Failed to update client nickname"
      );
    }
  }

  // Tags are stored in metadata field, no separate endpoint
  async updateChatTags(chatId: number, tags: string[]): Promise<any> {
    console.warn(
      "⚠️ Tags endpoint not available. Tags should be stored in metadata field."
    );
    // Tags can be updated via metadata field in chat update
    return Promise.resolve({
      success: false,
      message: "Tags endpoint not available",
    });
  }

  async markAsRead(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    try {
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/read`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw error;
    }
  }

  async markMessageAsRead(chatId: number, messageId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (!messageId || !Number.isInteger(messageId) || messageId <= 0) {
      throw new Error("Invalid message ID");
    }
    try {
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/messages/${messageId}/read`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      return { success: false };
    }
  }

  async pinMessage(chatId: number, messageId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (!messageId || !Number.isInteger(messageId) || messageId <= 0) {
      throw new Error("Invalid message ID");
    }
    try {
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/messages/${messageId}/pin`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw error;
    }
  }

  async unpinMessage(chatId: number, messageId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (!messageId || !Number.isInteger(messageId) || messageId <= 0) {
      throw new Error("Invalid message ID");
    }
    try {
      const response = await this.client.delete(
        `/api/manager-client-chats/${chatId}/messages/${messageId}/pin`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw error;
    }
  }

  async markMessageAsUnread(chatId: number, messageId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (!messageId || !Number.isInteger(messageId) || messageId <= 0) {
      throw new Error("Invalid message ID");
    }
    try {
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/messages/${messageId}/unread`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw error;
    }
  }

  async sendTyping(chatId: number, isTyping: boolean): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (typeof isTyping !== "boolean") {
      throw new Error("Invalid typing status");
    }
    const response = await this.client.post(
      `/api/manager-client-chats/${chatId}/typing`,
      {
        is_typing: isTyping,
      }
    );
    return response.data;
  }

  // Files are uploaded together with messages, no separate endpoint for manager-client-chats
  async uploadFile(file: File): Promise<any> {
    console.warn(
      "⚠️ Separate file upload endpoint not available for manager-client-chats. Files should be uploaded with messages."
    );
    return Promise.reject(
      new Error("Use sendMessage with file parameter instead")
    );
  }

  // Quick Replies (Быстрые ответы)
  async getQuickReplies(locale?: string): Promise<any> {
    console.log(
      "⚡ Requesting quick replies",
      locale ? `for locale: ${locale}` : ""
    );
    try {
      const params: any = {};
      if (locale) {
        params.locale = locale;
      }
      const response = await this.client.get("/api/quick-replies", { params });
      console.log("✅ Quick replies received:", response.data);
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching quick replies:", error);
      throw error;
    }
  }

  async getQuickReply(id: number): Promise<any> {
    console.log("⚡ Requesting quick reply:", id);
    try {
      const response = await this.client.get(`/api/quick-replies/${id}`);
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching quick reply:", error);
      throw error;
    }
  }

  // Priority management
  async updateChatPriority(
    chatId: number,
    priority: "low" | "normal" | "high" | "urgent"
  ): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    if (!["low", "normal", "high", "urgent"].includes(priority)) {
      throw new Error("Invalid priority value");
    }
    try {
      const response = await this.client.put(
        `/api/manager-client-chats/${chatId}/priority`,
        {
          priority,
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw error;
    }
  }

  // Skip chat (mark as no response needed)
  async skipChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    try {
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/skip`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw error;
    }
  }

  async unskipChat(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    try {
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/unskip`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw error;
    }
  }

  // SLA violations
  async getSlaViolations(): Promise<any> {
    console.log("⚠️ Requesting SLA violations");
    try {
      const response = await this.client.get(
        "/api/manager-client-chats/sla/violations"
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching SLA violations:", error);
      throw error;
    }
  }

  async getSlaStats(): Promise<any> {
    console.log("📊 Requesting SLA stats");
    try {
      const response = await this.client.get(
        "/api/manager-client-chats/sla/stats"
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching SLA stats:", error);
      throw error;
    }
  }

  async ignoreSlaViolation(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    try {
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/ignore-sla`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw error;
    }
  }

  // Unread count
  async getUnreadCount(): Promise<any> {
    console.log("🔔 Requesting unread count");
    try {
      const response = await this.client.get(
        "/api/manager-client-chats/unread-count"
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching unread count:", error);
      throw error;
    }
  }

  // Chat config
  async getChatConfig(): Promise<any> {
    console.log("⚙️ Requesting chat config");
    try {
      const response = await this.client.get(
        "/api/manager-client-chats/config"
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching chat config:", error);
      throw error;
    }
  }

  // Client info (информация о клиенте)
  async getClientInfo(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    try {
      const response = await this.client.get(
        `/api/manager-client-chats/${chatId}/client-info`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw error;
    }
  }

  async getClientOrders(chatId: number): Promise<any> {
    if (!chatId || !Number.isInteger(chatId) || chatId <= 0) {
      throw new Error("Invalid chat ID");
    }
    try {
      const response = await this.client.get(
        `/api/manager-client-chats/${chatId}/client-orders`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error("Access denied");
      }
      throw error;
    }
  }

  // Get available managers for assignment
  async getAvailableManagers(): Promise<any> {
    console.log("👥 Requesting available managers");
    try {
      const response = await this.client.get("/api/manager-kpi/managers");
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching managers:", error);
      throw error;
    }
  }

  // Get user by ID (для получения аватара и дополнительной информации)
  async getUser(userId: number): Promise<any> {
    console.log("👤 Requesting user info:", userId);
    try {
      const response = await this.client.get(`/api/users/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching user:", error);
      throw error;
    }
  }

  // ==================== AI SUGGESTIONS API ====================

  // Get AI suggestions for chat replies
  async getAiSuggestions(chatId: number, options?: { context_limit?: number; model?: string; force_refresh?: boolean }): Promise<any> {
    console.log("🤖 Requesting AI suggestions for chat:", chatId);
    try {
      const response = await this.client.get(
        `/api/manager-client-chats/${chatId}/ai/suggestions`,
        { params: options }
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching AI suggestions:", error);
      throw error;
    }
  }

  // Mark AI suggestion as used (for learning)
  async markAiSuggestionUsed(chatId: number, suggestionId: string): Promise<any> {
    console.log("✅ Marking AI suggestion as used:", { chatId, suggestionId });
    try {
      const response = await this.client.post(
        `/api/manager-client-chats/${chatId}/ai/suggestions/${suggestionId}/use`
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error marking suggestion as used:", error);
      throw error;
    }
  }

  // ==================== TASKS API ====================

  // Get boards subdata (статусы, пользователи, доски, категории)
  async getBoardsSubdata(): Promise<any> {
    console.log("📋 Requesting boards subdata");
    try {
      const response = await this.client.get("/api/boards/subdata");
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching boards subdata:", error);
      throw error;
    }
  }

  // Get all boards
  async getBoards(): Promise<any[]> {
    console.log("📋 Requesting boards");
    try {
      const response = await this.client.get("/api/boards");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("❌ Error fetching boards:", error);
      throw error;
    }
  }

  // Get tasks list with grouping
  async getTasksList(params: {
    category_id?: number;
    status_id?: number;
    assignee_id?: number;
    board_id?: number;
    status_filter?: "open" | "closed";
    group_by?: "status" | "finish_at" | "assignee" | "board";
  }): Promise<any> {
    console.log("📋 Requesting tasks list", params);
    try {
      const queryParams = new URLSearchParams();
      if (params.category_id)
        queryParams.append("category_id", params.category_id.toString());
      if (params.status_id)
        queryParams.append("status_id", params.status_id.toString());
      if (params.assignee_id)
        queryParams.append("assignee_id", params.assignee_id.toString());
      if (params.board_id)
        queryParams.append("board_id", params.board_id.toString());
      if (params.status_filter)
        queryParams.append("status_filter", params.status_filter);
      if (params.group_by) queryParams.append("group_by", params.group_by);

      const response = await this.client.get(
        `/api/boards/tasks/list?${queryParams.toString()}`
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error fetching tasks list:", error);
      throw error;
    }
  }

  // Get tasks assigned to me
  async getAssignedTasks(): Promise<any[]> {
    console.log("📋 Requesting assigned tasks");
    try {
      const response = await this.client.get(
        "/api/boards/tasks/assigned-to-me"
      );
      return response.data?.data || [];
    } catch (error: any) {
      console.error("❌ Error fetching assigned tasks:", error);
      throw error;
    }
  }

  // Get single task
  async getTask(boardId: number, taskId: number): Promise<any> {
    console.log("📋 Requesting task", { boardId, taskId });
    try {
      const response = await this.client.get(
        `/api/boards/${boardId}/tasks/${taskId}`
      );
      return response.data?.task || response.data;
    } catch (error: any) {
      console.error("❌ Error fetching task:", error);
      throw error;
    }
  }

  // Create task
  async createTask(boardId: number, taskData: any): Promise<any> {
    console.log("📋 Creating task", { boardId, taskData });
    try {
      const response = await this.client.post(
        `/api/boards/${boardId}/tasks`,
        taskData
      );
      return response.data?.task || response.data;
    } catch (error: any) {
      console.error("❌ Error creating task:", error);
      throw error;
    }
  }

  // Update task
  async updateTask(
    boardId: number,
    taskId: number,
    taskData: any
  ): Promise<any> {
    console.log("📋 Updating task", { boardId, taskId, taskData });
    try {
      const response = await this.client.post(
        `/api/boards/${boardId}/tasks/${taskId}`,
        taskData
      );
      return response.data?.task || response.data;
    } catch (error: any) {
      console.error("❌ Error updating task:", error);
      throw error;
    }
  }

  // Delete task
  async deleteTask(boardId: number, taskId: number): Promise<void> {
    console.log("📋 Deleting task", { boardId, taskId });
    try {
      await this.client.delete(`/api/boards/${boardId}/tasks/${taskId}`);
    } catch (error: any) {
      console.error("❌ Error deleting task:", error);
      throw error;
    }
  }

  // Complete recurring task
  async completeRecurringTask(boardId: number, taskId: number): Promise<any> {
    console.log("📋 Completing recurring task", { boardId, taskId });
    try {
      const response = await this.client.post(
        `/api/boards/${boardId}/tasks/${taskId}/complete-recurring`
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error completing recurring task:", error);
      throw error;
    }
  }

  // Get task comments
  async getTaskComments(boardId: number, taskId: number): Promise<any[]> {
    console.log("💬 Requesting task comments", { boardId, taskId });
    try {
      const response = await this.client.get(
        `/api/boards/${boardId}/tasks/${taskId}/comments`
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("❌ Error fetching task comments:", error);
      throw error;
    }
  }

  // Create task comment
  async createTaskComment(
    boardId: number,
    taskId: number,
    comment: string,
    file?: File
  ): Promise<any> {
    console.log("💬 Creating task comment", { boardId, taskId });
    try {
      const formData = new FormData();
      formData.append("comment", comment);
      if (file) {
        formData.append("file", file);
      }

      const response = await this.client.post(
        `/api/boards/${boardId}/tasks/${taskId}/comments`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error creating task comment:", error);
      throw error;
    }
  }

  // Delete task comment
  async deleteTaskComment(
    boardId: number,
    taskId: number,
    commentId: number
  ): Promise<void> {
    console.log("💬 Deleting task comment", { boardId, taskId, commentId });
    try {
      await this.client.delete(
        `/api/boards/${boardId}/tasks/${taskId}/comments/${commentId}`
      );
    } catch (error: any) {
      console.error("❌ Error deleting task comment:", error);
      throw error;
    }
  }

  // Search orders for task assignment
  async searchOrders(params: {
    type: string;
    search: string;
    limit?: number;
  }): Promise<any[]> {
    console.log("🔍 Searching orders", params);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append("type", params.type);
      queryParams.append("search", params.search);
      if (params.limit) queryParams.append("limit", params.limit.toString());

      const response = await this.client.get(
        `/api/tasks/search-orders?${queryParams.toString()}`
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("❌ Error searching orders:", error);
      throw error;
    }
  }

  // Get roles (for category management)
  async getRoles(): Promise<any[]> {
    console.log("👥 Requesting roles");
    try {
      const response = await this.client.get("/api/roles");
      return Array.isArray(response.data)
        ? response.data
        : response.data?.roles || [];
    } catch (error: any) {
      console.error("❌ Error fetching roles:", error);
      throw error;
    }
  }

  // Check access (permissions)
  async checkAccess(
    subject: string,
    action: string = "show"
  ): Promise<boolean> {
    // This should be handled by backend, but we can cache permissions
    // For now, return true - backend will handle actual authorization
    return true;
  }

  // Reorder boards
  async reorderBoards(boardIds: number[]): Promise<void> {
    console.log("📋 Reordering boards", boardIds);
    try {
      await this.client.post("/api/boards/reorder", { ids: boardIds });
    } catch (error: any) {
      console.error("❌ Error reordering boards:", error);
      throw error;
    }
  }

  // Create board
  async createBoard(name: string): Promise<Board> {
    console.log("📋 Creating board", name);
    try {
      const response = await this.client.post("/api/boards", { name });
      return response.data;
    } catch (error: any) {
      console.error("❌ Error creating board:", error);
      throw error;
    }
  }

  // Update board
  async updateBoard(boardId: number, data: { name?: string }): Promise<Board> {
    console.log("📋 Updating board", boardId, data);
    try {
      const response = await this.client.post(`/api/boards/${boardId}`, data);
      return response.data;
    } catch (error: any) {
      console.error("❌ Error updating board:", error);
      throw error;
    }
  }

  // Delete board
  async deleteBoard(boardId: number): Promise<void> {
    console.log("📋 Deleting board", boardId);
    try {
      await this.client.delete(`/api/boards/${boardId}`);
    } catch (error: any) {
      console.error("❌ Error deleting board:", error);
      throw error;
    }
  }

  // ==================== STATUSES & CATEGORIES MANAGEMENT ====================

  // Create status
  async createStatus(data: { name: string; color?: string }): Promise<any> {
    console.log("📋 Creating status", data);
    try {
      const response = await this.client.post("/api/boards/statuses", data);
      return response.data;
    } catch (error: any) {
      console.error("❌ Error creating status:", error);
      throw error;
    }
  }

  // Update status
  async updateStatus(
    statusId: number,
    data: { name?: string; color?: string }
  ): Promise<any> {
    console.log("📋 Updating status", statusId, data);
    try {
      const response = await this.client.post(
        `/api/boards/statuses/${statusId}`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error updating status:", error);
      throw error;
    }
  }

  // Delete status
  async deleteStatus(statusId: number): Promise<void> {
    console.log("📋 Deleting status", statusId);
    try {
      await this.client.delete(`/api/boards/statuses/${statusId}`);
    } catch (error: any) {
      console.error("❌ Error deleting status:", error);
      throw error;
    }
  }

  // Create category
  async createCategory(data: {
    name: string;
    color?: string;
    visible_role_ids?: number[];
    create_role_ids?: number[];
  }): Promise<any> {
    console.log("📋 Creating category", data);
    try {
      const response = await this.client.post("/api/boards/categories", data);
      return response.data;
    } catch (error: any) {
      console.error("❌ Error creating category:", error);
      throw error;
    }
  }

  // Update category
  async updateCategory(
    categoryId: number,
    data: {
      name?: string;
      color?: string;
      visible_role_ids?: number[];
      create_role_ids?: number[];
    }
  ): Promise<any> {
    console.log("📋 Updating category", categoryId, data);
    try {
      const response = await this.client.post(
        `/api/boards/categories/${categoryId}`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error updating category:", error);
      throw error;
    }
  }

  // Delete category
  async deleteCategory(categoryId: number): Promise<void> {
    console.log("📋 Deleting category", categoryId);
    try {
      await this.client.delete(`/api/boards/categories/${categoryId}`);
    } catch (error: any) {
      console.error("❌ Error deleting category:", error);
      throw error;
    }
  }

  // ==================== AUTOMATION ====================

  // Get automation rules
  async getAutomationRules(): Promise<any[]> {
    console.log("🤖 Requesting automation rules");
    try {
      const response = await this.client.get("/api/boards/automation-rules");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("❌ Error fetching automation rules:", error);
      throw error;
    }
  }

  // Create automation rule
  async createAutomationRule(rule: any): Promise<any> {
    console.log("🤖 Creating automation rule", rule);
    try {
      const response = await this.client.post(
        "/api/boards/automation-rules",
        rule
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error creating automation rule:", error);
      throw error;
    }
  }

  // Update automation rule
  async updateAutomationRule(ruleId: number, rule: any): Promise<any> {
    console.log("🤖 Updating automation rule", ruleId, rule);
    try {
      const response = await this.client.post(
        `/api/boards/automation-rules/${ruleId}`,
        rule
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Error updating automation rule:", error);
      throw error;
    }
  }

  // Delete automation rule
  async deleteAutomationRule(ruleId: number): Promise<void> {
    console.log("🤖 Deleting automation rule", ruleId);
    try {
      await this.client.delete(`/api/boards/automation-rules/${ruleId}`);
    } catch (error: any) {
      console.error("❌ Error deleting automation rule:", error);
      throw error;
    }
  }
}

export const apiClient = new ApiClient();
