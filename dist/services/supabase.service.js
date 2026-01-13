// ============================================
// MCP-DOCA-V2 - Supabase Service
// Persistência de dados com Supabase
// ============================================
import { logger } from "../utils/logger.js";
export class SupabaseService {
    url;
    serviceKey;
    headers;
    constructor(config) {
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
        }
        else {
            logger.info("Supabase Service initialized", { url: this.url }, "SUPABASE");
        }
    }
    // ============ Generic API Methods ============
    async request(method, table, options) {
        const queryString = options?.query ? `?${options.query}` : "";
        const url = `${this.url}/rest/v1/${table}${queryString}`;
        try {
            const headers = { ...this.headers };
            // Se for single, o Supabase devolve um único objeto
            if (options?.single) {
                headers["Accept"] = "application/vnd.pgrst.object+json";
            }
            const response = await fetch(url, {
                method,
                headers,
                body: options?.body ? JSON.stringify(options.body) : undefined,
            });
            if (!response.ok) {
                const error = await response.text();
                // Não loga erro se for 409 (Conflict), pois trataremos no createLead
                if (response.status !== 409) {
                    logger.error(`Supabase ${method} ${table} failed`, { status: response.status, error }, "SUPABASE");
                }
                return null;
            }
            const text = await response.text();
            if (!text)
                return null;
            return JSON.parse(text);
        }
        catch (error) {
            logger.error("Supabase request failed", error, "SUPABASE");
            return null;
        }
    }
    // ============ Lead Operations ============
    async createLead(lead) {
        const id = lead.id || this.generateId();
        const now = new Date().toISOString();
        const data = {
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
        // Tenta criar
        const result = await this.request("POST", "leads", { body: data });
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
    async getLeadById(id) {
        const result = await this.request("GET", "leads", {
            query: `id=eq.${id}`,
            single: true,
        });
        return result ? this.mapLead(result) : null;
    }
    async getLeadByPhone(phone) {
        let query = "";
        // CORREÇÃO CRÍTICA: Se tiver letras ou dois pontos, é um ID de sessão, NÃO limpa!
        if (phone.includes(":") || /[a-zA-Z]/.test(phone)) {
            // Busca exata para IDs de sessão
            query = `phone=eq.${phone}&limit=1`;
        }
        else {
            // Se for telefone normal (só números), mantém a limpeza e busca flexível
            const cleanPhone = phone.replace(/\D/g, "");
            query = `phone=ilike.*${cleanPhone}*&limit=1`;
        }
        const result = await this.request("GET", "leads", {
            query: query,
        });
        return result?.[0] ? this.mapLead(result[0]) : null;
    }
    async updateLead(id, updates) {
        const data = {
            updated_at: new Date().toISOString(),
        };
        if (updates.name !== undefined)
            data.name = updates.name;
        if (updates.email !== undefined)
            data.email = updates.email;
        if (updates.score !== undefined)
            data.score = updates.score;
        if (updates.status !== undefined)
            data.status = updates.status;
        if (updates.tags !== undefined)
            data.tags = updates.tags;
        if (updates.customFields !== undefined)
            data.custom_fields = updates.customFields;
        if (updates.stage !== undefined)
            data.stage = updates.stage;
        const result = await this.request("PATCH", "leads", {
            query: `id=eq.${id}`,
            body: data,
        });
        return result?.[0] ? this.mapLead(result[0]) : null;
    }
    async getLeadsByStatus(status) {
        const result = await this.request("GET", "leads", {
            query: `status=eq.${status}&order=updated_at.desc`,
        });
        return result?.map((r) => this.mapLead(r)) || [];
    }
    // ============ Conversation Operations ============
    async createConversation(phone, chatId) {
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
            status: "new",
            context: {},
            created_at: now,
            updated_at: now,
            last_message_at: now,
        };
        const result = await this.request("POST", "conversations", { body: data });
        if (!result?.[0])
            return null;
        return this.mapConversation(result[0], []);
    }
    async getConversationById(id) {
        const result = await this.request("GET", "conversations", {
            query: `id=eq.${id}`,
            single: true,
        });
        if (!result)
            return null;
        const messages = await this.getMessagesByConversation(id);
        return this.mapConversation(result, messages);
    }
    async getConversationByPhone(phone) {
        let query = "";
        // Mesma lógica de proteção do ID de sessão
        if (phone.includes(":") || /[a-zA-Z]/.test(phone)) {
            query = `phone=eq.${phone}&order=updated_at.desc&limit=1`;
        }
        else {
            const cleanPhone = phone.replace(/\D/g, "");
            query = `phone=ilike.*${cleanPhone}*&order=updated_at.desc&limit=1`;
        }
        const result = await this.request("GET", "conversations", {
            query: query,
        });
        if (!result?.[0])
            return null;
        const messages = await this.getMessagesByConversation(result[0].id);
        return this.mapConversation(result[0], messages);
    }
    async getOrCreateConversation(phone, chatId) {
        let conversation = await this.getConversationByPhone(phone);
        if (!conversation) {
            conversation = await this.createConversation(phone, chatId);
        }
        if (!conversation) {
            throw new Error("Supabase: Failed to getOrCreateConversation");
        }
        return conversation;
    }
    async updateConversationStatus(id, status) {
        await this.request("PATCH", "conversations", {
            query: `id=eq.${id}`,
            body: {
                status,
                updated_at: new Date().toISOString(),
            },
        });
    }
    async updateConversationContext(id, context) {
        await this.request("PATCH", "conversations", {
            query: `id=eq.${id}`,
            body: {
                context,
                updated_at: new Date().toISOString(),
            },
        });
    }
    async getConversationsByStatus(status) {
        const result = await this.request("GET", "conversations", {
            query: `status=eq.${status}&order=updated_at.desc`,
        });
        if (!result)
            return [];
        const conversations = [];
        for (const row of result) {
            const messages = await this.getMessagesByConversation(row.id);
            conversations.push(this.mapConversation(row, messages));
        }
        return conversations;
    }
    async getGhostedConversations(hoursAgo) {
        const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
        const result = await this.request("GET", "conversations", {
            query: `status=in.(active,waiting_response)&last_message_at=lt.${cutoff}&order=last_message_at.asc`,
        });
        if (!result)
            return [];
        const conversations = [];
        for (const row of result) {
            const messages = await this.getMessagesByConversation(row.id);
            conversations.push(this.mapConversation(row, messages));
        }
        return conversations;
    }
    // ============ Message Operations ============
    async addMessage(conversationId, message) {
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
        const result = await this.request("POST", "messages", { body: data });
        await this.request("PATCH", "conversations", {
            query: `id=eq.${conversationId}`,
            body: {
                last_message_at: timestamp,
                updated_at: timestamp,
            },
        });
        if (!result?.[0])
            return null;
        return this.mapMessage(result[0]);
    }
    async getMessagesByConversation(conversationId, limit = 50) {
        const result = await this.request("GET", "messages", {
            query: `conversation_id=eq.${conversationId}&order=timestamp.desc&limit=${limit}`,
        });
        return result?.reverse().map((r) => this.mapMessage(r)) || [];
    }
    async getRecentMessages(conversationId, count = 10) {
        const result = await this.request("GET", "messages", {
            query: `conversation_id=eq.${conversationId}&order=timestamp.desc&limit=${count}`,
        });
        return result?.reverse().map((r) => this.mapMessage(r)) || [];
    }
    // ============ Template Operations ============
    async createTemplate(name, content, category, variables) {
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
    async getTemplate(name) {
        const result = await this.request("GET", "templates", {
            query: `name=eq.${name}`,
            single: true,
        });
        if (!result)
            return null;
        return {
            content: result.content,
            variables: result.variables || [],
        };
    }
    async getAllTemplates() {
        const result = await this.request("GET", "templates", {
            query: "select=name,category,content",
        });
        return result || [];
    }
    // ============ Prospecting Operations ============
    async startProspectingSequence(leadId, sequenceName) {
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
    async getActiveSequences() {
        const result = await this.request("GET", "prospecting_sequences", {
            query: `status=eq.active`,
        });
        return (result?.map((row) => ({
            id: row.id,
            leadId: row.lead_id,
            sequenceName: row.sequence_name,
            currentStep: row.current_step,
            nextActionAt: row.next_action_at,
        })) || []);
    }
    async advanceSequenceStep(sequenceId, nextActionAt) {
        const current = await this.request("GET", "prospecting_sequences", {
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
    async completeSequence(sequenceId) {
        await this.request("PATCH", "prospecting_sequences", {
            query: `id=eq.${sequenceId}`,
            body: {
                status: "completed",
                updated_at: new Date().toISOString(),
            },
        });
    }
    // ============ Dashboard API Methods ============
    async getConversations(limit = 50) {
        const result = await this.request("GET", "conversations", {
            query: `order=updated_at.desc&limit=${limit}`,
        });
        return result || [];
    }
    async getLeads(status, limit = 50) {
        let query = `order=updated_at.desc&limit=${limit}`;
        if (status)
            query = `status=eq.${status}&${query}`;
        const result = await this.request("GET", "leads", { query });
        return result || [];
    }
    async getDashboardStats() {
        const leads = await this.request("GET", "leads", {
            query: "select=id,status",
        });
        const conversations = await this.request("GET", "conversations", {
            query: "select=id,status",
        });
        const messages = await this.request("GET", "messages", {
            query: "select=id",
        });
        const leadsByStatus = {};
        const conversationsByStatus = {};
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
    getStats() {
        return {
            totalLeads: 0,
            totalConversations: 0,
            activeConversations: 0,
        };
    }
    // ============ Helper Methods ============
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    mapLead(row) {
        return {
            id: row.id,
            phone: row.phone,
            name: row.name,
            email: row.email,
            source: row.source,
            score: row.score,
            status: row.status,
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
    mapConversation(row, messages) {
        return {
            id: row.id,
            chatId: row.chat_id,
            phone: row.phone,
            status: row.status,
            context: row.context || {},
            messages,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : new Date(),
        };
    }
    mapMessage(row) {
        return {
            id: row.id,
            role: row.role,
            content: row.content,
            timestamp: new Date(row.timestamp),
            metadata: row.metadata || {},
        };
    }
    async initialize() {
        logger.info("Supabase Service ready", undefined, "SUPABASE");
    }
    close() {
        logger.info("Supabase Service closed", undefined, "SUPABASE");
    }
}
export const supabaseService = new SupabaseService();
