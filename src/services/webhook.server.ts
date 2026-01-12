// src/services/webhook.server.ts
// ============================================
// MCP-DOCA-V2 - Webhook Server + Dashboard
// Recebe mensagens do WAHA e serve o Dashboard
// + Agent Studio APIs (humanizer config + simulator)
// + Landing Chat endpoint /api/chat
// + ✅ HANDOFF: quando humano interfere, pausa o bot por chat
// + ✅ suporta @lid corretamente (evita "No LID for user")
// ============================================

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { URL } from "url";

import { logger } from "../utils/logger.js";
import { responseAgent } from "./response.agent.js";
import { wahaService } from "./index.js";
import { supabaseService } from "./supabase.service.js";
import { emotionService } from "./emotion.service.js";
import { analysisService } from "./analysis.service.js";
import { WAHAWebhookPayload } from "../types/index.js";
import { CalendarService } from "./calendar/calendar.service.js";

// ✅ NEW: WebhookService (Landing/Chat orchestration)
import { webhookService } from "./webhook.service.js";

// ✅ NEW: bot-id tracking to detect human intervention
import { isBotSentId } from "./waha.service.js";

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

type RouteHandler = (req: http.IncomingMessage, res: http.ServerResponse, body: string) => Promise<void>;

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
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

// ==============================
// Agent Studio - Settings Keys
// ==============================
const SETTINGS_KEYS = {
  agentPrompt: "agent_prompt",
  humanizerConfig: "agent_humanizer_config",
  agentEnabled: "agent_enabled", // ✅ global ON/OFF
} as const;

function getDefaultHumanizerConfig() {
  const h =
    (responseAgent as any)?.config?.humanizer || {
      maxBubbles: 5,
      maxSentencesPerBubble: 4,
      maxEmojiPerBubble: 3,

      bubbleCharSoftLimit: 220,
      bubbleCharHardLimit: 420,

      delay: {
        base: 420,
        perChar: 14,
        cap: 1650,
        anxiousMultiplier: 0.65,
        skepticalMultiplier: 1.15,
        frustratedMultiplier: 1.0,
        excitedMultiplier: 0.9,
      },
      stageBehavior: {
        cold: { maxBubbles: 4, requireQuestion: false, ctaLevel: "soft" },
        warm: { maxBubbles: 5, requireQuestion: false, ctaLevel: "medium" },
        hot: { maxBubbles: 5, requireQuestion: false, ctaLevel: "hard" },
      },
      saveChunksToDB: true,
      saveTypingChunks: true,
    };

  return {
    version: "v4",
    humanizer: h,
    updated_at: new Date().toISOString(),
  };
}

async function getSetting(key: string): Promise<any | null> {
  const result = await supabaseService.request<any[]>("GET", "settings", {
    query: `key=eq.${key}`,
  });

  if (result && result[0]) return result[0];
  return null;
}

async function upsertSetting(key: string, value: any): Promise<boolean> {
  const now = new Date().toISOString();

  const existing = await supabaseService.request<any[]>("GET", "settings", {
    query: `key=eq.${key}`,
  });

  if (existing && existing.length > 0) {
    const patched = await supabaseService.request("PATCH", "settings", {
      query: `key=eq.${key}`,
      body: { value, updated_at: now },
    });

    return !!patched;
  }

  const created = await supabaseService.request("POST", "settings", {
    body: {
      key,
      value,
      created_at: now,
      updated_at: now,
    },
  });

  return !!created;
}

// ==============================
// ✅ Agent ON/OFF (global) helpers
// ==============================
async function getAgentEnabled(): Promise<{ enabled: boolean; updated_at: string | null }> {
  const row = await getSetting(SETTINGS_KEYS.agentEnabled);

  // value esperado: { enabled: boolean }
  const enabledValue = row?.value?.enabled;

  return {
    enabled: typeof enabledValue === "boolean" ? enabledValue : true, // default ON se não existir
    updated_at: row?.updated_at || null,
  };
}

async function setAgentEnabled(enabled: boolean): Promise<boolean> {
  return upsertSetting(SETTINGS_KEYS.agentEnabled, { enabled: !!enabled });
}

// ============================================================
// ✅ HANDOFF / PAUSE MANAGER (in-memory)
// ============================================================
type PauseState = {
  paused: boolean;
  pausedAt: string;
  pausedUntil: string | null; // ISO
  reason: "human_intervention" | "manual";
  by?: string;
};

const HANDOFF_TTL_MINUTES = Number(process.env.HANDOFF_TTL_MINUTES || 24 * 60); // 24h default

