import { WAHAConfig, WAHAMessage, WAHASendMessageParams, WAHASendMediaParams } from '../types/index.js';
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
export declare class WAHAService {
    private baseUrl;
    private apiKey;
    private session;
    private defaultHeaders;
    constructor(config?: Partial<WAHAConfig>);
    private request;
    private formatChatId;
    getSessionStatus(): Promise<WAHASession>;
    startSession(): Promise<WAHASession>;
    stopSession(): Promise<void>;
    getQRCode(): Promise<{
        qr: string;
    }>;
    sendMessage(params: WAHASendMessageParams): Promise<WAHAMessage>;
    sendMedia(params: WAHASendMediaParams): Promise<WAHAMessage>;
    sendImage(chatId: string, imageUrl: string, caption?: string): Promise<WAHAMessage>;
    sendDocument(chatId: string, documentUrl: string, filename: string): Promise<WAHAMessage>;
    sendButtons(chatId: string, text: string, buttons: Array<{
        id: string;
        text: string;
    }>): Promise<WAHAMessage>;
    sendList(chatId: string, title: string, description: string, buttonText: string, sections: Array<{
        title: string;
        rows: Array<{
            id: string;
            title: string;
            description?: string;
        }>;
    }>): Promise<WAHAMessage>;
    getChatInfo(chatId: string): Promise<WAHAChatInfo>;
    getMessages(chatId: string, limit?: number): Promise<WAHAMessage[]>;
    markAsRead(chatId: string): Promise<void>;
    sendTyping(chatId: string, duration?: number): Promise<void>;
    getContactInfo(contactId: string): Promise<{
        id: string;
        name?: string;
        pushname?: string;
        isBlocked: boolean;
    }>;
    checkNumberExists(phone: string): Promise<{
        exists: boolean;
        jid?: string;
    }>;
    getScreenshot(): Promise<{
        screenshot: string;
    }>;
    getMe(): Promise<{
        id: string;
        pushName: string;
    }>;
    formatPhoneNumber(phone: string): string;
    extractPhoneFromChatId(chatId: string): string;
    isGroup(chatId: string): boolean;
}
export declare const wahaService: WAHAService;
export {};
//# sourceMappingURL=waha.service.d.ts.map