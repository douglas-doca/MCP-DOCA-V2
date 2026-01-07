// ============================================
// MCP-DOCA-V2 - Webhook Server + Dashboard
// Recebe mensagens do WAHA e serve o Dashboard
// ============================================
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { URL } from "url";
import { logger } from "../utils/logger.js";
import { responseAgent } from "./response.agent.js";
import { wahaService } from "./waha.service.js";
import { supabaseService } from "./supabase.service.js";
import { emotionService } from "./emotion.service.js";
import { analysisService } from "./analysis.service.js";
// MIME types for static files
const MIME_TYPES = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
};
export class WebhookServer {
    server = null;
    config;
    routes;
    processingQueue = new Set();
    constructor(config) {
        this.config = {
            port: config?.port || parseInt(process.env.WEBHOOK_PORT || "3002"),
            host: config?.host || "0.0.0.0",
            secret: config?.secret || process.env.WEBHOOK_SECRET,
            autoReply: config?.autoReply ?? true,
            typingDelay: config?.typingDelay ?? false,
            typingDelayMs: config?.typingDelayMs || 2000,
            ignoreSelf: config?.ignoreSelf ?? true,
            ignoreGroups: config?.ignoreGroups ?? true,
            allowedNumbers: config?.allowedNumbers,
            blockedNumbers: config?.blockedNumbers,
            staticDir: config?.staticDir || "./public",
        };
        this.routes = new Map();
        this.setupRoutes();
    }
    // ============ Route Setup ============
    setupRoutes() {
        // POST /webhook/waha - Principal endpoint para WAHA
        this.addRoute("POST", "/webhook/waha", this.handleWAHAWebhook.bind(this));
        // POST /webhook/message - Endpoint alternativo
        this.addRoute("POST", "/webhook/message", this.handleWAHAWebhook.bind(this));
        // GET /health - Health check
        this.addRoute("GET", "/health", this.handleHealth.bind(this));
        // GET /stats - Estatísticas
        this.addRoute("GET", "/stats", this.handleStats.bind(this));
        // POST /send - Enviar mensagem manual
        this.addRoute("POST", "/send", this.handleSendMessage.bind(this));
        // GET /conversations?phone=...
        this.addRoute("GET", "/conversations", this.handleGetConversation.bind(this));
        // ========= Dashboard APIs =========
        this.addRoute("GET", "/api/conversations", this.handleAPIConversations.bind(this));
        this.addRoute("GET", "/api/leads", this.handleAPILeads.bind(this));
        this.addRoute("GET", "/api/messages", this.handleAPIMessages.bind(this));
        this.addRoute("GET", "/api/stats", this.handleAPIStats.bind(this));
        // ========= Settings =========
        this.addRoute("GET", "/api/settings", this.handleAPIGetSettings.bind(this));
        this.addRoute("POST", "/api/settings", this.handleAPISaveSettings.bind(this));
        // ========= Knowledge =========
        this.addRoute("GET", "/api/knowledge", this.handleAPIGetKnowledge.bind(this));
        this.addRoute("POST", "/api/knowledge", this.handleAPISaveKnowledge.bind(this));
        this.addRoute("DELETE", "/api/knowledge", this.handleAPIDeleteKnowledge.bind(this));
        // ========= Emoção =========
        this.addRoute("GET", "/api/dashboard/metrics", this.handleAPIDashboardMetrics.bind(this));
        this.addRoute("GET", "/api/dashboard/sentiment-matrix", this.handleAPISentimentMatrix.bind(this));
        this.addRoute("GET", "/api/dashboard/emotional-funnel", this.handleAPIEmotionalFunnel.bind(this));
        this.addRoute("GET", "/api/leads/health", this.handleAPILeadHealth.bind(this));
        // ========= Análise IA (follow-up) =========
        this.addRoute("GET", "/api/analysis/stalled", this.handleAPIAnalysisStalled.bind(this));
        this.addRoute("GET", "/api/analysis/summary", this.handleAPIAnalysisSummary.bind(this));
        this.addRoute("POST", "/api/analysis/run", this.handleAPIAnalysisRun.bind(this));
        this.addRoute("POST", "/api/analysis/approve-send", this.handleAPIAnalysisApproveSend.bind(this));
        // ✅ Chat demo (mockup landing)
        this.addRoute("POST", "/api/chat", this.handleAPIChat.bind(this));
    }
    addRoute(method, routePath, handler) {
        if (!this.routes.has(method))
            this.routes.set(method, new Map());
        this.routes.get(method).set(routePath, handler);
    }
    // ============ Static File Server ============
    async serveStaticFile(req, res, urlPath) {
        // ✅ Suporte: /chat -> /chat/index.html
        if (urlPath === "/chat") {
            urlPath = "/chat/index.html";
        }
        let filePath = urlPath === "/" ? "/index.html" : urlPath;
        // Remove /dashboard prefix if present
        if (filePath.startsWith("/dashboard")) {
            filePath = filePath.replace("/dashboard", "") || "/index.html";
        }
        const fullPath = path.join(this.config.staticDir, filePath);
        // Security: prevent directory traversal
        const normalizedPath = path.normalize(fullPath);
        if (!normalizedPath.startsWith(path.resolve(this.config.staticDir))) {
            return false;
        }
        try {
            if (!fs.existsSync(normalizedPath)) {
                // SPA fallback: serve index.html para rotas sem extensão
                if (!filePath.includes(".")) {
                    const indexPath = path.join(this.config.staticDir, "index.html");
                    if (fs.existsSync(indexPath)) {
                        const content = fs.readFileSync(indexPath);
                        res.writeHead(200, { "Content-Type": "text/html" });
                        res.end(content);
                        return true;
                    }
                }
                return false;
            }
            const stats = fs.statSync(normalizedPath);
            if (stats.isDirectory()) {
                const indexPath = path.join(normalizedPath, "index.html");
                if (fs.existsSync(indexPath)) {
                    const content = fs.readFileSync(indexPath);
                    res.writeHead(200, { "Content-Type": "text/html" });
                    res.end(content);
                    return true;
                }
                return false;
            }
            const ext = path.extname(normalizedPath).toLowerCase();
            const mimeType = MIME_TYPES[ext] || "application/octet-stream";
            const content = fs.readFileSync(normalizedPath);
            const cacheControl = ext === ".html" ? "no-cache" : "public, max-age=31536000";
            res.writeHead(200, {
                "Content-Type": mimeType,
                "Content-Length": content.length,
                "Cache-Control": cacheControl,
            });
            res.end(content);
            return true;
        }
        catch (error) {
            logger.error("Error serving static file", error, "STATIC");
            return false;
        }
    }
    // ============ Dashboard APIs ============
    async handleAPIConversations(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const limit = parseInt(url.searchParams.get("limit") || "50");
            const conversations = await supabaseService.getConversations(limit);
            this.sendJSON(res, 200, conversations || []);
        }
        catch (error) {
            logger.error("Error getting conversations", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get conversations" });
        }
    }
    async handleAPILeads(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const limit = parseInt(url.searchParams.get("limit") || "50");
            const status = url.searchParams.get("status") || undefined;
            const leads = await supabaseService.getLeads(status, limit);
            this.sendJSON(res, 200, leads || []);
        }
        catch (error) {
            logger.error("Error getting leads", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get leads" });
        }
    }
    async handleAPIMessages(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const conversationId = url.searchParams.get("conversation_id");
            const limit = parseInt(url.searchParams.get("limit") || "50");
            if (!conversationId) {
                this.sendJSON(res, 400, { error: "conversation_id is required" });
                return;
            }
            const messages = await supabaseService.getRecentMessages(conversationId, limit);
            this.sendJSON(res, 200, messages || []);
        }
        catch (error) {
            logger.error("Error getting messages", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get messages" });
        }
    }
    async handleAPIStats(req, res) {
        try {
            const stats = await supabaseService.getDashboardStats();
            this.sendJSON(res, 200, stats);
        }
        catch (error) {
            logger.error("Error getting stats", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get stats" });
        }
    }
    // ============ Emoção ============
    async handleAPIDashboardMetrics(req, res) {
        try {
            const metrics = await emotionService.getDashboardMetrics();
            this.sendJSON(res, 200, metrics);
        }
        catch (error) {
            logger.error("Error getting dashboard metrics", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get dashboard metrics" });
        }
    }
    async handleAPISentimentMatrix(req, res) {
        try {
            const matrix = await emotionService.getSentimentMatrix();
            this.sendJSON(res, 200, matrix);
        }
        catch (error) {
            logger.error("Error getting sentiment matrix", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get sentiment matrix" });
        }
    }
    async handleAPIEmotionalFunnel(req, res) {
        try {
            const funnel = await emotionService.getEmotionalFunnel();
            this.sendJSON(res, 200, funnel);
        }
        catch (error) {
            logger.error("Error getting emotional funnel", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get emotional funnel" });
        }
    }
    async handleAPILeadHealth(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const leadId = url.searchParams.get("lead_id");
            if (!leadId) {
                this.sendJSON(res, 400, { error: "lead_id is required" });
                return;
            }
            const health = await emotionService.getLeadHealth(leadId);
            if (!health) {
                this.sendJSON(res, 404, { error: "Lead not found" });
                return;
            }
            this.sendJSON(res, 200, health);
        }
        catch (error) {
            logger.error("Error getting lead health", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get lead health" });
        }
    }
    // ============ Analysis IA (follow-up) ============
    async handleAPIAnalysisStalled(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const min_minutes = parseInt(url.searchParams.get("min_minutes") || "240");
            const limit = parseInt(url.searchParams.get("limit") || "20");
            const status = (url.searchParams.get("status") || "open");
            const result = await analysisService.getStalledConversations({ min_minutes, limit, status });
            this.sendJSON(res, 200, result);
        }
        catch (error) {
            logger.error("Error getting stalled conversations", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get stalled conversations" });
        }
    }
    async handleAPIAnalysisSummary(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const range = (url.searchParams.get("range") || "today");
            const summary = await analysisService.getSummary({ range });
            this.sendJSON(res, 200, summary);
        }
        catch (error) {
            logger.error("Error getting analysis summary", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get analysis summary" });
        }
    }
    async handleAPIAnalysisRun(req, res, body) {
        try {
            const payload = JSON.parse(body || "{}");
            if (!payload.conversation_id) {
                this.sendJSON(res, 400, { error: "conversation_id is required" });
                return;
            }
            const result = await analysisService.runAnalysis({
                conversation_id: payload.conversation_id,
                mode: payload.mode || "followup",
                language: payload.language || "pt-BR",
            });
            this.sendJSON(res, 200, result);
        }
        catch (error) {
            logger.error("Error running analysis", error, "API");
            this.sendJSON(res, 500, { error: "Failed to run analysis" });
        }
    }
    async handleAPIAnalysisApproveSend(req, res, body) {
        try {
            const payload = JSON.parse(body || "{}");
            if (!payload.conversation_id) {
                this.sendJSON(res, 400, { error: "conversation_id is required" });
                return;
            }
            if (!payload.text || String(payload.text).trim().length < 5) {
                this.sendJSON(res, 400, { error: "text is required (min 5 chars)" });
                return;
            }
            const result = await analysisService.approveAndSend(payload);
            this.sendJSON(res, 200, result);
        }
        catch (error) {
            logger.error("Error approving/sending followup", error, "API");
            this.sendJSON(res, 500, { error: error?.message || "Failed to approve/send followup" });
        }
    }
    // ============ Settings ============
    async handleAPIGetSettings(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const key = url.searchParams.get("key") || "agent_prompt";
            const result = await supabaseService.request("GET", "settings", {
                query: `key=eq.${key}`,
            });
            if (result && result[0]) {
                this.sendJSON(res, 200, { key: result[0].key, value: result[0].value });
            }
            else {
                this.sendJSON(res, 404, { error: "Setting not found" });
            }
        }
        catch (error) {
            logger.error("Error getting settings", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get settings" });
        }
    }
    async handleAPISaveSettings(req, res, body) {
        try {
            const { key, value } = JSON.parse(body);
            if (!key || !value) {
                this.sendJSON(res, 400, { error: "Key and value required" });
                return;
            }
            const existing = await supabaseService.request("GET", "settings", {
                query: `key=eq.${key}`,
            });
            if (existing && existing.length > 0) {
                await supabaseService.request("PATCH", "settings", {
                    query: `key=eq.${key}`,
                    body: { value, updated_at: new Date().toISOString() },
                });
            }
            else {
                await supabaseService.request("POST", "settings", {
                    body: {
                        key,
                        value,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    },
                });
            }
            this.sendJSON(res, 200, { success: true, key });
        }
        catch (error) {
            logger.error("Error saving settings", error, "API");
            this.sendJSON(res, 500, { error: "Failed to save settings" });
        }
    }
    // ============ Knowledge Base ============
    async handleAPIGetKnowledge(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const category = url.searchParams.get("category");
            let query = "order=priority.desc,created_at.desc";
            if (category)
                query = `category=eq.${category}&${query}`;
            const result = await supabaseService.request("GET", "knowledge_base", { query });
            this.sendJSON(res, 200, result || []);
        }
        catch (error) {
            logger.error("Error getting knowledge", error, "API");
            this.sendJSON(res, 500, { error: "Failed to get knowledge" });
        }
    }
    async handleAPISaveKnowledge(req, res, body) {
        try {
            const data = JSON.parse(body);
            if (!data.question || !data.answer) {
                this.sendJSON(res, 400, { error: "Question and answer required" });
                return;
            }
            const now = new Date().toISOString();
            if (data.id) {
                await supabaseService.request("PATCH", "knowledge_base", {
                    query: `id=eq.${data.id}`,
                    body: { ...data, updated_at: now },
                });
            }
            else {
                await supabaseService.request("POST", "knowledge_base", {
                    body: { ...data, created_at: now, updated_at: now },
                });
            }
            this.sendJSON(res, 200, { success: true });
        }
        catch (error) {
            logger.error("Error saving knowledge", error, "API");
            this.sendJSON(res, 500, { error: "Failed to save knowledge" });
        }
    }
    async handleAPIDeleteKnowledge(req, res, body) {
        try {
            const { id } = JSON.parse(body);
            if (!id) {
                this.sendJSON(res, 400, { error: "ID required" });
                return;
            }
            await supabaseService.request("DELETE", "knowledge_base", {
                query: `id=eq.${id}`,
            });
            this.sendJSON(res, 200, { success: true });
        }
        catch (error) {
            logger.error("Error deleting knowledge", error, "API");
            this.sendJSON(res, 500, { error: "Failed to delete knowledge" });
        }
    }
    // ============ ✅ CHAT DEMO (Mockup Landing) ============
    async handleAPIChat(req, res, body) {
        try {
            const payload = JSON.parse(body || "{}");
            const message = String(payload.message || "").trim();
            const sessionId = String(payload.session_id || "").trim() || "anon";
            if (!message) {
                this.sendJSON(res, 400, { error: "message is required" });
                return;
            }
            // Identidade fake por sessão (não mistura com WA real)
            const phone = `web_${sessionId}`;
            const chatId = `${phone}@web`;
            // Cria/recupera conversa no Supabase
            const conversation = await supabaseService.getOrCreateConversation(phone, chatId);
            if (!conversation) {
                this.sendJSON(res, 500, { error: "Failed to create conversation" });
                return;
            }
            // Salva mensagem do usuário
            await supabaseService.addMessage(conversation.id, {
                role: "user",
                content: message,
                // ✅ removido: source (não existe no tipo MessageMetadata)
                metadata: {},
                timestamp: new Date(),
            });
            // Processa com agente
            const result = await responseAgent.processMessage(phone, chatId, message);
            // Salva resposta
            await supabaseService.addMessage(conversation.id, {
                role: "assistant",
                content: result.response,
                // ✅ removido: source (não existe no tipo MessageMetadata)
                metadata: {
                    emotion: result.emotion,
                    intention: result.intention,
                    shouldEscalate: result.shouldEscalate,
                },
                timestamp: new Date(),
            });
            this.sendJSON(res, 200, {
                ok: true,
                reply: result.response,
                emotion: result.emotion,
                intention: result.intention,
                shouldEscalate: result.shouldEscalate,
            });
        }
        catch (error) {
            logger.error("Error in /api/chat", error, "API");
            this.sendJSON(res, 500, { error: "Failed to process chat" });
        }
    }
    // ============ Webhook WAHA ============
    async handleWAHAWebhook(req, res, body) {
        try {
            const payload = JSON.parse(body);
            logger.webhook("WAHA webhook received", {
                event: payload.event,
                from: payload.payload?.from,
            });
            if (payload.event !== "message") {
                this.sendJSON(res, 200, { status: "ignored", reason: "not a message event" });
                return;
            }
            const message = payload.payload;
            if (this.config.ignoreSelf && message.fromMe) {
                this.sendJSON(res, 200, { status: "ignored", reason: "self message" });
                return;
            }
            if (this.config.ignoreGroups && message.from.endsWith("@g.us")) {
                this.sendJSON(res, 200, { status: "ignored", reason: "group message" });
                return;
            }
            if (this.isBlocked(message.from)) {
                this.sendJSON(res, 200, { status: "ignored", reason: "blocked number" });
                return;
            }
            if (!this.isAllowed(message.from)) {
                this.sendJSON(res, 200, { status: "ignored", reason: "not in allowed list" });
                return;
            }
            const messageKey = `${message.from}-${message.id}`;
            if (this.processingQueue.has(messageKey)) {
                this.sendJSON(res, 200, { status: "ignored", reason: "already processing" });
                return;
            }
            this.processingQueue.add(messageKey);
            this.sendJSON(res, 200, { status: "processing" });
            this.processMessage(message).finally(() => {
                this.processingQueue.delete(messageKey);
            });
        }
        catch (error) {
            logger.error("Error handling webhook", error, "WEBHOOK");
            this.sendJSON(res, 500, { error: "Internal server error" });
        }
    }
    async handleHealth(req, res) {
        this.sendJSON(res, 200, {
            status: "ok",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
        });
    }
    async handleStats(req, res) {
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
        }
        catch (error) {
            this.sendJSON(res, 500, { error: "Failed to get stats" });
        }
    }
    async handleSendMessage(req, res, body) {
        try {
            const { phone, message } = JSON.parse(body);
            if (!phone || !message) {
                this.sendJSON(res, 400, { error: "phone and message are required" });
                return;
            }
            const result = await wahaService.sendMessage({
                chatId: phone,
                text: message,
            });
            this.sendJSON(res, 200, { success: true, result });
        }
        catch (error) {
            logger.error("Error sending message", error, "WEBHOOK");
            this.sendJSON(res, 500, { error: "Failed to send message" });
        }
    }
    async handleGetConversation(req, res) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const phone = url.searchParams.get("phone");
            if (!phone) {
                this.sendJSON(res, 400, { error: "phone parameter is required" });
                return;
            }
            const conversation = await supabaseService.getConversationByPhone(phone);
            if (!conversation) {
                this.sendJSON(res, 404, { error: "Conversation not found" });
                return;
            }
            this.sendJSON(res, 200, conversation);
        }
        catch (error) {
            this.sendJSON(res, 500, { error: "Failed to get conversation" });
        }
    }
    async processMessage(message) {
        const phone = message.from.replace("@c.us", "");
        const chatId = message.from;
        const text = message.body;
        logger.conversation("Processing message", {
            phone,
            text: text.substring(0, 50),
        });
        try {
            if (this.config.typingDelay) {
                await wahaService.sendTyping(chatId, this.config.typingDelayMs);
                await this.sleep(this.config.typingDelayMs);
            }
            if (this.config.autoReply) {
                const result = await responseAgent.processMessage(phone, chatId, text);
                await wahaService.sendMessage({
                    chatId,
                    text: result.response,
                });
                logger.conversation("Response sent", {
                    phone,
                    emotion: result.emotion,
                    shouldEscalate: result.shouldEscalate,
                });
                if (result.shouldEscalate) {
                    logger.warn("Escalation needed", { phone, reason: result.escalationReason }, "WEBHOOK");
                }
            }
        }
        catch (error) {
            logger.error("Error processing message", error, "WEBHOOK");
            try {
                await wahaService.sendMessage({
                    chatId,
                    text: "Desculpe, tive um problema técnico. Um atendente irá te ajudar em breve! 🙏",
                });
            }
            catch (e) {
                logger.error("Failed to send error message", e, "WEBHOOK");
            }
        }
    }
    isBlocked(from) {
        if (!this.config.blockedNumbers || this.config.blockedNumbers.length === 0)
            return false;
        const phone = from.replace("@c.us", "").replace(/\D/g, "");
        return this.config.blockedNumbers.some((blocked) => phone.includes(blocked.replace(/\D/g, "")));
    }
    isAllowed(from) {
        if (!this.config.allowedNumbers || this.config.allowedNumbers.length === 0)
            return true;
        const phone = from.replace("@c.us", "").replace(/\D/g, "");
        return this.config.allowedNumbers.some((allowed) => phone.includes(allowed.replace(/\D/g, "")));
    }
    // ============ Server Management ============
    async start() {
        await supabaseService.initialize();
        this.server = http.createServer(async (req, res) => {
            // CORS (ok p/ landing)
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
            if (req.method === "OPTIONS") {
                res.writeHead(204);
                res.end();
                return;
            }
            const url = new URL(req.url, `http://${req.headers.host}`);
            const urlPath = url.pathname;
            const method = req.method || "GET";
            if (!urlPath.match(/\.(js|css|png|jpg|gif|svg|ico|woff|woff2)$/)) {
                logger.request(method, urlPath);
            }
            const methodRoutes = this.routes.get(method);
            let handler;
            if (methodRoutes) {
                handler = methodRoutes.get(urlPath);
                if (!handler) {
                    for (const [routePath, routeHandler] of methodRoutes) {
                        if (urlPath.startsWith(routePath.replace(/\/:.*$/, ""))) {
                            handler = routeHandler;
                            break;
                        }
                    }
                }
            }
            if (handler) {
                let body = "";
                req.on("data", (chunk) => (body += chunk));
                req.on("end", async () => {
                    try {
                        await handler(req, res, body);
                    }
                    catch (error) {
                        logger.error("Route handler error", error, "WEBHOOK");
                        this.sendJSON(res, 500, { error: "Internal server error" });
                    }
                });
                return;
            }
            if (method === "GET") {
                const served = await this.serveStaticFile(req, res, urlPath);
                if (served)
                    return;
            }
            this.sendJSON(res, 404, { error: "Not found" });
        });
        return new Promise((resolve, reject) => {
            this.server.listen(this.config.port, this.config.host, () => {
                logger.info(`Webhook server running on http://${this.config.host}:${this.config.port}`, undefined, "WEBHOOK");
                logger.info("Available endpoints:", undefined, "WEBHOOK");
                logger.info("  GET  /              - Dashboard", undefined, "WEBHOOK");
                logger.info("  POST /webhook/waha  - WAHA webhook", undefined, "WEBHOOK");
                logger.info("  GET  /health        - Health check", undefined, "WEBHOOK");
                logger.info("  GET  /stats         - Statistics", undefined, "WEBHOOK");
                logger.info("  POST /send          - Send message", undefined, "WEBHOOK");
                logger.info("  POST /api/chat      - Chat demo endpoint", undefined, "WEBHOOK");
                resolve();
            });
            this.server.on("error", reject);
        });
    }
    stop() {
        return new Promise((resolve) => {
            if (!this.server)
                return resolve();
            this.server.close(() => {
                logger.info("Webhook server stopped", undefined, "WEBHOOK");
                supabaseService.close();
                resolve();
            });
        });
    }
    sendJSON(res, status, data) {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        logger.info("Webhook config updated", updates, "WEBHOOK");
    }
    getConfig() {
        return { ...this.config };
    }
}
// Singleton
export const webhookServer = new WebhookServer();
// ============ Standalone Runner ============
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    logger.separator("Webhook Server Standalone");
    webhookServer.start().catch((error) => {
        logger.error("Failed to start webhook server", error);
        process.exit(1);
    });
    process.on("SIGINT", async () => {
        logger.info("Shutting down...");
        await webhookServer.stop();
        process.exit(0);
    });
}
//# sourceMappingURL=webhook.server.js.map