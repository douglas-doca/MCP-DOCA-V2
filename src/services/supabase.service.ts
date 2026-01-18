// ============================================
// MCP-DOCA-V2 - Supabase Service
// Persistência de dados com Supabase
// ============================================

import { logger } from "../utils/logger.js";
import {
  Conversation,
  Message,
  Lead,
  ConversationStatus,
  LeadStatus,
} from "../types/index.js";

interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

export class SupabaseService {
  private url: string;
  private serviceKey: string;
  private headers: Record<string, string>;

  constructor(config?: Partial<SupabaseConfig>) {
    this.url = config?.url || process.env.SUPABASE_URL || "";
    this.serviceKey = config?.serviceKey || process.env.SUPABASE_SERVICE_KEY || "";

    this.headers = {
      "Content-Type": "application/json",
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      Prefer: "return=representation",
    };

    if (!this.url || !this.serviceKey) {
      logger.warn("Supabase credentials not configured", undefined, "SUPABASE");
    } else {
      logger.info("Supabase Service initialized", { url: this.url }, "SUPABASE");
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
    const queryString = options?.query ? `?${options.query}` : "";
    const url = `${this.url}/rest/v1/${table}${queryString}`;

    try {
      const headers = { ...this.headers };

      // Se for single, o Supabase devolve um único objeto
      if (options?.single) {
        headers["Accept"] = "application/vnd.pgrst.object+json";
      }

      // Timeout de 15 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        // Não loga erro se for 409 (Conflict), pois trataremos no createLead
        if (response.status !== 409) {
            logger.error(
            `Supabase ${method} ${table} failed`,
            { status: response.status, error },
            "SUPABASE"
            );
        }
        return null;
      }

      const text = await response.text();
      if (!text) return null;

      return JSON.parse(text) as T;
    } catch (error) {
      logger.error("Supabase request failed", error, "SUPABASE");
      return null;
    }
  }

  // ============ Tenant Operations ============

  // ✅ Buscar tenant_id (UUID) pelo slug (ex: "drhair" -> "61985a43-dcdc-...")
  async getTenantIdBySlug(slug: string): Promise<string | null> {
    try {
      const result = await this.request<any[]>("GET", "tenants", {
        query: `slug=eq.${slug}&select=id`,
      });
      return result?.[0]?.id || null;
    } catch (error) {
      logger.error("Error getting tenant by slug", error, "SUPABASE");
      return null;
    }
  }

  // ============ Lead Operations ============

  // ✅ CORRIGIDO: Agora aceita tenant_id
  async createLead(lead: Partial<Lead> & { tenant_id?: string }): Promise<Lead | null> {
    const id = lead.id || this.generateId();
    const now = new Date().toISOString();

    const data: Record<string, any> = {
      id,
      phone: lead.phone,
      name: lead.name || null,
      email: lead.email || null,
      source: lead.source || "whatsapp",
      score: lead.score || 0,
      status: lead.status || "new",
      tags: lead.tags || [],
      custom_fields: lead.customFields || {},
      created_at: now,
      updated_at: now,
    };

    // ✅ Adiciona tenant_id se fornecido
    if (lead.tenant_id) {
      data.tenant_id = lead.tenant_id;
    }

    // Tenta criar
    const result = await this.request<any[]>("POST", "leads", { body: data });
    
    // Se criou com sucesso, retorna
    if (result?.[0]) {
        return this.mapLead(result[0]);
    }

    // CORREÇÃO CRÍTICA: Se falhou (provavelmente duplicado), busca o existente
    if (lead.phone) {
        logger.warn(`Lead creation skipped (likely duplicate). Fetching existing: ${lead.phone}`, undefined, "SUPABASE");
        return this.getLeadByPhone(lead.phone);
    }

    return null;
  }

  async getLeadById(id: string): Promise<Lead | null> {
    const result = await this.request<any>("GET", "leads", {
      query: `id=eq.${id}`,
      single: true,
    });
    return result ? this.mapLead(result) : null;
  }

