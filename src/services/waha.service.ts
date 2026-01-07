// ============================================
// MCP-DOCA-V2 - WAHA Service
// ============================================

import {
  WAHAConfig,
  WAHAMessage,
  WAHASendMessageParams,
  WAHASendMediaParams,
} from "../types/index.js";
import { logger } from "../utils/logger.js";

interface WAHASession {
  name: string;
  status: string;
  me?: {
    id: string;
    pushName: string;
  };
}

interface WAHAChatInfo {
  id: string;
  name?: string;
  isGroup: boolean;
  participants?: string[];
}

export class WAHAService {
  private baseUrl: string;
  private apiKey: string;
  private session: string;
  private defaultHeaders: Record<string, string>;

  constructor(config?: Partial<WAHAConfig>) {
    // Alguns ambientes acabam injetando "WAHA_BASE_URL=..." como valor.
    // Isso limpa esse lixo e deixa apenas o URL.
    const sanitizeEnvUrl = (v?: string) => {
      if (!v) return "";
      return String(v).trim().replace(/^WAHA_BASE_URL=/i, "");
    };

    const envBaseUrl = sanitizeEnvUrl(process.env.WAHA_BASE_URL);
    this.baseUrl = (config?.baseUrl || envBaseUrl || "http://localhost:3000").replace(/\/$/, "");

    this.apiKey = config?.apiKey || process.env.WAHA_API_KEY || "";
    this.session = config?.session || process.env.WAHA_SESSION || "default";

    this.defaultHeaders = {
      "Content-Type": "application/json",
    };

    // ✅ Compatível com variações do WAHA:
    // - X-Api-Key
    // - Authorization: Bearer
    if (this.apiKey) {
      this.defaultHeaders["X-Api-Key"] = this.apiKey;
      this.defaultHeaders["Authorization"] = `Bearer ${this.apiKey}`;
    }

    logger.waha("WAHA Service initialized", {
      baseUrl: this.baseUrl,
      session: this.session,
      apiKey: this.apiKey ? "***set***" : "***missing***",
    });
  }

  // ============ Helper Methods ============

  private async request<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const timer = logger.startTimer(`WAHA ${method} ${endpoint}`);

    try {
      logger.request(method, url, body);

      const response = await fetch(url, {
        method,
        headers: this.defaultHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await response.text();
      timer();

      // tenta parsear json se possível
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const msg =
          data?.message ||
          data?.error ||
          `WAHA error: ${response.status} ${response.statusText}`;
        throw new Error(msg);
      }

      return data as T;
    } catch (error) {
      logger.error("WAHA request failed", { url, error }, "WAHA");
      throw error;
    }
  }

  /**
   * Normaliza chatId:
   * - Se já vier como WA JID (ex: 5511...@c.us ou @g.us), retorna
   * - Se vier como `web_xxx@web`, retorna
   * - Se vier número (com/sem +55), normaliza e converte para @c.us
   */
  private formatChatId(input: string): string {
    if (!input) return "";

    const v = String(input).trim();

    // Se já for um JID válido (WAHA/WA)
    if (v.includes("@c.us") || v.includes("@g.us") || v.includes("@web")) return v;

    // Se for chatId genérico web_...
    if (v.startsWith("web_")) return `${v}@web`;

    // Remove tudo que não é número
    let cleaned = v.replace(/\D/g, "");

    // Se já vier com 55 e 13 dígitos (ex: 5511999999999)
    if (cleaned.length === 13 && cleaned.startsWith("55")) {
      return `${cleaned}@c.us`;
    }

    // Se vier com 10/11 dígitos (DDD + número), assume Brasil
    if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = "55" + cleaned;
      return `${cleaned}@c.us`;
    }

