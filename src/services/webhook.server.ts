// ============================================
// MCP-DOCA-V2 - Webhook Server + Dashboard
// Recebe mensagens do WAHA e serve o Dashboard
// ============================================

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { logger } from '../utils/logger.js';
import { responseAgent } from './response.agent.js';
import { wahaService } from './waha.service.js';
import { supabaseService } from './supabase.service.js';
import { emotionService } from './emotion.service.js'; // NOVO
import { WAHAWebhookPayload } from '../types/index.js';

interface WebhookConfig {
  port: number;
  host: string;
  secret?: string;
  autoReply: boolean;
  typingDelay: boolean;
  typingDelayMs: number;
  ignoreSelf: boolean;
  ignoreGroups: boolean;
  allowedNumbers?: string[];
  blockedNumbers?: string[];
  staticDir: string;
}

type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: string
) => Promise<void>;

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export class WebhookServer {
  private server: http.Server | null = null;
  private config: WebhookConfig;
  private routes: Map<string, Map<string, RouteHandler>>;
  private processingQueue: Set<string> = new Set();

  constructor(config?: Partial<WebhookConfig>) {
    this.config = {
      port: config?.port || parseInt(process.env.WEBHOOK_PORT || '3002'),
      host: config?.host || '0.0.0.0',
      secret: config?.secret || process.env.WEBHOOK_SECRET,
      autoReply: config?.autoReply ?? true,
      typingDelay: config?.typingDelay ?? false,
      typingDelayMs: config?.typingDelayMs || 2000,
      ignoreSelf: config?.ignoreSelf ?? true,
      ignoreGroups: config?.ignoreGroups ?? true,
      allowedNumbers: config?.allowedNumbers,
      blockedNumbers: config?.blockedNumbers,
      staticDir: config?.staticDir || './public',
    };

    this.routes = new Map();
    this.setupRoutes();
  }

  // ============ Route Setup ============

  private setupRoutes(): void {
    // POST /webhook/waha - Principal endpoint para WAHA
    this.addRoute('POST', '/webhook/waha', this.handleWAHAWebhook.bind(this));

    // POST /webhook/message - Endpoint alternativo
    this.addRoute('POST', '/webhook/message', this.handleWAHAWebhook.bind(this));

    // GET /health - Health check
    this.addRoute('GET', '/health', this.handleHealth.bind(this));

    // GET /stats - Estatísticas
    this.addRoute('GET', '/stats', this.handleStats.bind(this));

    // POST /send - Enviar mensagem manual
    this.addRoute('POST', '/send', this.handleSendMessage.bind(this));

    // GET /conversations/:phone - Buscar conversa
    this.addRoute('GET', '/conversations', this.handleGetConversation.bind(this));

    // GET /api/conversations - Lista conversas (para dashboard)
    this.addRoute('GET', '/api/conversations', this.handleAPIConversations.bind(this));

    // GET /api/leads - Lista leads (para dashboard)
    this.addRoute('GET', '/api/leads', this.handleAPILeads.bind(this));

    // GET /api/messages/:conversationId - Lista mensagens
    this.addRoute('GET', '/api/messages', this.handleAPIMessages.bind(this));

    // GET /api/stats - Stats detalhadas
    this.addRoute('GET', '/api/stats', this.handleAPIStats.bind(this));

    // GET /api/settings/:key - Buscar configuração
    this.addRoute('GET', '/api/settings', this.handleAPIGetSettings.bind(this));

    // POST /api/settings - Salvar configuração
    this.addRoute('POST', '/api/settings', this.handleAPISaveSettings.bind(this));

    // GET /api/knowledge - Listar FAQ
    this.addRoute('GET', '/api/knowledge', this.handleAPIGetKnowledge.bind(this));

    // POST /api/knowledge - Adicionar FAQ
    this.addRoute('POST', '/api/knowledge', this.handleAPISaveKnowledge.bind(this));

    // DELETE /api/knowledge - Remover FAQ
    this.addRoute('DELETE', '/api/knowledge', this.handleAPIDeleteKnowledge.bind(this));

    // ============ NOVAS ROTAS DE EMOÇÃO ============
    
    // GET /api/dashboard/metrics - Métricas gerais do dashboard
    this.addRoute('GET', '/api/dashboard/metrics', this.handleAPIDashboardMetrics.bind(this));

    // GET /api/dashboard/sentiment-matrix - Matriz Sentiment x Intention
    this.addRoute('GET', '/api/dashboard/sentiment-matrix', this.handleAPISentimentMatrix.bind(this));

    // GET /api/dashboard/emotional-funnel - Funil Emocional
    this.addRoute('GET', '/api/dashboard/emotional-funnel', this.handleAPIEmotionalFunnel.bind(this));

    // GET /api/leads/:leadId/health - Health Score de um lead
    this.addRoute('GET', '/api/leads/health', this.handleAPILeadHealth.bind(this));
  }

  private addRoute(method: string, path: string, handler: RouteHandler): void {
    if (!this.routes.has(method)) {
      this.routes.set(method, new Map());
    }
    this.routes.get(method)!.set(path, handler);
  }

  // ============ Static File Server ============

  private async serveStaticFile(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    urlPath: string
  ): Promise<boolean> {
    // Map URL to file path
    let filePath = urlPath === '/' ? '/index.html' : urlPath;
    
    // Remove /dashboard prefix if present
    if (filePath.startsWith('/dashboard')) {
      filePath = filePath.replace('/dashboard', '') || '/index.html';
    }

    const fullPath = path.join(this.config.staticDir, filePath);
    
    // Security: prevent directory traversal
    const normalizedPath = path.normalize(fullPath);
    if (!normalizedPath.startsWith(path.resolve(this.config.staticDir))) {
      return false;
    }

    try {
      // Check if file exists
      if (!fs.existsSync(normalizedPath)) {
        // For SPA routing, serve index.html for non-asset paths
        if (!filePath.includes('.')) {
          const indexPath = path.join(this.config.staticDir, 'index.html');
          if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
            return true;
          }
        }
        return false;
      }

      // Get file stats
      const stats = fs.statSync(normalizedPath);
      if (stats.isDirectory()) {
        // Try to serve index.html from directory
        const indexPath = path.join(normalizedPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          const content = fs.readFileSync(indexPath);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content);
          return true;
        }
        return false;
      }

      // Read and serve file
      const ext = path.extname(normalizedPath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(normalizedPath);

      // Set cache headers for assets
      const cacheControl = ext === '.html' ? 'no-cache' : 'public, max-age=31536000';
      
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': content.length,
        'Cache-Control': cacheControl,
      });
      res.end(content);
      return true;

    } catch (error) {
      logger.error('Error serving static file', error, 'STATIC');
      return false;
    }
  }

  // ============ API Handlers for Dashboard ============

  private async handleAPIConversations(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      const conversations = await supabaseService.getConversations(limit);
      this.sendJSON(res, 200, conversations || []);
    } catch (error) {
      logger.error('Error getting conversations', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to get conversations' });
    }
  }

  private async handleAPILeads(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const status = url.searchParams.get('status') || undefined;
      
      const leads = await supabaseService.getLeads(status, limit);
      this.sendJSON(res, 200, leads || []);
    } catch (error) {
      logger.error('Error getting leads', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to get leads' });
    }
  }

  private async handleAPIMessages(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const conversationId = url.searchParams.get('conversation_id');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      if (!conversationId) {
        this.sendJSON(res, 400, { error: 'conversation_id is required' });
        return;
      }

      const messages = await supabaseService.getRecentMessages(conversationId, limit);
      this.sendJSON(res, 200, messages || []);
    } catch (error) {
      logger.error('Error getting messages', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to get messages' });
    }
  }

  private async handleAPIStats(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const stats = await supabaseService.getDashboardStats();
      this.sendJSON(res, 200, stats);
    } catch (error) {
      logger.error('Error getting stats', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to get stats' });
    }
  }

  // ============ NOVOS HANDLERS DE EMOÇÃO ============

  private async handleAPIDashboardMetrics(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const metrics = await emotionService.getDashboardMetrics();
      this.sendJSON(res, 200, metrics);
    } catch (error) {
      logger.error('Error getting dashboard metrics', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to get dashboard metrics' });
    }
  }

  private async handleAPISentimentMatrix(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const matrix = await emotionService.getSentimentMatrix();
      this.sendJSON(res, 200, matrix);
    } catch (error) {
      logger.error('Error getting sentiment matrix', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to get sentiment matrix' });
    }
  }

  private async handleAPIEmotionalFunnel(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const funnel = await emotionService.getEmotionalFunnel();
      this.sendJSON(res, 200, funnel);
    } catch (error) {
      logger.error('Error getting emotional funnel', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to get emotional funnel' });
    }
  }

  private async handleAPILeadHealth(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const leadId = url.searchParams.get('lead_id');
      
      if (!leadId) {
        this.sendJSON(res, 400, { error: 'lead_id is required' });
        return;
      }

      const health = await emotionService.getLeadHealth(leadId);
      
      if (!health) {
        this.sendJSON(res, 404, { error: 'Lead not found' });
        return;
      }

      this.sendJSON(res, 200, health);
    } catch (error) {
      logger.error('Error getting lead health', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to get lead health' });
    }
  }

  // ============ Settings API Handlers ============

  private async handleAPIGetSettings(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const key = url.searchParams.get('key') || 'agent_prompt';
      
      const result = await supabaseService.request<any[]>('GET', 'settings', {
        query: `key=eq.${key}`
      });
      
      if (result && result[0]) {
        this.sendJSON(res, 200, { key: result[0].key, value: result[0].value });
      } else {
        this.sendJSON(res, 404, { error: 'Setting not found' });
      }
    } catch (error) {
      logger.error('Error getting settings', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to get settings' });
    }
  }

  private async handleAPISaveSettings(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: string
  ): Promise<void> {
    try {
      const { key, value } = JSON.parse(body);
      
      if (!key || !value) {
        this.sendJSON(res, 400, { error: 'Key and value required' });
        return;
      }
      
      // Upsert - update if exists, insert if not
      const existing = await supabaseService.request<any[]>('GET', 'settings', {
        query: `key=eq.${key}`
      });
      
      if (existing && existing.length > 0) {
        await supabaseService.request('PATCH', 'settings', {
          query: `key=eq.${key}`,
          body: { value, updated_at: new Date().toISOString() }
        });
      } else {
        await supabaseService.request('POST', 'settings', {
          body: { key, value, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        });
      }
      
      this.sendJSON(res, 200, { success: true, key });
    } catch (error) {
      logger.error('Error saving settings', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to save settings' });
    }
  }

  // ============ Knowledge Base API Handlers ============

  private async handleAPIGetKnowledge(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const category = url.searchParams.get('category');
      
      let query = 'order=priority.desc,created_at.desc';
      if (category) {
        query = `category=eq.${category}&${query}`;
      }
      
      const result = await supabaseService.request<any[]>('GET', 'knowledge_base', { query });
      this.sendJSON(res, 200, result || []);
    } catch (error) {
      logger.error('Error getting knowledge', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to get knowledge' });
    }
  }

  private async handleAPISaveKnowledge(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: string
  ): Promise<void> {
    try {
      const data = JSON.parse(body);
      
      if (!data.question || !data.answer) {
        this.sendJSON(res, 400, { error: 'Question and answer required' });
        return;
      }
      
      const now = new Date().toISOString();
      
      if (data.id) {
        // Update existing
        await supabaseService.request('PATCH', 'knowledge_base', {
          query: `id=eq.${data.id}`,
          body: { ...data, updated_at: now }
        });
      } else {
        // Insert new
        await supabaseService.request('POST', 'knowledge_base', {
          body: { ...data, created_at: now, updated_at: now }
        });
      }
      
      this.sendJSON(res, 200, { success: true });
    } catch (error) {
      logger.error('Error saving knowledge', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to save knowledge' });
    }
  }

  private async handleAPIDeleteKnowledge(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: string
  ): Promise<void> {
    try {
      const { id } = JSON.parse(body);
      
      if (!id) {
        this.sendJSON(res, 400, { error: 'ID required' });
        return;
      }
      
      await supabaseService.request('DELETE', 'knowledge_base', {
        query: `id=eq.${id}`
      });
      
      this.sendJSON(res, 200, { success: true });
    } catch (error) {
      logger.error('Error deleting knowledge', error, 'API');
      this.sendJSON(res, 500, { error: 'Failed to delete knowledge' });
    }
  }

  // ============ Existing Route Handlers ============

  private async handleWAHAWebhook(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: string
  ): Promise<void> {
    try {
      const payload = JSON.parse(body) as WAHAWebhookPayload;
      
      logger.webhook('WAHA webhook received', {
        event: payload.event,
        from: payload.payload?.from,
      });

      // Verificar evento
      if (payload.event !== 'message') {
        this.sendJSON(res, 200, { status: 'ignored', reason: 'not a message event' });
        return;
      }

      const message = payload.payload;

      // Ignorar mensagens próprias
      if (this.config.ignoreSelf && message.fromMe) {
        this.sendJSON(res, 200, { status: 'ignored', reason: 'self message' });
        return;
      }

      // Ignorar grupos
      if (this.config.ignoreGroups && message.from.endsWith('@g.us')) {
        this.sendJSON(res, 200, { status: 'ignored', reason: 'group message' });
        return;
      }

      // Verificar lista de bloqueio
      if (this.isBlocked(message.from)) {
        this.sendJSON(res, 200, { status: 'ignored', reason: 'blocked number' });
        return;
      }

      // Verificar lista de permitidos
      if (!this.isAllowed(message.from)) {
        this.sendJSON(res, 200, { status: 'ignored', reason: 'not in allowed list' });
        return;
      }

      // Evitar processamento duplicado
      const messageKey = `${message.from}-${message.id}`;
      if (this.processingQueue.has(messageKey)) {
        this.sendJSON(res, 200, { status: 'ignored', reason: 'already processing' });
        return;
      }

      this.processingQueue.add(messageKey);

      // Responder webhook imediatamente
      this.sendJSON(res, 200, { status: 'processing' });

      // Processar mensagem em background
      this.processMessage(message).finally(() => {
        this.processingQueue.delete(messageKey);
      });

    } catch (error) {
      logger.error('Error handling webhook', error, 'WEBHOOK');
      this.sendJSON(res, 500, { error: 'Internal server error' });
    }
  }

  private async handleHealth(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
    this.sendJSON(res, 200, health);
  }

  private async handleStats(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const dbStats = supabaseService.getStats();
      this.sendJSON(res, 200, {
        database: dbStats,
        webhook: {
          autoReply: this.config.autoReply,
          typingDelay: this.config.typingDelay,
          processingQueue: this.processingQueue.size,
        },
      });
    } catch (error) {
      this.sendJSON(res, 500, { error: 'Failed to get stats' });
    }
  }

  private async handleSendMessage(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: string
  ): Promise<void> {
    try {
      const { phone, message } = JSON.parse(body);

      if (!phone || !message) {
        this.sendJSON(res, 400, { error: 'phone and message are required' });
        return;
      }

      const result = await wahaService.sendMessage({
        chatId: phone,
        text: message,
      });

      this.sendJSON(res, 200, { success: true, result });
    } catch (error) {
      logger.error('Error sending message', error, 'WEBHOOK');
      this.sendJSON(res, 500, { error: 'Failed to send message' });
    }
  }

  private async handleGetConversation(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const phone = url.searchParams.get('phone');

      if (!phone) {
        this.sendJSON(res, 400, { error: 'phone parameter is required' });
        return;
      }

      const conversation = await supabaseService.getConversationByPhone(phone);
      
      if (!conversation) {
        this.sendJSON(res, 404, { error: 'Conversation not found' });
        return;
      }

      this.sendJSON(res, 200, conversation);
    } catch (error) {
      this.sendJSON(res, 500, { error: 'Failed to get conversation' });
    }
  }

  // ============ Message Processing ============

  private async processMessage(message: WAHAWebhookPayload['payload']): Promise<void> {
    const phone = message.from.replace('@c.us', '');
    const chatId = message.from;
    const text = message.body;

    logger.conversation('Processing message', { phone, text: text.substring(0, 50) });

    try {
      // Simular "digitando"
      if (this.config.typingDelay) {
        await wahaService.sendTyping(chatId, this.config.typingDelayMs);
        await this.sleep(this.config.typingDelayMs);
      }

      // Processar com o agente de respostas
      if (this.config.autoReply) {
        const result = await responseAgent.processMessage(phone, chatId, text);

        // Enviar resposta
        await wahaService.sendMessage({
          chatId,
          text: result.response,
        });

        logger.conversation('Response sent', {
          phone,
          emotion: result.emotion,
          shouldEscalate: result.shouldEscalate,
        });

        // Se precisa escalar, notificar
        if (result.shouldEscalate) {
          logger.warn('Escalation needed', {
            phone,
            reason: result.escalationReason,
          }, 'WEBHOOK');
        }
      }

    } catch (error) {
      logger.error('Error processing message', error, 'WEBHOOK');

      // Enviar mensagem de erro genérica
      try {
        await wahaService.sendMessage({
          chatId,
          text: 'Desculpe, tive um problema técnico. Um atendente irá te ajudar em breve! 🙏',
        });
      } catch (e) {
        logger.error('Failed to send error message', e, 'WEBHOOK');
      }
    }
  }

  // ============ Filters ============

  private isBlocked(from: string): boolean {
    if (!this.config.blockedNumbers || this.config.blockedNumbers.length === 0) {
      return false;
    }
    const phone = from.replace('@c.us', '').replace(/\D/g, '');
    return this.config.blockedNumbers.some(blocked => 
      phone.includes(blocked.replace(/\D/g, ''))
    );
  }

  private isAllowed(from: string): boolean {
    if (!this.config.allowedNumbers || this.config.allowedNumbers.length === 0) {
      return true;
    }
    const phone = from.replace('@c.us', '').replace(/\D/g, '');
    return this.config.allowedNumbers.some(allowed => 
      phone.includes(allowed.replace(/\D/g, ''))
    );
  }

  // ============ Server Management ============

  async start(): Promise<void> {
    // Inicializar banco de dados
    await supabaseService.initialize();

    this.server = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Parse URL
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const urlPath = url.pathname;
      const method = req.method || 'GET';

      // Log request (skip static assets)
      if (!urlPath.match(/\.(js|css|png|jpg|gif|svg|ico|woff|woff2)$/)) {
        logger.request(method, urlPath);
      }

      // Find API route
      const methodRoutes = this.routes.get(method);
      let handler: RouteHandler | undefined;

      if (methodRoutes) {
        // Exact match first
        handler = methodRoutes.get(urlPath);
        
        // Pattern match for routes with base path
        if (!handler) {
          for (const [routePath, routeHandler] of methodRoutes) {
            if (urlPath.startsWith(routePath.replace(/\/:.*$/, ''))) {
              handler = routeHandler;
              break;
            }
          }
        }
      }

      // If API route found, handle it
      if (handler) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            await handler!(req, res, body);
          } catch (error) {
            logger.error('Route handler error', error, 'WEBHOOK');
            this.sendJSON(res, 500, { error: 'Internal server error' });
          }
        });
        return;
      }

      // Try to serve static file (for dashboard)
      if (method === 'GET') {
        const served = await this.serveStaticFile(req, res, urlPath);
        if (served) return;
      }

      // 404 Not Found
      this.sendJSON(res, 404, { error: 'Not found' });
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        logger.info(`Webhook server running on http://${this.config.host}:${this.config.port}`, undefined, 'WEBHOOK');
        logger.info('Available endpoints:', undefined, 'WEBHOOK');
        logger.info('  GET  /              - Dashboard', undefined, 'WEBHOOK');
        logger.info('  POST /webhook/waha  - WAHA webhook', undefined, 'WEBHOOK');
        logger.info('  GET  /health        - Health check', undefined, 'WEBHOOK');
        logger.info('  GET  /stats         - Statistics', undefined, 'WEBHOOK');
        logger.info('  POST /send          - Send message', undefined, 'WEBHOOK');
        logger.info('  GET  /api/*         - Dashboard API', undefined, 'WEBHOOK');
        logger.info('  GET  /api/dashboard/* - Emotion Dashboard API', undefined, 'WEBHOOK');
        resolve();
      });

      this.server!.on('error', reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Webhook server stopped', undefined, 'WEBHOOK');
          supabaseService.close();
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // ============ Helpers ============

  private sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============ Configuration ============

  updateConfig(updates: Partial<WebhookConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('Webhook config updated', updates, 'WEBHOOK');
  }

  getConfig(): WebhookConfig {
    return { ...this.config };
  }
}

// Singleton
export const webhookServer = new WebhookServer();

// ============ Standalone Runner ============
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  logger.separator('Webhook Server Standalone');
  
  webhookServer.start().catch(error => {
    logger.error('Failed to start webhook server', error);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await webhookServer.stop();
    process.exit(0);
  });
}