function addMinutesISO(minutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + Math.max(1, minutes));
  return d.toISOString();
}

function nowISO() {
  return new Date().toISOString();
}

function isPauseActive(state?: PauseState | null): boolean {
  if (!state || !state.paused) return false;
  if (!state.pausedUntil) return true;
  return new Date(state.pausedUntil).getTime() > Date.now();
}

const PAUSED_CHATS = new Map<string, PauseState>();

function getChatKey(chatId: string): string {
  return String(chatId || "").trim();
}

function pauseChat(chatId: string, reason: PauseState["reason"], by?: string, ttlMinutes?: number) {
  const key = getChatKey(chatId);
  if (!key) return;

  const until = ttlMinutes === 0 ? null : addMinutesISO(ttlMinutes ?? HANDOFF_TTL_MINUTES);

  PAUSED_CHATS.set(key, {
    paused: true,
    pausedAt: nowISO(),
    pausedUntil: until,
    reason,
    by,
  });

  // ✅ FIX: logger.* expected 1-2 args; put "HANDOFF" as meta tag
  logger.warn("Conversation PAUSED (handoff)", { chatId: key, reason, until, by, tag: "HANDOFF" });
}

function resumeChat(chatId: string) {
  const key = getChatKey(chatId);
  if (!key) return;

  PAUSED_CHATS.delete(key);

  // ✅ FIX: logger.* expected 1-2 args; put "HANDOFF" as meta tag
  logger.info("Conversation RESUMED", { chatId: key, tag: "HANDOFF" });
}

function isChatPaused(chatId: string): boolean {
  const key = getChatKey(chatId);
  const st = PAUSED_CHATS.get(key);
  if (!st) return false;

  if (!isPauseActive(st)) {
    PAUSED_CHATS.delete(key);
    return false;
  }
  return true;
}

// ============================================

export class WebhookServer {
  private server: http.Server | null = null;
  private config: WebhookConfig;
  private routes: Map<string, Map<string, RouteHandler>>;
  private processingQueue: Set<string> = new Set();

  private calendarService = new CalendarService();

  private processedMessageIds: Map<string, number> = new Map();
  private processedTTLms = 2 * 60 * 1000; // 2 min