    // fallback: tenta usar o que tiver
    return `${cleaned}@c.us`;
  }

  // ============ Session Management ============

  async getSessionStatus(): Promise<WAHASession> {
    return this.request<WAHASession>("GET", `/api/sessions/${this.session}`);
  }

  async startSession(): Promise<WAHASession> {
    return this.request<WAHASession>("POST", "/api/sessions", {
      name: this.session,
      config: {
        webhooks: [
          {
            url: process.env.WEBHOOK_URL || "http://localhost:3002/webhook/waha",
            events: ["message", "message.ack", "session.status"],
          },
        ],
      },
    });
  }

  async stopSession(): Promise<void> {
    await this.request<void>("POST", `/api/sessions/${this.session}/stop`);
  }

  async getQRCode(): Promise<{ qr: string }> {
    return this.request<{ qr: string }>("GET", `/api/${this.session}/auth/qr`);
  }

  // ============ Messaging ============

  async sendMessage(params: WAHASendMessageParams): Promise<WAHAMessage> {
    const chatId = this.formatChatId(params.chatId);
    const session = params.session || this.session;

    logger.waha("Sending message", { chatId, textLength: params.text.length });

    return this.request<WAHAMessage>("POST", `/api/sendText`, {
      chatId,
      text: params.text,
      session,
    });
  }

  async sendMedia(params: WAHASendMediaParams): Promise<WAHAMessage> {
    const chatId = this.formatChatId(params.chatId);
    const session = params.session || this.session;

    logger.waha("Sending media", { chatId, mediaUrl: params.mediaUrl });

    return this.request<WAHAMessage>("POST", `/api/sendFile`, {
      chatId,
      file: {
        url: params.mediaUrl,
      },
      caption: params.caption,
      session,
    });
  }

  async sendImage(chatId: string, imageUrl: string, caption?: string): Promise<WAHAMessage> {
    return this.sendMedia({ chatId, mediaUrl: imageUrl, caption });
  }

  async sendDocument(chatId: string, documentUrl: string, filename: string): Promise<WAHAMessage> {
    const formattedChatId = this.formatChatId(chatId);

    return this.request<WAHAMessage>("POST", `/api/sendFile`, {
      chatId: formattedChatId,
      file: {
        url: documentUrl,
        filename,
      },
      session: this.session,
    });
  }

  async sendButtons(
    chatId: string,
    text: string,
    buttons: Array<{ id: string; text: string }>
  ): Promise<WAHAMessage> {
    const formattedChatId = this.formatChatId(chatId);

    return this.request<WAHAMessage>("POST", `/api/sendButtons`, {
      chatId: formattedChatId,
      text,
      buttons: buttons.map((btn) => ({
        id: btn.id,
        text: btn.text,
      })),
      session: this.session,
    });
  }

  async sendList(
    chatId: string,
    title: string,
    description: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>
  ): Promise<WAHAMessage> {
    const formattedChatId = this.formatChatId(chatId);

    return this.request<WAHAMessage>("POST", `/api/sendList`, {
      chatId: formattedChatId,
      title,
      description,
      buttonText,
      sections,
      session: this.session,
    });
  }

  // ============ Chat Management ============

  async getChatInfo(chatId: string): Promise<WAHAChatInfo> {
    const formattedChatId = this.formatChatId(chatId);
    return this.request<WAHAChatInfo>("GET", `/api/${this.session}/chats/${formattedChatId}`);
  }

  async getMessages(chatId: string, limit: number = 50): Promise<WAHAMessage[]> {
    const formattedChatId = this.formatChatId(chatId);
    return this.request<WAHAMessage[]>(
      "GET",
      `/api/${this.session}/chats/${formattedChatId}/messages?limit=${limit}`
    );
  }

  async markAsRead(chatId: string): Promise<void> {
    const formattedChatId = this.formatChatId(chatId);
    await this.request<void>("POST", `/api/${this.session}/chats/${formattedChatId}/read`);
  }

  async sendTyping(chatId: string, duration: number = 3000): Promise<void> {
    const formattedChatId = this.formatChatId(chatId);

    await this.request<void>("POST", `/api/${this.session}/startTyping`, {
      chatId: formattedChatId,
    });

    setTimeout(async () => {
      try {
        await this.request<void>("POST", `/api/${this.session}/stopTyping`, {
          chatId: formattedChatId,
        });
      } catch {
        // ignore
      }
    }, duration);
  }

  // ============ Contact Management ============

  async getContactInfo(contactId: string): Promise<{
    id: string;
    name?: string;
    pushname?: string;
    isBlocked: boolean;
  }> {
    const formattedId = this.formatChatId(contactId);
    return this.request("GET", `/api/${this.session}/contacts/${formattedId}`);
  }

  async checkNumberExists(phone: string): Promise<{ exists: boolean; jid?: string }> {
    const formattedPhone = String(phone).replace(/\D/g, "");
    return this.request("GET", `/api/${this.session}/contacts/check-exists?phone=${formattedPhone}`);
  }

  // ============ Utility ============

  async getScreenshot(): Promise<{ screenshot: string }> {
    return this.request("GET", `/api/${this.session}/screenshot`);
  }

  async getMe(): Promise<{ id: string; pushName: string }> {
    const session = await this.getSessionStatus();
    if (!session.me) throw new Error("Session not authenticated");
    return session.me;
  }

  // ============ Message Formatting Helpers ============

  formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace("@c.us", "").replace(/\D/g, "");

    if (cleaned.length === 13 && cleaned.startsWith("55")) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(
        4,
        9
      )}-${cleaned.slice(9)}`;
    }

    return `+${cleaned}`;
  }

  extractPhoneFromChatId(chatId: string): string {
    return String(chatId).replace("@c.us", "").replace("@g.us", "").replace("@web", "");
  }

  isGroup(chatId: string): boolean {
    return String(chatId).endsWith("@g.us");
  }
}

// Exportar instância singleton
export const wahaService = new WAHAService();
