import { Conversation, Message, Lead, ConversationStatus, LeadStatus } from '../types/index.js';
export declare class DatabaseService {
    private dbPath;
    private db;
    constructor(dbPath?: string);
    initialize(): Promise<void>;
    private createTables;
    createLead(lead: Partial<Lead>): Lead;
    getLeadById(id: string): Lead | null;
    getLeadByPhone(phone: string): Lead | null;
    updateLead(id: string, updates: Partial<Lead>): Lead | null;
    getLeadsByStatus(status: LeadStatus): Lead[];
    createConversation(phone: string, chatId: string): Conversation;
    getConversationById(id: string): Conversation | null;
    getConversationByPhone(phone: string): Conversation | null;
    getOrCreateConversation(phone: string, chatId: string): Conversation;
    updateConversationStatus(id: string, status: ConversationStatus): void;
    updateConversationContext(id: string, context: Record<string, unknown>): void;
    getConversationsByStatus(status: ConversationStatus): Conversation[];
    getGhostedConversations(hoursAgo: number): Conversation[];
    addMessage(conversationId: string, message: Omit<Message, 'id'>): Message;
    getMessagesByConversation(conversationId: string, limit?: number): Message[];
    getRecentMessages(conversationId: string, count?: number): Message[];
    createTemplate(name: string, content: string, category?: string, variables?: string[]): void;
    getTemplate(name: string): {
        content: string;
        variables: string[];
    } | null;
    getAllTemplates(): Array<{
        name: string;
        category: string;
        content: string;
    }>;
    startProspectingSequence(leadId: string, sequenceName: string): string;
    getActiveSequences(): Array<{
        id: string;
        leadId: string;
        sequenceName: string;
        currentStep: number;
        nextActionAt: string | null;
    }>;
    advanceSequenceStep(sequenceId: string, nextActionAt?: Date): void;
    completeSequence(sequenceId: string): void;
    getStats(): {
        totalLeads: number;
        totalConversations: number;
        activeConversations: number;
        ghostedConversations: number;
        leadsByStatus: Record<string, number>;
    };
    private generateId;
    private rowToLead;
    private rowToConversation;
    private rowToMessage;
    close(): void;
}
export declare const databaseService: DatabaseService;
//# sourceMappingURL=database.service.d.ts.map