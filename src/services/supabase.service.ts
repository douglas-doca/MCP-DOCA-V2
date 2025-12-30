// ============================================
// MCP-DOCA-V2 - Supabase Service
// Persistência de dados com Supabase
// ============================================

import { logger } from '../utils/logger.js';
import { 
  Conversation, 
  Message, 
  Lead, 
  ConversationStatus,
  LeadStatus,
} from '../types/index.js';

interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

export class SupabaseService {
  private url: string;
  private serviceKey: string;
  private headers: Record<string, string>;

  constructor(config?: Partial<SupabaseConfig>) {
    this.url = config?.url || process.env.SUPABASE_URL || '';
    this.serviceKey = config?.serviceKey || process.env.SUPABASE_SERVICE_KEY || '';
    
    this.headers = {
      'Content-Type': 'application/json',
      'apikey': this.serviceKey,
      'Authorization': `Bearer ${this.serviceKey}`,
      'Prefer': 'return=representation',
    };

    if (!this.url || !this.serviceKey) {
      logger.warn('Supabase credentials not configured', undefined, 'SUPABASE');
    } else {
      logger.info('Supabase Service initialized', { url: this.url }, 'SUPABASE');
    }
  }

  // ============ Generic API Methods ============

  public async request<T>(
    method: string,
    table: string,
    options?: {
      body?: unknown;
      query?: string;
      single?: boolean;
    }
  ): Promise<T | null> {
    const queryString = options?.query ? `?${options.query}` : '';
    const url = `${this.url}/rest/v1/${table}${queryString}`;

    try {
      const headers = { ...this.headers };
      if (options?.single) {
        headers['Accept'] = 'application/vnd.pgrst.object+json';
      }

      const response = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error(`Supabase ${method} ${table} failed`, { status: response.status, error }, 'SUPABASE');
        return null;
      }

      const text = await response.text();
      if (!text) return null;
      
      return JSON.parse(text) as T;
    } catch (error) {
      logger.error(`Supabase request failed`, error, 'SUPABASE');
      return null;
    }
  }

  // ============ Lead Operations ============

  async createLead(lead: Partial<Lead>): Promise<Lead | null> {
    const id = lead.id || this.generateId();
    const now = new Date().toISOString();

    const data = {
      id,
      phone: lead.phone,
      name: lead.name || null,
      email: lead.email || null,
      source: lead.source || 'whatsapp',
      score: lead.score || 0,
      status: lead.status || 'new',
      tags: lead.tags || [],
      custom_fields: lead.customFields || {},
      created_at: now,
      updated_at: now,
    };

    const result = await this.request<Lead[]>('POST', 'leads', { body: data });
    return result?.[0] ? this.mapLead(result[0]) : null;
  }

  async getLeadById(id: string): Promise<Lead | null> {
    const result = await this.request<Lead>('GET', 'leads', {
      query: `id=eq.${id}`,
      single: true,
    });
    return result ? this.mapLead(result) : null;
  }

  async getLeadByPhone(phone: string): Promise<Lead | null> {
    const cleanPhone = phone.replace(/\D/g, '');
    const result = await this.request<Lead[]>('GET', 'leads', {
      query: `phone=ilike.*${cleanPhone}*&limit=1`,
    });
    return result?.[0] ? this.mapLead(result[0]) : null;
  }

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead | null> {
    const data: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) data.name = updates.name;
    if (updates.email !== undefined) data.email = updates.email;
    if (updates.score !== undefined) data.score = updates.score;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.tags !== undefined) data.tags = updates.tags;
    if (updates.customFields !== undefined) data.custom_fields = updates.customFields;

    const result = await this.request<Lead[]>('PATCH', 'leads', {
      query: `id=eq.${id}`,
      body: data,
    });
    return result?.[0] ? this.mapLead(result[0]) : null;
  }

  async getLeadsByStatus(status: LeadStatus): Promise<Lead[]> {
    const result = await this.request<Lead[]>('GET', 'leads', {
      query: `status=eq.${status}&order=updated_at.desc`,
    });
    return result?.map(r => this.mapLead(r)) || [];
  }

  // ============ Conversation Operations ============

  async createConversation(phone: string, chatId: string): Promise<Conversation | null> {
    const id = this.generateId();
    const now = new Date().toISOString();

    let lead = await this.getLeadByPhone(phone);
    if (!lead) {
      lead = await this.createLead({ phone });
    }

    const data = {
      id,
      chat_id: chatId,
      phone,
      lead_id: lead?.id,
      status: 'new',
      context: {},
      created_at: now,
      updated_at: now,
      last_message_at: now,
    };

    const result = await this.request<any[]>('POST', 'conversations', { body: data });
    if (!result?.[0]) return null;

    return this.mapConversation(result[0], []);
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    const result = await this.request<any>('GET', 'conversations', {
      query: `id=eq.${id}`,
      single: true,
    });
    
    if (!result) return null;

    const messages = await this.getMessagesByConversation(id);
    return this.mapConversation(result, messages);
  }

  async getConversationByPhone(phone: string): Promise<Conversation | null> {
    const cleanPhone = phone.replace(/\D/g, '');
    const result = await this.request<any[]>('GET', 'conversations', {
      query: `phone=ilike.*${cleanPhone}*&order=updated_at.desc&limit=1`,
    });

    if (!result?.[0]) return null;

    const messages = await this.getMessagesByConversation(result[0].id);
    return this.mapConversation(result[0], messages);
  }

  async getOrCreateConversation(phone: string, chatId: string): Promise<Conversation> {
    let conversation = await this.getConversationByPhone(phone);
    if (!conversation) {
      conversation = await this.createConversation(phone, chatId);
    }
    return conversation!;
  }

  async updateConversationStatus(id: string, status: ConversationStatus): Promise<void> {
    await this.request('PATCH', 'conversations', {
      query: `id=eq.${id}`,
      body: {
        status,
        updated_at: new Date().toISOString(),
      },
    });
  }

  async updateConversationContext(id: string, context: Record<string, unknown>): Promise<void> {
    await this.request('PATCH', 'conversations', {
      query: `id=eq.${id}`,
      body: {
        context,
        updated_at: new Date().toISOString(),
      },
    });
  }

  async getConversationsByStatus(status: ConversationStatus): Promise<Conversation[]> {
    const result = await this.request<any[]>('GET', 'conversations', {
      query: `status=eq.${status}&order=updated_at.desc`,
    });

    if (!result) return [];

    const conversations: Conversation[] = [];
    for (const row of result) {
      const messages = await this.getMessagesByConversation(row.id);
      conversations.push(this.mapConversation(row, messages));
    }
    return conversations;
  }

  async getGhostedConversations(hoursAgo: number): Promise<Conversation[]> {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    
    const result = await this.request<any[]>('GET', 'conversations', {
      query: `status=in.(active,waiting_response)&last_message_at=lt.${cutoff}&order=last_message_at.asc`,
    });

    if (!result) return [];

    const conversations: Conversation[] = [];
    for (const row of result) {
      const messages = await this.getMessagesByConversation(row.id);
      conversations.push(this.mapConversation(row, messages));
    }
    return conversations;
  }

  // ============ Message Operations ============

  async addMessage(conversationId: string, message: Omit<Message, 'id'>): Promise<Message | null> {
    const id = this.generateId();
    const timestamp = message.timestamp?.toISOString() || new Date().toISOString();

    const data = {
      id,
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      timestamp,
      metadata: message.metadata || {},
    };

    const result = await this.request<any[]>('POST', 'messages', { body: data });

    await this.request('PATCH', 'conversations', {
      query: `id=eq.${conversationId}`,
      body: {
        last_message_at: timestamp,
        updated_at: timestamp,
      },
    });

    if (!result?.[0]) return null;
    return this.mapMessage(result[0]);
  }

  async getMessagesByConversation(conversationId: string, limit: number = 50): Promise<Message[]> {
    const result = await this.request<any[]>('GET', 'messages', {
      query: `conversation_id=eq.${conversationId}&order=timestamp.desc&limit=${limit}`,
    });
    return result?.reverse().map(r => this.mapMessage(r)) || [];
  }

  async getRecentMessages(conversationId: string, count: number = 10): Promise<Message[]> {
    const result = await this.request<any[]>('GET', 'messages', {
      query: `conversation_id=eq.${conversationId}&order=timestamp.desc&limit=${count}`,
    });
    return result?.reverse().map(r => this.mapMessage(r)) || [];
  }

  // ============ Template Operations ============

  async createTemplate(name: string, content: string, category?: string, variables?: string[]): Promise<void> {
    const id = this.generateId();
    await this.request('POST', 'templates', {
      body: {
        id,
        name,
        category: category || 'general',
        content,
        variables: variables || [],
        created_at: new Date().toISOString(),
      },
    });
  }

  async getTemplate(name: string): Promise<{ content: string; variables: string[] } | null> {
    const result = await this.request<any>('GET', 'templates', {
      query: `name=eq.${name}`,
      single: true,
    });
    if (!result) return null;
    return {
      content: result.content,
      variables: result.variables || [],
    };
  }

  async getAllTemplates(): Promise<Array<{ name: string; category: string; content: string }>> {
    const result = await this.request<any[]>('GET', 'templates', {
      query: 'select=name,category,content',
    });
    return result || [];
  }

  // ============ Prospecting Operations ============

  async startProspectingSequence(leadId: string, sequenceName: string): Promise<string> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.request('POST', 'prospecting_sequences', {
      body: {
        id,
        lead_id: leadId,
        sequence_name: sequenceName,
        current_step: 0,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
    });

    return id;
  }

  async getActiveSequences(): Promise<Array<{
    id: string;
    leadId: string;
    sequenceName: string;
    currentStep: number;
    nextActionAt: string | null;
  }>> {
    const result = await this.request<any[]>('GET', 'prospecting_sequences', {
      query: `status=eq.active`,
    });

    return result?.map(row => ({
      id: row.id,
      leadId: row.lead_id,
      sequenceName: row.sequence_name,
      currentStep: row.current_step,
      nextActionAt: row.next_action_at,
    })) || [];
  }

  async advanceSequenceStep(sequenceId: string, nextActionAt?: Date): Promise<void> {
    const current = await this.request<any>('GET', 'prospecting_sequences', {
      query: `id=eq.${sequenceId}`,
      single: true,
    });

    if (current) {
      await this.request('PATCH', 'prospecting_sequences', {
        query: `id=eq.${sequenceId}`,
        body: {
          current_step: (current.current_step || 0) + 1,
          next_action_at: nextActionAt?.toISOString() || null,
          updated_at: new Date().toISOString(),
        },
      });
    }
  }

  async completeSequence(sequenceId: string): Promise<void> {
    await this.request('PATCH', 'prospecting_sequences', {
      query: `id=eq.${sequenceId}`,
      body: {
        status: 'completed',
        updated_at: new Date().toISOString(),
      },
    });
  }

  // ============ Stats & Analytics ============

  getStats(): {
    totalLeads: number;
    totalConversations: number;
    activeConversations: number;
  } {
    return {
      totalLeads: 0,
      totalConversations: 0,
      activeConversations: 0,
    };
  }

  // ============ Dashboard API Methods ============

  async getConversations(limit: number = 50): Promise<any[]> {
    const result = await this.request<any[]>('GET', 'conversations', {
      query: `order=updated_at.desc&limit=${limit}`,
    });
    return result || [];
  }

  async getLeads(status?: string, limit: number = 50): Promise<any[]> {
    let query = `order=updated_at.desc&limit=${limit}`;
    if (status) {
      query = `status=eq.${status}&${query}`;
    }
    const result = await this.request<any[]>('GET', 'leads', { query });
    return result || [];
  }

  async getDashboardStats(): Promise<{
    totalLeads: number;
    totalConversations: number;
    totalMessages: number;
    activeConversations: number;
    newLeads: number;
    qualifiedLeads: number;
    conversationsByStatus: Record<string, number>;
    leadsByStatus: Record<string, number>;
  }> {
    const leads = await this.request<any[]>('GET', 'leads', {
      query: 'select=id,status',
    });

    const conversations = await this.request<any[]>('GET', 'conversations', {
      query: 'select=id,status',
    });

    const messages = await this.request<any[]>('GET', 'messages', {
      query: 'select=id',
    });

    const leadsByStatus: Record<string, number> = {};
    const conversationsByStatus: Record<string, number> = {};

    leads?.forEach(l => {
      leadsByStatus[l.status] = (leadsByStatus[l.status] || 0) + 1;
    });

    conversations?.forEach(c => {
      conversationsByStatus[c.status] = (conversationsByStatus[c.status] || 0) + 1;
    });

    return {
      totalLeads: leads?.length || 0,
      totalConversations: conversations?.length || 0,
      totalMessages: messages?.length || 0,
      activeConversations: conversationsByStatus['active'] || 0,
      newLeads: leadsByStatus['new'] || 0,
      qualifiedLeads: leadsByStatus['qualified'] || 0,
      conversationsByStatus,
      leadsByStatus,
    };
  }

  // ============ Helper Methods ============

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapLead(row: any): Lead {
    return {
      id: row.id,
      phone: row.phone,
      name: row.name,
      email: row.email,
      source: row.source,
      score: row.score,
      status: row.status as LeadStatus,
      tags: row.tags || [],
      customFields: row.custom_fields || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapConversation(row: any, messages: Message[]): Conversation {
    return {
      id: row.id,
      chatId: row.chat_id,
      phone: row.phone,
      status: row.status as ConversationStatus,
      context: row.context || {},
      messages,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : new Date(),
    };
  }

  private mapMessage(row: any): Message {
    return {
      id: row.id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata || {},
    };
  }

  async initialize(): Promise<void> {
    logger.info('Supabase Service ready', undefined, 'SUPABASE');
  }

  close(): void {
    logger.info('Supabase Service closed', undefined, 'SUPABASE');
  }
}

export const supabaseService = new SupabaseService();