  constructor(config?: Partial<WebhookConfig>) {
    const blockedFromEnv = String(process.env.BLOCKED_NUMBERS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const allowedFromEnv = String(process.env.ALLOWED_NUMBERS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    this.config = {
      port: config?.port || parseInt(process.env.WEBHOOK_PORT || "3002"),
      host: config?.host || "0.0.0.0",
      secret: config?.secret || process.env.WEBHOOK_SECRET,
      autoReply: config?.autoReply ?? true,
      typingDelay: config?.typingDelay ?? false,
      typingDelayMs: config?.typingDelayMs || 2000,
      ignoreSelf: config?.ignoreSelf ?? true,
      ignoreGroups: config?.ignoreGroups ?? true,
      allowedNumbers: config?.allowedNumbers ?? (allowedFromEnv.length ? allowedFromEnv : undefined),
      blockedNumbers: config?.blockedNumbers ?? (blockedFromEnv.length ? blockedFromEnv : undefined),
      staticDir: config?.staticDir || "./public",
    };

    this.routes = new Map();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.addRoute("POST", "/webhook/waha", this.handleWAHAWebhook.bind(this));
    this.addRoute("POST", "/webhook/message", this.handleWAHAWebhook.bind(this));

    this.addRoute("GET", "/health", this.handleHealth.bind(this));
    this.addRoute("GET", "/stats", this.handleStats.bind(this));

    this.addRoute("POST", "/send", this.handleSendMessage.bind(this));
    this.addRoute("GET", "/conversations", this.handleGetConversation.bind(this));

    // ========= Dashboard APIs =========
    this.addRoute("GET", "/api/conversations", this.handleAPIConversations.bind(this));
    this.addRoute("GET", "/api/leads", this.handleAPILeads.bind(this));
    this.addRoute("GET", "/api/messages", this.handleAPIMessages.bind(this));
    this.addRoute("GET", "/api/stats", this.handleAPIStats.bind(this));

    // ========= Settings =========
    this.addRoute("GET", "/api/settings", this.handleAPIGetSettings.bind(this));
    this.addRoute("POST", "/api/settings", this.handleAPISaveSettings.bind(this));

    // ========= Calendar =========
    this.addRoute("GET", "/api/calendar/availability", this.handleAPICalendarAvailability.bind(this));
    this.addRoute("POST", "/api/calendar/schedule", this.handleAPICalendarSchedule.bind(this));

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

    // ========= ✅ Agent Studio =========
    this.addRoute("GET", "/api/agent/humanizer-config", this.handleAgentGetHumanizerConfig.bind(this));
    this.addRoute("PUT", "/api/agent/humanizer-config", this.handleAgentSaveHumanizerConfig.bind(this));
    this.addRoute("POST", "/api/agent/simulate", this.handleAgentSimulate.bind(this));

    // ========= ✅ HANDOFF endpoints =========
    this.addRoute("POST", "/api/conversations/pause", this.handlePauseConversation.bind(this));
    this.addRoute("POST", "/api/conversations/resume", this.handleResumeConversation.bind(this));

    // ========= ✅ Agent ON/OFF (global) =========
    this.addRoute("GET", "/api/agent/status", this.handleAgentStatus.bind(this));
    this.addRoute("PUT", "/api/agent/status", this.handleAgentSetStatus.bind(this));
  }

  private addRoute(method: string, routePath: string, handler: RouteHandler): void {
    if (!this.routes.has(method)) this.routes.set(method, new Map());
    this.routes.get(method)!.set(routePath, handler);
  }

  // ============ Static File Server ============
  private async serveStaticFile(_req: http.IncomingMessage, res: http.ServerResponse, urlPath: string): Promise<boolean> {
    if (urlPath === "/chat") urlPath = "/chat/index.html";

    let filePath = urlPath === "/" ? "/index.html" : urlPath;

    if (filePath.startsWith("/dashboard")) {
      filePath = filePath.replace("/dashboard", "") || "/index.html";
    }

    const fullPath = path.join(this.config.staticDir, filePath);

    const normalizedPath = path.normalize(fullPath);
    if (!normalizedPath.startsWith(path.resolve(this.config.staticDir))) return false;

    try {
      if (!fs.existsSync(normalizedPath)) {
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
    } catch (error) {
      logger.error("Error serving static file", error);
      return false;
    }
  }

  // ============ Dashboard APIs ============
  private async handleAPIConversations(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const conversations = await supabaseService.getConversations(50);
      this.sendJSON(res, 200, conversations || []);
    } catch (error) {
      logger.error("Error getting conversations", error);
      this.sendJSON(res, 500, { error: "Failed to get conversations" });
    }
  }

  private async handleAPILeads(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const status = url.searchParams.get("status") || undefined;

      const leads = await supabaseService.getLeads(status, limit);
      this.sendJSON(res, 200, leads || []);
    } catch (error) {
      logger.error("Error getting leads", error);
      this.sendJSON(res, 500, { error: "Failed to get leads" });
    }
  }

  private async handleAPIMessages(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const conversationId = url.searchParams.get("conversation_id");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      if (!conversationId) {
        this.sendJSON(res, 400, { error: "conversation_id is required" });
        return;
      }

      const messages = await supabaseService.getRecentMessages(conversationId, limit);
      this.sendJSON(res, 200, messages || []);
    } catch (error) {
      logger.error("Error getting messages", error);
      this.sendJSON(res, 500, { error: "Failed to get messages" });
    }
  }

