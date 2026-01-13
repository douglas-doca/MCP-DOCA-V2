// src/services/waha.service.ts
// ============================================
// WAHA Service - DOCA
// - sendMessage
// - sendMedia
// - typing start/stop + sendTypingFor
// - sendPlanV3 (typing + bolhas + delays)
// + ✅ track bot message IDs (para detectar intervenção humana)
// + ✅ suporta chatId @lid (não converte para @c.us)
// ============================================

import { logger } from "../utils/logger.js";

type SendMessagePayload = {
  chatId: string;
  text: string;
};

type SendMediaPayload = {
  chatId: string;
  mediaUrl: string;
  caption?: string;
};

type WAHAConfig = {
  baseUrl: string;
  apiKey?: string;
  session?: string; // ex: "default"
  timeoutMs: number;
  debug?: boolean;
};

type PlanItem =
  | { type: "typing"; action: "start" | "stop"; delayMs: number }
  | { type: "text"; text: string; delayMs: number };

// ============================================
// ✅ Bot message id tracking (to distinguish human vs bot)
// ============================================
const BOT_SENT_IDS = new Map<string, number>();
const BOT_ACTIVE_CHATS = new Map<string, number>(); // ✅ NOVO: chats onde o bot está enviando
const BOT_SENT_TTL_MS = Number(process.env.WAHA_BOT_SENT_TTL_MS || 10 * 60 * 1000); // 10 min
const BOT_ACTIVE_TTL_MS = 30_000; // 30 segundos de "proteção" após enviar

function cleanupBotIds() {
  const now = Date.now();
  for (const [id, ts] of BOT_SENT_IDS.entries()) {
    if (now - ts > BOT_SENT_TTL_MS) BOT_SENT_IDS.delete(id);
  }
  for (const [chatId, ts] of BOT_ACTIVE_CHATS.entries()) {
    if (now - ts > BOT_ACTIVE_TTL_MS) BOT_ACTIVE_CHATS.delete(chatId);
  }
}

export function rememberBotSentId(id?: string | null, chatId?: string | null) {
  cleanupBotIds();
  
  // Salva ID em múltiplos formatos
  const v = String(id || "").trim();
  if (v) {
    BOT_SENT_IDS.set(v, Date.now());
    // Se tem _ no ID, salva também só a parte final (alguns webhooks retornam só isso)
    if (v.includes("_")) {
      const parts = v.split("_");
      BOT_SENT_IDS.set(parts[parts.length - 1], Date.now());
    }
  }
  
  // ✅ Marca o chat como "ativo" (bot enviando)
  const chat = String(chatId || "").trim();
  if (chat) {
    BOT_ACTIVE_CHATS.set(chat, Date.now());
    // Normaliza também sem @c.us/@lid
    const phone = chat.replace(/@c\.us$|@lid$|@g\.us$/, "");
    if (phone && phone !== chat) {
      BOT_ACTIVE_CHATS.set(phone, Date.now());
    }
  }
}

export function isBotSentId(id?: string | null, chatId?: string | null): boolean {
  cleanupBotIds();
  
  // 1. Verifica pelo ID da mensagem
  const v = String(id || "").trim();
  if (v && BOT_SENT_IDS.has(v)) return true;
  
  // 2. Verifica se ID parcial bate
  if (v && v.includes("_")) {
    const parts = v.split("_");
    if (BOT_SENT_IDS.has(parts[parts.length - 1])) return true;
  }
  
  // 3. ✅ NOVO: Verifica se o chat está "ativo" (bot enviou recentemente)
  const chat = String(chatId || "").trim();
  if (chat && BOT_ACTIVE_CHATS.has(chat)) return true;
  
  // Normaliza sem sufixo
  const phone = chat.replace(/@c\.us$|@lid$|@g\.us$/, "");
  if (phone && phone !== chat && BOT_ACTIVE_CHATS.has(phone)) return true;
  
  return false;
}

export class WAHAService {
  private config: WAHAConfig;

  constructor(config?: Partial<WAHAConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || process.env.WAHA_BASE_URL || "http://localhost:3000",
      apiKey: config?.apiKey || process.env.WAHA_API_KEY,
      session: config?.session || process.env.WAHA_SESSION || "default",
      timeoutMs: config?.timeoutMs || 25_000,
      debug: config?.debug ?? (process.env.WAHA_DEBUG === "true"),
    };