  async getLeadByPhone(phone: string): Promise<Lead | null> {
    let query = "";
    
    // CORREÇÃO CRÍTICA: Se tiver letras ou dois pontos, é um ID de sessão, NÃO limpa!
    if (phone.includes(":") || /[a-zA-Z]/.test(phone)) {
       // Busca exata para IDs de sessão
       query = `phone=eq.${phone}&limit=1`;
    } else {
       // Se for telefone normal (só números), mantém a limpeza e busca flexível
       const cleanPhone = phone.replace(/\D/g, "");
       query = `phone=ilike.*${cleanPhone}*&limit=1`;
    }

    const result = await this.request<any[]>("GET", "leads", {
      query: query,
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
    if ((updates as any).stage !== undefined) data.stage = (updates as any).stage;
    
    const result = await this.request<any[]>("PATCH", "leads", {
      query: `id=eq.${id}`,
      body: data,
    });

    return result?.[0] ? this.mapLead(result[0]) : null;
  }

  async getLeadsByStatus(status: LeadStatus): Promise<Lead[]> {
    const result = await this.request<any[]>("GET", "leads", {
      query: `status=eq.${status}&order=updated_at.desc`,
    });
    return result?.map((r) => this.mapLead(r)) || [];
  }

  // ============ Conversation Operations ============

  // ✅ CORRIGIDO: Agora aceita tenant_id
  async createConversation(phone: string, chatId: string, tenantId?: string): Promise<Conversation | null> {
    const id = this.generateId();
    const now = new Date().toISOString();

    let lead = await this.getLeadByPhone(phone);
    if (!lead) {
      lead = await this.createLead({ phone, tenant_id: tenantId });
    }

    const data: Record<string, any> = {
      id,
      chat_id: chatId,
      phone,
      lead_id: lead?.id,
      status: "new",
      context: {},
      created_at: now,
      updated_at: now,
      last_message_at: now,
    };

    // ✅ Adiciona tenant_id se fornecido
    if (tenantId) {
      data.tenant_id = tenantId;
    }

    const result = await this.request<any[]>("POST", "conversations", { body: data });
    if (!result?.[0]) return null;

    return this.mapConversation(result[0], []);
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    const result = await this.request<any>("GET", "conversations", {
      query: `id=eq.${id}`,
      single: true,
    });

    if (!result) return null;

    const messages = await this.getMessagesByConversation(id);
    return this.mapConversation(result, messages);
  }

  async getConversationByPhone(phone: string): Promise<Conversation | null> {
    let query = "";
    
    // Mesma lógica de proteção do ID de sessão
    if (phone.includes(":") || /[a-zA-Z]/.test(phone)) {
        query = `phone=eq.${phone}&order=updated_at.desc&limit=1`;
    } else {
        const cleanPhone = phone.replace(/\D/g, "");
        query = `phone=ilike.*${cleanPhone}*&order=updated_at.desc&limit=1`;
    }

    const result = await this.request<any[]>("GET", "conversations", {
      query: query,
    });

    if (!result?.[0]) return null;

    const messages = await this.getMessagesByConversation(result[0].id);
    return this.mapConversation(result[0], messages);
  }

  // ✅ CORRIGIDO: Agora aceita tenant_id
  async getOrCreateConversation(phone: string, chatId: string, tenantId?: string): Promise<Conversation> {
    let conversation = await this.getConversationByPhone(phone);

    if (!conversation) {
      conversation = await this.createConversation(phone, chatId, tenantId);
    }

    if (!conversation) {
      throw new Error("Supabase: Failed to getOrCreateConversation");
    }

    return conversation;
  }

  async updateConversationStatus(id: string, status: ConversationStatus): Promise<void> {
    await this.request("PATCH", "conversations", {
      query: `id=eq.${id}`,
      body: {
        status,
        updated_at: new Date().toISOString(),
      },
    });
  }

  async updateConversationContext(id: string, context: Record<string, unknown>): Promise<void> {
    await this.request("PATCH", "conversations", {
      query: `id=eq.${id}`,
      body: {
        context,
        updated_at: new Date().toISOString(),
      },
    });
  }

  async getConversationsByStatus(status: ConversationStatus): Promise<Conversation[]> {
    const result = await this.request<any[]>("GET", "conversations", {
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

    const result = await this.request<any[]>("GET", "conversations", {
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

  async addMessage(conversationId: string, message: Omit<Message, "id">): Promise<Message | null> {
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

    const result = await this.request<any[]>("POST", "messages", { body: data });

    await this.request("PATCH", "conversations", {
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
    const result = await this.request<any[]>("GET", "messages", {
      query: `conversation_id=eq.${conversationId}&order=timestamp.desc&limit=${limit}`,
    });

    return result?.reverse().map((r) => this.mapMessage(r)) || [];
  }

  async getRecentMessages(conversationId: string, count: number = 10): Promise<Message[]> {
    const result = await this.request<any[]>("GET", "messages", {
      query: `conversation_id=eq.${conversationId}&order=timestamp.desc&limit=${count}`,
    });

    return result?.reverse().map((r) => this.mapMessage(r)) || [];
  }

  // ============ Template Operations ============

  async createTemplate(
    name: string,
    content: string,
    category?: string,
    variables?: string[]
  ): Promise<void> {
    const id = this.generateId();
    await this.request("POST", "templates", {
      body: {
        id,
        name,
        category: category || "general",
        content,
        variables: variables || [],
        created_at: new Date().toISOString(),
      },
    });
  }

  async getTemplate(name: string): Promise<{ content: string; variables: string[] } | null> {
    const result = await this.request<any>("GET", "templates", {
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
    const result = await this.request<any[]>("GET", "templates", {
      query: "select=name,category,content",
    });
    return result || [];
  }

  // ============ Prospecting Operations ============

  async startProspectingSequence(leadId: string, sequenceName: string): Promise<string> {
    const id = this.generateId();
    const now = new Date().toISOString();

    await this.request("POST", "prospecting_sequences", {
      body: {
        id,
        lead_id: leadId,
        sequence_name: sequenceName,
        current_step: 0,
        status: "active",
        created_at: now,
        updated_at: now,
      },
    });

    return id;
  }

  async getActiveSequences(): Promise<
    Array<{
      id: string;
      leadId: string;
      sequenceName: string;
      currentStep: number;
      nextActionAt: string | null;
    }>
  > {
    const result = await this.request<any[]>("GET", "prospecting_sequences", {
      query: `status=eq.active`,
    });

    return (
      result?.map((row) => ({
        id: row.id,
        leadId: row.lead_id,
        sequenceName: row.sequence_name,
        currentStep: row.current_step,
        nextActionAt: row.next_action_at,
      })) || []
    );
  }

  async advanceSequenceStep(sequenceId: string, nextActionAt?: Date): Promise<void> {
    const current = await this.request<any>("GET", "prospecting_sequences", {
      query: `id=eq.${sequenceId}`,
      single: true,
    });

    if (current) {
      await this.request("PATCH", "prospecting_sequences", {
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
    await this.request("PATCH", "prospecting_sequences", {
      query: `id=eq.${sequenceId}`,
      body: {
        status: "completed",
        updated_at: new Date().toISOString(),
      },
    });
  }

  // ============ Dashboard API Methods ============

  async getConversations(limit: number = 50, tenantId?: string): Promise<any[]> {
    const result = await this.request<any[]>("GET", "conversations", {
      query: tenantId ? `tenant_id=eq.${tenantId}&order=updated_at.desc&limit=${limit}` : `order=updated_at.desc&limit=${limit}`,
    });
    return result || [];
  }

  async getLeads(status?: string, limit: number = 50, tenantId?: string): Promise<any[]> {
    let query = `order=updated_at.desc&limit=${limit}`;
    if (tenantId) query = `tenant_id=eq.${tenantId}&${query}`;
    if (status) query = `status=eq.${status}&${query}`;

    const result = await this.request<any[]>("GET", "leads", { query });
    return result || [];
  }

  // ✅ CORRIGIDO: Agora aceita tenantId para filtrar por cliente
  async getDashboardStats(tenantId?: string): Promise<{
    totalLeads: number;
    totalConversations: number;
    totalMessages: number;
    activeConversations: number;
    newLeads: number;
    qualifiedLeads: number;
    conversationsByStatus: Record<string, number>;
    leadsByStatus: Record<string, number>;
  }> {
    let leadsQuery = "select=id,status";
    let conversationsQuery = "select=id,status";
    let messagesQuery = "select=id";

    // ✅ Filtrar por tenant se especificado
    if (tenantId) {
      leadsQuery += `&tenant_id=eq.${tenantId}`;
      conversationsQuery += `&tenant_id=eq.${tenantId}`;
      messagesQuery += `&tenant_id=eq.${tenantId}`;
    }

    const leads = await this.request<any[]>("GET", "leads", { query: leadsQuery });
    const conversations = await this.request<any[]>("GET", "conversations", { query: conversationsQuery });
    const messages = await this.request<any[]>("GET", "messages", { query: messagesQuery });

    const leadsByStatus: Record<string, number> = {};
    const conversationsByStatus: Record<string, number> = {};

    leads?.forEach((l) => {
      leadsByStatus[l.status] = (leadsByStatus[l.status] || 0) + 1;
    });

    conversations?.forEach((c) => {
      conversationsByStatus[c.status] = (conversationsByStatus[c.status] || 0) + 1;
    });

    return {
      totalLeads: leads?.length || 0,
      totalConversations: conversations?.length || 0,
      totalMessages: messages?.length || 0,
      activeConversations: conversationsByStatus["active"] || 0,
      newLeads: leadsByStatus["new"] || 0,
      qualifiedLeads: leadsByStatus["qualified"] || 0,
      conversationsByStatus,
      leadsByStatus,
    };
  }

  // ============ Stats & Analytics (placeholder) ============

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

      // Dados adicionais
      stage: row.stage || null,
      health_score: row.health_score ?? null,
      urgency_level: row.urgency_level ?? null,
      conversion_probability: row.conversion_probability ?? null,

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
      role: row.role as "user" | "assistant" | "system",
      content: row.content,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata || {},
    };
  }

  async initialize(): Promise<void> {
    logger.info("Supabase Service ready", undefined, "SUPABASE");
  }

  close(): void {
    logger.info("Supabase Service closed", undefined, "SUPABASE");
  }
}

export const supabaseService = new SupabaseService();