  private async handleAPIStats(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const stats = await supabaseService.getDashboardStats();
      this.sendJSON(res, 200, stats);
    } catch (error) {
      logger.error("Error getting stats", error);
      this.sendJSON(res, 500, { error: "Failed to get stats" });
    }
  }

  // ============ Emoção ============
  private async handleAPIDashboardMetrics(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const metrics = await emotionService.getDashboardMetrics();
      this.sendJSON(res, 200, metrics);
    } catch (error) {
      logger.error("Error getting dashboard metrics", error);
      this.sendJSON(res, 500, { error: "Failed to get dashboard metrics" });
    }
  }

  private async handleAPISentimentMatrix(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const matrix = await emotionService.getSentimentMatrix();
      this.sendJSON(res, 200, matrix);
    } catch (error) {
      logger.error("Error getting sentiment matrix", error);
      this.sendJSON(res, 500, { error: "Failed to get sentiment matrix" });
    }
  }

  private async handleAPIEmotionalFunnel(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const funnel = await emotionService.getEmotionalFunnel();
      this.sendJSON(res, 200, funnel);
    } catch (error) {
      logger.error("Error getting emotional funnel", error);
      this.sendJSON(res, 500, { error: "Failed to get emotional funnel" });
    }
  }

  private async handleAPILeadHealth(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
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
    } catch (error) {
      logger.error("Error getting lead health", error);
      this.sendJSON(res, 500, { error: "Failed to get lead health" });
    }
  }

  // ============ Analysis IA (follow-up) ============
  private async handleAPIAnalysisStalled(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const min_minutes = parseInt(url.searchParams.get("min_minutes") || "240");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const status = (url.searchParams.get("status") || "open") as any;

      const result = await analysisService.getStalledConversations({ min_minutes, limit, status });
      this.sendJSON(res, 200, result);
    } catch (error) {
      logger.error("Error getting stalled conversations", error);
      this.sendJSON(res, 500, { error: "Failed to get stalled conversations" });
    }
  }

  private async handleAPIAnalysisSummary(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const range = (url.searchParams.get("range") || "today") as any;

      const summary = await analysisService.getSummary({ range });
      this.sendJSON(res, 200, summary);
    } catch (error) {
      logger.error("Error getting analysis summary", error);
      this.sendJSON(res, 500, { error: "Failed to get analysis summary" });
    }
  }

  private async handleAPIAnalysisRun(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
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
    } catch (error) {
      logger.error("Error running analysis", error);
      this.sendJSON(res, 500, { error: "Failed to run analysis" });
    }
  }

  private async handleAPIAnalysisApproveSend(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
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
    } catch (error: any) {
      logger.error("Error approving/sending followup", error);
      this.sendJSON(res, 500, { error: error?.message || "Failed to approve/send followup" });
    }
  }

  // ============ Settings ============
  private async handleAPIGetSettings(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const key = url.searchParams.get("key") || "agent_prompt";

      const result = await supabaseService.request<any[]>("GET", "settings", {
        query: `key=eq.${key}`,
      });

      if (result && result[0]) {
        this.sendJSON(res, 200, { key: result[0].key, value: result[0].value });
      } else {
        this.sendJSON(res, 404, { error: "Setting not found" });
      }
    } catch (error) {
      logger.error("Error getting settings", error);
      this.sendJSON(res, 500, { error: "Failed to get settings" });
    }
  }

  private async handleAPISaveSettings(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
    try {
      const { key, value } = JSON.parse(body);

      if (!key) {
        this.sendJSON(res, 400, { error: "Key is required" });
        return;
      }

      const ok = await upsertSetting(key, value);
      if (!ok) {
        this.sendJSON(res, 500, { error: "Failed to save setting" });
        return;
      }

      this.sendJSON(res, 200, { success: true, key });
    } catch (error) {
      logger.error("Error saving settings", error);
      this.sendJSON(res, 500, { error: "Failed to save settings" });
    }
  }

  // ============ ✅ Agent ON/OFF (global) ============
private async handleAgentStatus(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const st = await getAgentEnabled();
    this.sendJSON(res, 200, { ok: true, enabled: st.enabled, updated_at: st.updated_at });
  } catch (error) {
    logger.error("Error getting agent status", error);
    this.sendJSON(res, 500, { ok: false, error: "Failed to get agent status" });
  }
}