    logger.agent("WAHA Service initialized", {
      baseUrl: this.config.baseUrl,
      session: this.config.session,
      apiKey: this.config.apiKey ? "***set***" : "***missing***",
    });
  }

  // ============================================================
  // Helpers
  // ============================================================

  private normalizeChatId(input: string): string {
    const raw = String(input || "").trim();
    if (!raw) return raw;

    // ✅ preserve known WA ids
    if (raw.includes("@c.us") || raw.includes("@g.us") || raw.includes("@lid")) return raw;

    // remove +, spaces, etc
    const digits = raw.replace(/\D/g, "");
    if (!digits) return raw;

    return `${digits}@c.us`;
  }

  private async sleep(ms: number): Promise<void> {
    const n = Number(ms || 0);
    if (!n || n <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, n));
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const key = String(this.config.apiKey || "").trim();
    if (key) h["X-Api-Key"] = key;

    return h;
  }

  private async request(method: string, endpoint: string, body?: any): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      if (this.config.debug) {
        logger.info("WAHA REQUEST", { method, url, body }, "WAHA");
      }

      const res = await fetch(url, {
        method,
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const raw = await res.text();
      let data: any = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = raw;
      }

      if (!res.ok) {
        logger.error("WAHA ERROR RESPONSE", { status: res.status, data }, "WAHA");
        throw new Error(`WAHA request failed: ${res.status}`);
      }

      return data;
    } finally {
      clearTimeout(t);
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  /**
   * Envia mensagem simples
   */
  async sendMessage(payload: SendMessagePayload): Promise<any> {
    const chatId = this.normalizeChatId(payload.chatId);
    const text = String(payload.text || "").trim();
    if (!chatId || !text) return null;

    const endpoint = `/api/sendText`;
    const body = {
      session: this.config.session,
      chatId,
      text,
    };

    const resp = await this.request("POST", endpoint, body);

    // ✅ remember bot message id + chatId so we can detect human intervention later
    const msgId =
      resp?.id?._serialized ||
      resp?._data?.id?._serialized ||
      resp?._data?.id?.id ||
      resp?.id?.id;

    rememberBotSentId(msgId, chatId);

    return resp;
  }

  /**
   * Envia mídia com legenda (se suportado)
   */
  async sendMedia(payload: SendMediaPayload): Promise<any> {
    const chatId = this.normalizeChatId(payload.chatId);
    const mediaUrl = String(payload.mediaUrl || "").trim();
    const caption = payload.caption ? String(payload.caption).trim() : undefined;

    if (!chatId || !mediaUrl) return null;

    const endpoint = `/api/sendMedia`;

    const body: any = {
      session: this.config.session,
      chatId,
      file: {
        url: mediaUrl,
      },
    };

    if (caption) body.caption = caption;

    const resp = await this.request("POST", endpoint, body);

    const msgId =
      resp?.id?._serialized ||
      resp?._data?.id?._serialized ||
      resp?._data?.id?.id ||
      resp?.id?.id;

    rememberBotSentId(msgId, chatId);

    return resp;
  }

  /**
   * Envia imagem (alias para sendMedia)
   */
  async sendImage(chatId: string, imageUrl: string, caption?: string): Promise<any> {
    return this.sendMedia({
      chatId,
      mediaUrl: imageUrl,
      caption,
    });
  }

  /**
   * Busca mensagens do chat
   */
  async getMessages(chatId: string, limit: number = 20): Promise<any> {
    const to = this.normalizeChatId(chatId);
    if (!to) return [];

    const endpoint = `/api/${this.config.session}/chats/${to}/messages?limit=${limit}`;
    return this.request("GET", endpoint);
  }

  /**
   * Verifica se número tem WhatsApp
   */
  async checkNumber(phone: string): Promise<any> {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return { exists: false };

    const endpoint = `/api/contacts/check-exists`;
    const body = {
      session: this.config.session,
      phone: digits,
    };

    return this.request("POST", endpoint, body);
  }

  /**
   * Liga typing
   */
  async startTyping(chatId: string): Promise<any> {
    const to = this.normalizeChatId(chatId);
    if (!to) return null;

    const endpoint = `/api/startTyping`;

    const body = {
      session: this.config.session,
      chatId: to,
    };

    return this.request("POST", endpoint, body);
  }

  /**
   * Desliga typing
   */
  async stopTyping(chatId: string): Promise<any> {
    const to = this.normalizeChatId(chatId);
    if (!to) return null;

    const endpoint = `/api/stopTyping`;

    const body = {
      session: this.config.session,
      chatId: to,
    };

    return this.request("POST", endpoint, body);
  }

  /**
   * Simula typing por X ms (start → espera → stop)
   */
  async sendTypingFor(chatId: string, ms: number): Promise<void> {
    const to = this.normalizeChatId(chatId);
    if (!to) return;

    try {
      await this.startTyping(to);
      await this.sleep(ms);
    } catch (err) {
      logger.warn("TypingFor failed (ignored)", { chatId: to, err }, "WAHA");
    } finally {
      try {
        await this.stopTyping(to);
      } catch {
        // ignore
      }
    }
  }

  // ============================================================
  // ✅ Humanized Plan Executor (V3)
  // ============================================================

  async sendPlanV3(chatId: string, items: PlanItem[]): Promise<void> {
    const to = this.normalizeChatId(chatId);
    if (!to) return;

    if (!items || !Array.isArray(items) || items.length === 0) return;

    const safeItems = items.slice(0, 20);

    // ✅ Pre-mark chat como ativo ANTES de enviar (evita race condition)
    rememberBotSentId(null, to);

    logger.agent("WAHA sendPlanV3", { chatId: to, items: safeItems.length });

    for (const item of safeItems) {
      try {
        if (item.type === "typing") {
          if (item.action === "start") await this.startTyping(to);
          else await this.stopTyping(to);

          if (item.delayMs) await this.sleep(item.delayMs);
          continue;
        }

        if (item.type === "text") {
          const text = String(item.text || "").trim();
          if (text) await this.sendMessage({ chatId: to, text });

          if (item.delayMs) await this.sleep(item.delayMs);
          continue;
        }
      } catch (err) {
        logger.warn("WAHA plan item failed (continuing)", { chatId: to, item, err }, "WAHA");
      }
    }

    try {
      await this.stopTyping(to);
    } catch {
      // ignore
    }
  }
}

// Singleton
const GLOBAL_KEY = "__DOCA_WAHA_SINGLETON__";
const g = globalThis as any;

if (!g[GLOBAL_KEY]) {
  g[GLOBAL_KEY] = new WAHAService();
}

export const wahaService: WAHAService = g[GLOBAL_KEY];