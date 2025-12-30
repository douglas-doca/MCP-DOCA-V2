// ============================================
// MCP-DOCA-V2 - Database Service (SQLite)
// ============================================
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';
export class DatabaseService {
    dbPath;
    db; // better-sqlite3 Database
    constructor(dbPath) {
        this.dbPath = dbPath || process.env.DATABASE_PATH || './database/mcp-doca.db';
        // Garantir que o diretório existe
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    async initialize() {
        try {
            // Import dinâmico do better-sqlite3
            const Database = (await import('better-sqlite3')).default;
            this.db = new Database(this.dbPath);
            // Configurações de performance
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            // Criar tabelas
            this.createTables();
            logger.info('Database initialized', { path: this.dbPath }, 'DB');
        }
        catch (error) {
            logger.error('Failed to initialize database', error, 'DB');
            throw error;
        }
    }
    createTables() {
        // Tabela de Leads
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        name TEXT,
        email TEXT,
        source TEXT DEFAULT 'whatsapp',
        score INTEGER DEFAULT 0,
        status TEXT DEFAULT 'new',
        tags TEXT DEFAULT '[]',
        custom_fields TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Tabela de Conversas
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        lead_id TEXT,
        status TEXT DEFAULT 'new',
        context TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_message_at TEXT,
        FOREIGN KEY (lead_id) REFERENCES leads(id)
      )
    `);
        // Tabela de Mensagens
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      )
    `);
        // Tabela de Sequências de Prospecção
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS prospecting_sequences (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        sequence_name TEXT NOT NULL,
        current_step INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        next_action_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES leads(id)
      )
    `);
        // Tabela de Templates
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        category TEXT,
        content TEXT NOT NULL,
        variables TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Índices para performance
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
      CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    `);
        logger.info('Database tables created', undefined, 'DB');
    }
    // ============ Lead Operations ============
    createLead(lead) {
        const id = lead.id || this.generateId();
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO leads (id, phone, name, email, source, score, status, tags, custom_fields, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, lead.phone, lead.name || null, lead.email || null, lead.source || 'whatsapp', lead.score || 0, lead.status || 'new', JSON.stringify(lead.tags || []), JSON.stringify(lead.customFields || {}), now, now);
        return this.getLeadById(id);
    }
    getLeadById(id) {
        const row = this.db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
        return row ? this.rowToLead(row) : null;
    }
    getLeadByPhone(phone) {
        const cleanPhone = phone.replace(/\D/g, '');
        const row = this.db.prepare('SELECT * FROM leads WHERE phone LIKE ?').get(`%${cleanPhone}%`);
        return row ? this.rowToLead(row) : null;
    }
    updateLead(id, updates) {
        const fields = [];
        const values = [];
        if (updates.name !== undefined) {
            fields.push('name = ?');
            values.push(updates.name);
        }
        if (updates.email !== undefined) {
            fields.push('email = ?');
            values.push(updates.email);
        }
        if (updates.score !== undefined) {
            fields.push('score = ?');
            values.push(updates.score);
        }
        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.tags !== undefined) {
            fields.push('tags = ?');
            values.push(JSON.stringify(updates.tags));
        }
        if (updates.customFields !== undefined) {
            fields.push('custom_fields = ?');
            values.push(JSON.stringify(updates.customFields));
        }
        fields.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);
        this.db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return this.getLeadById(id);
    }
    getLeadsByStatus(status) {
        const rows = this.db.prepare('SELECT * FROM leads WHERE status = ?').all(status);
        return rows.map(row => this.rowToLead(row));
    }
    // ============ Conversation Operations ============
    createConversation(phone, chatId) {
        const id = this.generateId();
        const now = new Date().toISOString();
        // Buscar ou criar lead
        let lead = this.getLeadByPhone(phone);
        if (!lead) {
            lead = this.createLead({ phone });
        }
        const stmt = this.db.prepare(`
      INSERT INTO conversations (id, chat_id, phone, lead_id, status, context, created_at, updated_at, last_message_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, chatId, phone, lead.id, 'new', '{}', now, now, now);
        return this.getConversationById(id);
    }
    getConversationById(id) {
        const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
        if (!row)
            return null;
        const messages = this.getMessagesByConversation(id);
        return this.rowToConversation(row, messages);
    }
    getConversationByPhone(phone) {
        const cleanPhone = phone.replace(/\D/g, '');
        const row = this.db.prepare(`
      SELECT * FROM conversations 
      WHERE phone LIKE ? 
      ORDER BY updated_at DESC 
      LIMIT 1
    `).get(`%${cleanPhone}%`);
        if (!row)
            return null;
        const messages = this.getMessagesByConversation(row.id);
        return this.rowToConversation(row, messages);
    }
    getOrCreateConversation(phone, chatId) {
        let conversation = this.getConversationByPhone(phone);
        if (!conversation) {
            conversation = this.createConversation(phone, chatId);
        }
        return conversation;
    }
    updateConversationStatus(id, status) {
        const now = new Date().toISOString();
        this.db.prepare(`
      UPDATE conversations 
      SET status = ?, updated_at = ? 
      WHERE id = ?
    `).run(status, now, id);
    }
    updateConversationContext(id, context) {
        const now = new Date().toISOString();
        this.db.prepare(`
      UPDATE conversations 
      SET context = ?, updated_at = ? 
      WHERE id = ?
    `).run(JSON.stringify(context), now, id);
    }
    getConversationsByStatus(status) {
        const rows = this.db.prepare(`
      SELECT * FROM conversations 
      WHERE status = ? 
      ORDER BY updated_at DESC
    `).all(status);
        return rows.map(row => {
            const messages = this.getMessagesByConversation(row.id);
            return this.rowToConversation(row, messages);
        });
    }
    getGhostedConversations(hoursAgo) {
        const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
        const rows = this.db.prepare(`
      SELECT * FROM conversations 
      WHERE status IN ('active', 'waiting_response') 
      AND last_message_at < ?
      ORDER BY last_message_at ASC
    `).all(cutoff);
        return rows.map(row => {
            const messages = this.getMessagesByConversation(row.id);
            return this.rowToConversation(row, messages);
        });
    }
    // ============ Message Operations ============
    addMessage(conversationId, message) {
        const id = this.generateId();
        const timestamp = message.timestamp?.toISOString() || new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, conversationId, message.role, message.content, timestamp, JSON.stringify(message.metadata || {}));
        // Atualizar last_message_at da conversa
        this.db.prepare(`
      UPDATE conversations 
      SET last_message_at = ?, updated_at = ? 
      WHERE id = ?
    `).run(timestamp, timestamp, conversationId);
        return {
            id,
            role: message.role,
            content: message.content,
            timestamp: new Date(timestamp),
            metadata: message.metadata,
        };
    }
    getMessagesByConversation(conversationId, limit = 50) {
        const rows = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(conversationId, limit);
        return rows.reverse().map(row => this.rowToMessage(row));
    }
    getRecentMessages(conversationId, count = 10) {
        const rows = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(conversationId, count);
        return rows.reverse().map(row => this.rowToMessage(row));
    }
    // ============ Template Operations ============
    createTemplate(name, content, category, variables) {
        const id = this.generateId();
        this.db.prepare(`
      INSERT INTO templates (id, name, category, content, variables)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, category || 'general', content, JSON.stringify(variables || []));
    }
    getTemplate(name) {
        const row = this.db.prepare('SELECT * FROM templates WHERE name = ?').get(name);
        if (!row)
            return null;
        return {
            content: row.content,
            variables: JSON.parse(row.variables),
        };
    }
    getAllTemplates() {
        const rows = this.db.prepare('SELECT name, category, content FROM templates').all();
        return rows.map(row => ({
            name: row.name,
            category: row.category,
            content: row.content,
        }));
    }
    // ============ Prospecting Operations ============
    startProspectingSequence(leadId, sequenceName) {
        const id = this.generateId();
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO prospecting_sequences (id, lead_id, sequence_name, current_step, status, created_at, updated_at)
      VALUES (?, ?, ?, 0, 'active', ?, ?)
    `).run(id, leadId, sequenceName, now, now);
        return id;
    }
    getActiveSequences() {
        const rows = this.db.prepare(`
      SELECT * FROM prospecting_sequences 
      WHERE status = 'active'
    `).all();
        return rows.map(row => ({
            id: row.id,
            leadId: row.lead_id,
            sequenceName: row.sequence_name,
            currentStep: row.current_step,
            nextActionAt: row.next_action_at,
        }));
    }
    advanceSequenceStep(sequenceId, nextActionAt) {
        const now = new Date().toISOString();
        this.db.prepare(`
      UPDATE prospecting_sequences 
      SET current_step = current_step + 1, 
          next_action_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(nextActionAt?.toISOString() || null, now, sequenceId);
    }
    completeSequence(sequenceId) {
        const now = new Date().toISOString();
        this.db.prepare(`
      UPDATE prospecting_sequences 
      SET status = 'completed', updated_at = ?
      WHERE id = ?
    `).run(now, sequenceId);
    }
    // ============ Stats & Analytics ============
    getStats() {
        const totalLeads = this.db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
        const totalConversations = this.db.prepare('SELECT COUNT(*) as count FROM conversations').get().count;
        const activeConversations = this.db.prepare("SELECT COUNT(*) as count FROM conversations WHERE status = 'active'").get().count;
        const ghostedConversations = this.db.prepare("SELECT COUNT(*) as count FROM conversations WHERE status = 'ghosted'").get().count;
        const statusRows = this.db.prepare('SELECT status, COUNT(*) as count FROM leads GROUP BY status').all();
        const leadsByStatus = {};
        statusRows.forEach(row => {
            leadsByStatus[row.status] = row.count;
        });
        return {
            totalLeads,
            totalConversations,
            activeConversations,
            ghostedConversations,
            leadsByStatus,
        };
    }
    // ============ Helper Methods ============
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    rowToLead(row) {
        return {
            id: row.id,
            phone: row.phone,
            name: row.name,
            email: row.email,
            source: row.source,
            score: row.score,
            status: row.status,
            tags: JSON.parse(row.tags),
            customFields: JSON.parse(row.custom_fields),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
    rowToConversation(row, messages) {
        return {
            id: row.id,
            chatId: row.chat_id,
            phone: row.phone,
            status: row.status,
            context: JSON.parse(row.context),
            messages,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : new Date(),
        };
    }
    rowToMessage(row) {
        return {
            id: row.id,
            role: row.role,
            content: row.content,
            timestamp: new Date(row.timestamp),
            metadata: JSON.parse(row.metadata),
        };
    }
    close() {
        if (this.db) {
            this.db.close();
            logger.info('Database connection closed', undefined, 'DB');
        }
    }
}
// Singleton
export const databaseService = new DatabaseService();
//# sourceMappingURL=database.service.js.map