private async handleAgentSetStatus(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
  try {
    const payload = JSON.parse(body || "{}");

    if (typeof payload.enabled !== "boolean") {
      this.sendJSON(res, 400, { ok: false, error: "enabled must be boolean" });
      return;
    }

    const ok = await setAgentEnabled(payload.enabled);
    if (!ok) {
      this.sendJSON(res, 500, { ok: false, error: "Failed to save agent status" });
      return;
    }

    const st = await getAgentEnabled();
    this.sendJSON(res, 200, { ok: true, enabled: st.enabled, updated_at: st.updated_at });
  } catch (error: any) {
    logger.error("Error setting agent status", error);
    this.sendJSON(res, 500, { ok: false, error: error?.message || "Failed to set agent status" });
  }
}

  // ============ Calendar APIs ============
  private async handleAPICalendarAvailability(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);

      const days = url.searchParams.get("days") ? Number(url.searchParams.get("days")) : 2;
      const duration = url.searchParams.get("duration") ? Number(url.searchParams.get("duration")) : 30;
      const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 3;
      const timezone = url.searchParams.get("timezone") || "America/Sao_Paulo";

      const data = await this.calendarService.getAvailability({
        days,
        duration,
        limit,
        timezone,
        calendarId: "primary",
      });

      this.sendJSON(res, 200, data);
    } catch (error: any) {
      logger.error("Error getting calendar availability", error);
      this.sendJSON(res, 500, { error: error?.message || "Failed to get availability" });
    }
  }

  private async handleAPICalendarSchedule(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
    try {
      const payload = JSON.parse(body || "{}");

      const leadName = String(payload.leadName || payload.lead_name || "").trim();
      const leadPhone = String(payload.leadPhone || payload.lead_phone || "").trim();
      const leadEmail = payload.leadEmail ? String(payload.leadEmail).trim() : undefined;

      const start = String(payload.start || "").trim();
      const duration = payload.duration ? Number(payload.duration) : 30;
      const timezone = payload.timezone ? String(payload.timezone) : "America/Sao_Paulo";

      const conversationContext = payload.conversationContext ? String(payload.conversationContext) : "";
      const owner = payload.owner ? String(payload.owner) : "Douglas";

      if (!leadPhone || !start) {
        this.sendJSON(res, 400, { error: "Campos obrigatórios: leadPhone, start" });
        return;
      }

      const event = await this.calendarService.createEvent({
        leadName: leadName || leadPhone,
        leadPhone,
        leadEmail,
        start,
        duration,
        timezone,
        conversationContext,
        owner,
        calendarId: "primary",
      });

      this.sendJSON(res, 200, event);
    } catch (error: any) {
      logger.error("Error scheduling calendar event", error);
      this.sendJSON(res, 500, { error: error?.message || "Failed to schedule event" });
    }
  }

  // ============ Knowledge Base ============
  private async handleAPIGetKnowledge(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const category = url.searchParams.get("category");

      let query = "order=priority.desc,created_at.desc";
      if (category) query = `category=eq.${category}&${query}`;

      const result = await supabaseService.request<any[]>("GET", "knowledge_base", { query });
      this.sendJSON(res, 200, result || []);
    } catch (error) {
      logger.error("Error getting knowledge", error);
      this.sendJSON(res, 500, { error: "Failed to get knowledge" });
    }
  }

  private async handleAPISaveKnowledge(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
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
      } else {
        await supabaseService.request("POST", "knowledge_base", {
          body: { ...data, created_at: now, updated_at: now },
        });
      }

      this.sendJSON(res, 200, { success: true });
    } catch (error) {
      logger.error("Error saving knowledge", error);
      this.sendJSON(res, 500, { error: "Failed to save knowledge" });
    }
  }

  private async handleAPIDeleteKnowledge(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
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
    } catch (error) {
      logger.error("Error deleting knowledge", error);
      this.sendJSON(res, 500, { error: "Failed to delete knowledge" });
    }
  }

  // ============ ✅ Agent Studio APIs ============
  private async handleAgentGetHumanizerConfig(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const row = await getSetting(SETTINGS_KEYS.humanizerConfig);

      if (row?.value) {
        this.sendJSON(res, 200, {
          ok: true,
          key: SETTINGS_KEYS.humanizerConfig,
          value: row.value,
          updated_at: row.updated_at || null,
        });
        return;
      }

      const fallback = getDefaultHumanizerConfig();
      this.sendJSON(res, 200, {
        ok: true,
        key: SETTINGS_KEYS.humanizerConfig,
        value: fallback,
        updated_at: null,
        fallback: true,
      });
    } catch (err) {
      logger.error("Error getting humanizer config", err);
      this.sendJSON(res, 500, { ok: false, error: "Failed to load humanizer config" });
    }
  }

  private async handleAgentSaveHumanizerConfig(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
    try {
      const payload = JSON.parse(body || "{}");
      if (!payload || typeof payload !== "object") {
        this.sendJSON(res, 400, { ok: false, error: "Invalid payload" });
        return;
      }

      if (!payload.humanizer || typeof payload.humanizer !== "object") {
        this.sendJSON(res, 400, { ok: false, error: "Payload must include { humanizer: {...} }" });
        return;
      }

      payload.updated_at = new Date().toISOString();

      const ok = await upsertSetting(SETTINGS_KEYS.humanizerConfig, payload);
      if (!ok) {
        this.sendJSON(res, 500, { ok: false, error: "Failed to save config in Supabase" });
        return;
      }

      try {
        (responseAgent as any).config = (responseAgent as any).config || {};
        (responseAgent as any).config.humanizer = payload.humanizer;
      } catch {}

      this.sendJSON(res, 200, { ok: true });
    } catch (err: any) {
      logger.error("Error saving humanizer config", err);
      this.sendJSON(res, 500, { ok: false, error: err?.message || "Failed to save humanizer config" });
    }
  }

  private async handleAgentSimulate(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
    try {
      const payload = JSON.parse(body || "{}");

      const message = String(payload.message || "").trim();
      const stage = String(payload.stage || "cold").trim();
      const emotion = String(payload.emotion || "neutral").trim();
      const intention = String(payload.intention || "outros").trim();

      if (!message) {
        this.sendJSON(res, 400, { ok: false, error: "message is required" });
        return;
      }

      if (typeof (responseAgent as any)?.createResponsePlan !== "function") {
        this.sendJSON(res, 500, { ok: false, error: "responseAgent.createResponsePlan not found" });
        return;
      }

      const plan = (responseAgent as any).createResponsePlan({
        aiText: message,
        intention,
        emotion,
        stage,
        context: { profile: {}, calendar: {} },
      });

      this.sendJSON(res, 200, { ok: true, plan });
    } catch (err: any) {
      logger.error("Error simulating agent plan", err);
      this.sendJSON(res, 500, { ok: false, error: err?.message || "Failed to simulate" });
    }
  }

  // ============ ✅ CHAT DEMO (Landing) ============
  private async handleAPIChat(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
    try {
      const payload = JSON.parse(body || "{}");
      const result = await webhookService.handleChat(payload);
      this.sendJSON(res, 200, result);
    } catch (error) {
      logger.error("Error in /api/chat", error);
      this.sendJSON(res, 500, { ok: false, error: "Failed to process chat" });
    }
  }

  // ============ ✅ HANDOFF endpoints ============
  private async handlePauseConversation(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
    try {
      const payload = JSON.parse(body || "{}");
      const chatId = String(payload.chatId || payload.chat_id || "").trim();
      const ttlMinutes = payload.ttlMinutes !== undefined ? Number(payload.ttlMinutes) : HANDOFF_TTL_MINUTES;
      const by = payload.by ? String(payload.by) : "manual";

      if (!chatId) {
        this.sendJSON(res, 400, { ok: false, error: "chatId is required" });
        return;
      }

      pauseChat(chatId, "manual", by, ttlMinutes);
      this.sendJSON(res, 200, { ok: true, chatId, paused: true });
    } catch (e: any) {
      this.sendJSON(res, 500, { ok: false, error: e?.message || "Failed to pause" });
    }
  }

  private async handleResumeConversation(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
    try {
      const payload = JSON.parse(body || "{}");
      const chatId = String(payload.chatId || payload.chat_id || "").trim();

      if (!chatId) {
        this.sendJSON(res, 400, { ok: false, error: "chatId is required" });
        return;
      }

      resumeChat(chatId);
      this.sendJSON(res, 200, { ok: true, chatId, paused: false });
    } catch (e: any) {
      this.sendJSON(res, 500, { ok: false, error: e?.message || "Failed to resume" });
    }
  }

  // ============ Webhook WAHA ============
  private async handleWAHAWebhook(req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
    try {
      const payload = JSON.parse(body) as WAHAWebhookPayload;

      logger.webhook("WAHA webhook received", {
        event: payload.event,
        from: payload.payload?.from,
        fromMe: (payload.payload as any)?.fromMe ?? null,
      });

      const message = payload.payload;

      // ✅ If it is a message from our own account, it can be HUMAN or BOT.
      // We use message id to differentiate.
      if (message && (message as any).fromMe === true) {
        const msgId = String((message as any)?.id?._serialized || (message as any)?.id || "").trim();
        const chatId =
          String((message as any)?.to || (message as any)?.from || "").trim() || String((message as any)?.chatId || "").trim();

        // If it's NOT a message that the bot sent, then it's human intervention → pause
        if (chatId && !isBotSentId(msgId)) {
          pauseChat(chatId, "human_intervention", "human", HANDOFF_TTL_MINUTES);
        }

        // respond ok
        this.sendJSON(res, 200, { status: "ok", reason: "fromMe processed" });
        return;
      }

      // ✅ Process only real inbound messages
      if (payload.event !== "message") {
        this.sendJSON(res, 200, { status: "ignored", reason: "not message event" });
        return;
      }

      if (!message) {
        this.sendJSON(res, 200, { status: "ignored", reason: "no payload" });
        return;
      }

      // ignore groups
      if (this.config.ignoreGroups && String((message as any).from || "").endsWith("@g.us")) {
        this.sendJSON(res, 200, { status: "ignored", reason: "group message" });
        return;
      }

      // blocked/allowed checks
      if (this.isBlocked((message as any).from)) {
        this.sendJSON(res, 200, { status: "ignored", reason: "blocked number" });
        return;
      }

      if (!this.isAllowed((message as any).from)) {
        this.sendJSON(res, 200, { status: "ignored", reason: "not in allowed list" });
        return;
      }

      const msgId = String((message as any)?.id?._serialized || (message as any)?.id || "");
      const messageKey = msgId ? msgId : `${(message as any).from}-${(message as any)?.timestamp || Date.now()}`;

      if (this.processingQueue.has(messageKey)) {
        this.sendJSON(res, 200, { status: "ignored", reason: "already processing" });
        return;
      }

      this.processingQueue.add(messageKey);
      this.sendJSON(res, 200, { status: "processing" });

      this.processMessage(message).finally(() => {
        this.processingQueue.delete(messageKey);
      });
    } catch (error) {
      logger.error("Error handling webhook", error);
      this.sendJSON(res, 500, { error: "Internal server error" });
    }
  }

  private async handleHealth(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    this.sendJSON(res, 200, {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  }

  private async handleStats(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const dbStats = supabaseService.getStats();
      this.sendJSON(res, 200, {
        database: dbStats,
        webhook: {
          autoReply: this.config.autoReply,
          typingDelay: this.config.typingDelay,
          processingQueue: this.processingQueue.size,
          handoff: {
            pausedChats: PAUSED_CHATS.size,
            ttlMinutes: HANDOFF_TTL_MINUTES,
          },
        },
      });
    } catch (error) {
      this.sendJSON(res, 500, { error: "Failed to get stats" });
    }
  }

  private async handleSendMessage(_req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
    try {
      const { phone, message } = JSON.parse(body);

      if (!phone || !message) {
        this.sendJSON(res, 400, { error: "phone and message are required" });
        return;
      }

      const chatId =
        String(phone).includes("@c.us") || String(phone).includes("@lid") ? String(phone) : `${String(phone)}@c.us`;

      const result = await wahaService.sendMessage({
        chatId,
        text: String(message),
      });

      this.sendJSON(res, 200, { success: true, result });
    } catch (error) {
      logger.error("Error sending message", error);
      this.sendJSON(res, 500, { error: "Failed to send message" });
    }
  }

  private async handleGetConversation(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
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
    } catch (error) {
      this.sendJSON(res, 500, { error: "Failed to get conversation" });
    }
  }

  // ============================================
  // ✅ PROCESSAMENTO PRINCIPAL
  // ============================================

  private cleanupProcessed(): void {
    const now = Date.now();
    for (const [k, ts] of this.processedMessageIds.entries()) {
      if (now - ts > this.processedTTLms) this.processedMessageIds.delete(k);
    }
  }

  private stripSuffix(id: string): string {
    return String(id || "")
      .replace(/@(c\.us|g\.us|lid)$/g, "")
      .trim();
  }

  private async processMessage(message: WAHAWebhookPayload["payload"]): Promise<void> {
    const from = String((message as any).from || "");
    const chatId = String((message as any).from || ""); // keep @lid if present!
    const phone = this.stripSuffix(from);
    const text = String((message as any).body || "");

    // ✅ Global ON/OFF: se agente estiver OFF, ignora IA e não envia mensagens
try {
  const st = await getAgentEnabled();
  if (!st.enabled) {
    logger.conversation("Agent disabled globally, skipping reply", {
      phone,
      chatId,
      reason: "AGENT_DISABLED",
    });
    return;
  }
} catch (e) {
  // Fail-safe: se não conseguir ler status, não responde
  logger.warn("Agent status check failed (fail-safe OFF), skipping reply", {
    phone,
    chatId,
    reason: "AGENT_DISABLED",
    error: String((e as any)?.message || e),
  });
  return;
}

    // ✅ if paused, do not answer
    if (isChatPaused(chatId)) {
      // ✅ FIX: logger.conversation expected 1-2 args; put HANDOFF tag in meta
      logger.conversation("Conversation paused by human handoff, skipping reply", { chatId, phone, tag: "HANDOFF" });
      return;
    }

    // ✅ Anti-duplicado por message.id
    const msgId = String((message as any)?.id?._serialized || (message as any)?.id || "");
    if (msgId) {
      this.cleanupProcessed();
      if (this.processedMessageIds.has(msgId)) {
        logger.conversation("Duplicate message ignored (by id)", { phone, msgId });
        return;
      }
      this.processedMessageIds.set(msgId, Date.now());
    }

    logger.conversation("Processing message", {
      phone,
      chatId,
      text: text.substring(0, 50),
    });

    try {
      if (!this.config.autoReply) return;

      const result = await responseAgent.processMessage(phone, chatId, text, {
        channel: "whatsapp",
        ui_mode: "real",
        meta: {},
      });

      const finalText = String(result?.response || "").trim();
      if (!finalText) return;

      const stage = String((result as any)?.stage || "warm");
      const emotion = String(result?.emotion || "neutral");
      const intention = String((result as any)?.intention || "outros");

      let plan: any = (result as any)?.responsePlan || null;

      if (!plan) {
        try {
          if (typeof (responseAgent as any)?.createResponsePlan === "function") {
            plan = (responseAgent as any).createResponsePlan({
              aiText: finalText,
              intention,
              emotion,
              stage,
              context: { profile: {}, calendar: {} },
            });
          }
        } catch (e) {
          logger.warn("Failed generating plan (ignored)", { phone, e });
        }
      }

      const planItems = plan?.items;

      logger.info("HUMANIZER DEBUG", {
        phone,
        chatId,
        hasPlan: !!plan,
        itemsLen: Array.isArray(planItems) ? planItems.length : 0,
        bubbles: plan?.bubbles?.length ?? null,
        stage,
        emotion,
        intention,
      });

      // ✅ If pause happens in between, stop
      if (isChatPaused(chatId)) {
        // ✅ FIX: logger.conversation expected 1-2 args; put HANDOFF tag in meta
        logger.conversation("Conversation paused mid-flight, skipping send", { chatId, phone, tag: "HANDOFF" });
        return;
      }

      if (Array.isArray(planItems) && planItems.length > 0 && typeof (wahaService as any)?.sendPlanV3 === "function") {
        logger.conversation("Sending humanized plan", {
          phone,
          chatId,
          items: planItems.length,
          bubbles: plan?.bubbles?.length ?? null,
        });

        await (wahaService as any).sendPlanV3(chatId, planItems);
      } else {
        await wahaService.sendMessage({ chatId, text: finalText });
      }

      logger.conversation("Response sent", {
        phone,
        chatId,
        emotion,
        shouldEscalate: result.shouldEscalate,
        usedPlan: !!planItems?.length,
      });

      if (result.shouldEscalate) {
        logger.warn("Escalation needed", { phone, reason: result.escalationReason });
      }
    } catch (error) {
      logger.error("Error processing message", error);

      // if paused, don't send fallback either
      if (isChatPaused(chatId)) return;

      try {
        await wahaService.sendMessage({
          chatId,
          text: "Desculpe, tive um problema técnico. Um atendente irá te ajudar em breve! 🙏",
        });
      } catch (e) {
        logger.error("Failed to send error message", e);
      }
    }
  }

  private isBlocked(from: string): boolean {
    if (!this.config.blockedNumbers || this.config.blockedNumbers.length === 0) return false;
    const phone = this.stripSuffix(String(from || "")).replace(/\D/g, "");
    return this.config.blockedNumbers.some((blocked) => phone.includes(String(blocked).replace(/\D/g, "")));
  }

  private isAllowed(from: string): boolean {
    if (!this.config.allowedNumbers || this.config.allowedNumbers.length === 0) return true;
    const phone = this.stripSuffix(String(from || "")).replace(/\D/g, "");
    return this.config.allowedNumbers.some((allowed) => phone.includes(String(allowed).replace(/\D/g, "")));
  }

  // ============ Server Management ============
  async start(): Promise<void> {
    await supabaseService.initialize();

    this.server = http.createServer(async (req, res) => {
      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url!, `http://${req.headers.host}`);
      const urlPath = url.pathname;
      const method = req.method || "GET";

      if (!urlPath.match(/\.(js|css|png|jpg|gif|svg|ico|woff|woff2)$/)) {
        logger.request(method, urlPath);
      }

      const methodRoutes = this.routes.get(method);
      let handler: RouteHandler | undefined;

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
            await handler!(req, res, body);
          } catch (error) {
            logger.error("Route handler error", error);
            this.sendJSON(res, 500, { error: "Internal server error" });
          }
        });
        return;
      }

      if (method === "GET") {
        const served = await this.serveStaticFile(req, res, urlPath);
        if (served) return;
      }

      this.sendJSON(res, 404, { error: "Not found" });
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        logger.info(`Webhook server running on http://${this.config.host}:${this.config.port}`, undefined);
        logger.info("Available endpoints:", undefined);
        logger.info("  GET  /              - Dashboard", undefined);
        logger.info("  POST /webhook/waha  - WAHA webhook", undefined);
        logger.info("  GET  /health        - Health check", undefined);
        logger.info("  GET  /stats         - Statistics", undefined);
        logger.info("  POST /send          - Send message", undefined);
        logger.info("  POST /api/chat      - Chat demo endpoint (Landing)", undefined);

        logger.info("  POST /api/conversations/pause  - Pause conversation", undefined);
        logger.info("  POST /api/conversations/resume - Resume conversation", undefined);

        resolve();
      });

      this.server!.on("error", reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();

      this.server.close(() => {
        logger.info("Webhook server stopped", undefined);
        supabaseService.close();
        resolve();
      });
    });
  }

  private sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }

  updateConfig(updates: Partial<WebhookConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info("Webhook config updated", updates);
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
