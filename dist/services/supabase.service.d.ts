import { Conversation, Message, Lead, ConversationStatus, LeadStatus } from '../types/index.js';
interface SupabaseConfig {
    url: string;
    serviceKey: string;
}
export declare class SupabaseService {
    private url;
    private serviceKey;
    private headers;
    constructor(config?: Partial<SupabaseConfig>);
    request<T>(method: string, table: string, options?: {
        body?: unknown;
        query?: string;
        single?: boolean;
    }): Promise<T | null>;
    createLead(lead: Partial<Lead>): Promise<Lead | null>;
    getLeadById(id: string): Promise<Lead | null>;
    getLeadByPhone(phone: string): Promise<Lead | null>;
    updateLead(id: string, updates: Partial<Lead>): Promise<Lead | null>;
    getLeadsByStatus(status: LeadStatus): Promise<Lead[]>;
    createConversation(phone: string, chatId: string): Promise<Conversation | null>;
    getConversationById(id: string): Promise<Conversation | null>;
    getConversationByPhone(phone: string): Promise<Conversation | null>;
    getOrCreateConversation(phone: string, chatId: string): Promise<Conversation>;
    updateConversationStatus(id: string, status: ConversationStatus): Promise<void>;
    updateConversationContext(id: string, context: Record<string, unknown>): Promise<void>;
    getConversationsByStatus(status: ConversationStatus): Promise<Conversation[]>;
    getGhostedConversations(hoursAgo: number): Promise<Conversation[]>;
    addMessage(conversationId: string, message: Omit<Message, 'id'>): Promise<Message | null>;
    getMessagesByConversation(conversationId: string, limit?: number): Promise<Message[]>;
    getRecentMessages(conversationId: string, count?: number): Promise<Message[]>;
    createTemplate(name: string, content: string, category?: string, variables?: string[]): Promise<void>;
    getTemplate(name: string): Promise<{
        content: string;
        variables: string[];
    } | null>;
    getAllTemplates(): Promise<Array<{
        name: string;
        category: string;
        content: string;
    }>>;
    startProspectingSequence(leadId: string, sequenceName: string): Promise<string>;
    getActiveSequences(): Promise<Array<{
        id: string;
        leadId: string;
        sequenceName: string;
        currentStep: number;
        nextActionAt: string | null;
    }>>;
    advanceSequenceStep(sequenceId: string, nextActionAt?: Date): Promise<void>;
    completeSequence(sequenceId: string): Promise<void>;
    getStats(): {
        totalLeads: number;
        totalConversations: number;
        activeConversations: number;
    };
    getConversations(limit?: number): Promise<any[]>;
    getLeads(status?: string, limit?: number): Promise<any[]>;
    getDashboardStats(): Promise<{
        totalLeads: number;
        totalConversations: number;
        totalMessages: number;
        activeConversations: number;
        newLeads: number;
        qualifiedLeads: number;
        conversationsByStatus: Record<string, number>;
        leadsByStatus: Record<string, number>;
    }>;
    private generateId;
    private mapLead;
    private mapConversation;
    private mapMessage;
    initialize(): Promise<void>;
    close(): void;
}
export declare const supabaseService: SupabaseService;
export {};
//# sourceMappingURL=supabase.service.d.ts.map