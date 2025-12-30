// ============================================
// MCP-DOCA-V2 - WAHA Service
// ============================================
import { logger } from '../utils/logger.js';
export class WAHAService {
    baseUrl;
    apiKey;
    session;
    defaultHeaders;
    constructor(config) {
        this.baseUrl = config?.baseUrl || process.env.WAHA_BASE_URL || 'http://localhost:3000';
        this.apiKey = config?.apiKey || process.env.WAHA_API_KEY || '';
        this.session = config?.session || process.env.WAHA_SESSION || 'default';
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
        if (this.apiKey) {
            this.defaultHeaders['X-Api-Key'] = this.apiKey;
        }
        logger.waha('WAHA Service initialized', {
            baseUrl: this.baseUrl,
            session: this.session
        });
    }
    // ============ Helper Methods ============
    async request(method, endpoint, body) {
        const url = `${this.baseUrl}${endpoint}`;
        const timer = logger.startTimer(`WAHA ${method} ${endpoint}`);
        try {
            logger.request(method, url, body);
            const response = await fetch(url, {
                method,
                headers: this.defaultHeaders,
                body: body ? JSON.stringify(body) : undefined,
            });
            const data = await response.json();
            timer();
            if (!response.ok) {
                throw new Error(data.message || `WAHA error: ${response.status}`);
            }
            return data;
        }
        catch (error) {
            logger.error('WAHA request failed', { url, error }, 'WAHA');
            throw error;
        }
    }
    formatChatId(phone) {
        // Remove caracteres não numéricos
        let cleaned = phone.replace(/\D/g, '');
        // Adiciona código do país se não tiver (Brasil = 55)
        if (cleaned.length === 11 || cleaned.length === 10) {
            cleaned = '55' + cleaned;
        }
        // Formato WAHA: 5511999999999@c.us
        return `${cleaned}@c.us`;
    }
    // ============ Session Management ============
    async getSessionStatus() {
        return this.request('GET', `/api/sessions/${this.session}`);
    }
    async startSession() {
        return this.request('POST', '/api/sessions', {
            name: this.session,
            config: {
                webhooks: [
                    {
                        url: process.env.WEBHOOK_URL || 'http://localhost:3001/webhook/waha',
                        events: ['message', 'message.ack', 'session.status'],
                    },
                ],
            },
        });
    }
    async stopSession() {
        await this.request('POST', `/api/sessions/${this.session}/stop`);
    }
    async getQRCode() {
        return this.request('GET', `/api/${this.session}/auth/qr`);
    }
    // ============ Messaging ============
    async sendMessage(params) {
        const chatId = this.formatChatId(params.chatId);
        const session = params.session || this.session;
        logger.waha('Sending message', { chatId, textLength: params.text.length });
        return this.request('POST', `/api/sendText`, {
            chatId,
            text: params.text,
            session,
        });
    }
    async sendMedia(params) {
        const chatId = this.formatChatId(params.chatId);
        const session = params.session || this.session;
        logger.waha('Sending media', { chatId, mediaUrl: params.mediaUrl });
        return this.request('POST', `/api/sendFile`, {
            chatId,
            file: {
                url: params.mediaUrl,
            },
            caption: params.caption,
            session,
        });
    }
    async sendImage(chatId, imageUrl, caption) {
        return this.sendMedia({ chatId, mediaUrl: imageUrl, caption });
    }
    async sendDocument(chatId, documentUrl, filename) {
        const formattedChatId = this.formatChatId(chatId);
        return this.request('POST', `/api/sendFile`, {
            chatId: formattedChatId,
            file: {
                url: documentUrl,
                filename,
            },
            session: this.session,
        });
    }
    async sendButtons(chatId, text, buttons) {
        const formattedChatId = this.formatChatId(chatId);
        return this.request('POST', `/api/sendButtons`, {
            chatId: formattedChatId,
            text,
            buttons: buttons.map(btn => ({
                id: btn.id,
                text: btn.text,
            })),
            session: this.session,
        });
    }
    async sendList(chatId, title, description, buttonText, sections) {
        const formattedChatId = this.formatChatId(chatId);
        return this.request('POST', `/api/sendList`, {
            chatId: formattedChatId,
            title,
            description,
            buttonText,
            sections,
            session: this.session,
        });
    }
    // ============ Chat Management ============
    async getChatInfo(chatId) {
        const formattedChatId = this.formatChatId(chatId);
        return this.request('GET', `/api/${this.session}/chats/${formattedChatId}`);
    }
    async getMessages(chatId, limit = 50) {
        const formattedChatId = this.formatChatId(chatId);
        return this.request('GET', `/api/${this.session}/chats/${formattedChatId}/messages?limit=${limit}`);
    }
    async markAsRead(chatId) {
        const formattedChatId = this.formatChatId(chatId);
        await this.request('POST', `/api/${this.session}/chats/${formattedChatId}/read`);
    }
    async sendTyping(chatId, duration = 3000) {
        const formattedChatId = this.formatChatId(chatId);
        // Start typing
        await this.request('POST', `/api/${this.session}/startTyping`, {
            chatId: formattedChatId,
        });
        // Stop after duration
        setTimeout(async () => {
            try {
                await this.request('POST', `/api/${this.session}/stopTyping`, {
                    chatId: formattedChatId,
                });
            }
            catch (e) {
                // Ignore errors on stop typing
            }
        }, duration);
    }
    // ============ Contact Management ============
    async getContactInfo(contactId) {
        const formattedId = this.formatChatId(contactId);
        return this.request('GET', `/api/${this.session}/contacts/${formattedId}`);
    }
    async checkNumberExists(phone) {
        const formattedPhone = phone.replace(/\D/g, '');
        return this.request('GET', `/api/${this.session}/contacts/check-exists?phone=${formattedPhone}`);
    }
    // ============ Utility ============
    async getScreenshot() {
        return this.request('GET', `/api/${this.session}/screenshot`);
    }
    async getMe() {
        const session = await this.getSessionStatus();
        if (!session.me) {
            throw new Error('Session not authenticated');
        }
        return session.me;
    }
    // ============ Message Formatting Helpers ============
    formatPhoneNumber(phone) {
        // Remove @c.us e formata para display
        const cleaned = phone.replace('@c.us', '').replace(/\D/g, '');
        if (cleaned.length === 13 && cleaned.startsWith('55')) {
            // Formato brasileiro: +55 (11) 99999-9999
            return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
        }
        return `+${cleaned}`;
    }
    extractPhoneFromChatId(chatId) {
        return chatId.replace('@c.us', '').replace('@g.us', '');
    }
    isGroup(chatId) {
        return chatId.endsWith('@g.us');
    }
}
// Exportar instância singleton
export const wahaService = new WAHAService();
//# sourceMappingURL=waha.service.js.map