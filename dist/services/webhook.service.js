// src/services/webhook.service.ts
// ============================================
// Webhook Service
// - Entry point para mensagens (Landing / WhatsApp)
// - Normaliza payload
// - Gera phone/chatId (landing)
// - Chama ResponseAgent
// - Retorna: ok, reply, responsePlan, emotion, intention, stage
// ============================================
import { logger } from "../utils/logger.js";
import { responseAgent } from "./response.agent.js";
function safeString(v) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
}
function normalizeChannel(v) {
    const ch = safeString(v).trim().toLowerCase();
    if (ch === "landing" || ch === "landing_page" || ch === "landingpage")
        return "landing_chat";
    if (ch === "landing_chat")
        return "landing_chat";
    if (ch === "whatsapp")
        return "whatsapp";
    return ch || "whatsapp";
}
function normalizeUiMode(v) {
    const u = safeString(v).trim().toLowerCase();
    return u === "instant" ? "instant" : "real";
}
function pickMessage(payload) {
    const msg = safeString(payload.message) || safeString(payload.text) || safeString(payload.input);
    return msg.trim();
}
/**
 * Landing: precisamos simular "phone" e "chatId".
 * Não pode conflitar com WhatsApp real.
 *
 * phone/chatId:
 *  - "landing:<sessionId>"
 */
function buildLandingIdentity(sessionId) {
    const sid = safeString(sessionId).trim();
    const safeSid = sid || `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    const phone = `landing:${safeSid}`;
    const chatId = `landing:${safeSid}`;
    return { phone, chatId, sessionId: safeSid };
}
function looksLikeQuotaError(err) {
    const msg = safeString(err?.message || err?.toString?.()).toLowerCase();
    return (msg.includes("quota") ||
        msg.includes("credit") ||
        msg.includes("insufficient") ||
        msg.includes("rate limit") ||
        msg.includes("429") ||
        msg.includes("payment") ||
        msg.includes("billing"));
}
function fallbackNoCreditsReply() {
    const reply = "Ops 😅 parece que eu tô com instabilidade aqui agora.\n\n" +
        "Me manda seu WhatsApp ou seu melhor horário que eu te chamo rapidinho e te explico em 2 min. 🙂";
    const responsePlan = {
        items: [
            { type: "typing", action: "start", delayMs: 0 },
            { type: "text", text: "Ops 😅 parece que eu tô com instabilidade aqui agora.", delayMs: 650 },
            { type: "typing", action: "stop", delayMs: 0 },
            { type: "typing", action: "start", delayMs: 250 },
            {
                type: "text",
                text: "Me manda seu WhatsApp ou seu melhor horário que eu te chamo rapidinho e te explico em 2 min. 🙂",
                delayMs: 1100,
            },
            { type: "typing", action: "stop", delayMs: 0 },
        ],
        bubbles: [
            "Ops 😅 parece que eu tô com instabilidade aqui agora.",
            "Me manda seu WhatsApp ou seu melhor horário que eu te chamo rapidinho e te explico em 2 min. 🙂",
        ],
        meta: {
            intention: "outros",
            emotion: "neutral",
            stage: "new",
            mode: "TWO_BUBBLES",
        },
    };
    return { reply, responsePlan };
}
export class WebhookService {
    async handleChat(payload) {
        const channel = normalizeChannel(payload.channel);
        const uiMode = normalizeUiMode(payload.ui_mode);
        const userMessage = pickMessage(payload);
        if (!userMessage) {
            return {
                ok: true,
                reply: "Me manda sua mensagem aqui 🙂",
                responsePlan: {
                    items: [
                        { type: "typing", action: "start", delayMs: 0 },
                        { type: "text", text: "Me manda sua mensagem aqui 🙂", delayMs: 650 },
                        { type: "typing", action: "stop", delayMs: 0 },
                    ],
                    bubbles: ["Me manda sua mensagem aqui 🙂"],
                    meta: { intention: "outros", emotion: "neutral", stage: "new", mode: "SINGLE" },
                },
                emotion: "neutral",
                intention: "outros",
                stage: "new",
                shouldEscalate: false,
            };
        }
        // --------------------------------------------
        // Resolve identidade (Landing vs WhatsApp)
        // --------------------------------------------
        let phone = safeString(payload.phone).trim();
        let chatId = safeString(payload.chatId).trim();
        let resolvedSessionId = safeString(payload.session_id).trim();
        if (channel === "landing_chat") {
            const identity = buildLandingIdentity(resolvedSessionId);
            phone = identity.phone;
            chatId = identity.chatId;
            resolvedSessionId = identity.sessionId;
        }
        else {
            if (!phone || !chatId) {
                logger.error("WhatsApp payload missing phone/chatId", { payload }, "WEBHOOK");
                return {
                    ok: false,
                    reply: "Ops 😅 não consegui identificar a conversa. Pode tentar de novo?",
                };
            }
        }
        // --------------------------------------------
        // meta de entrada (NÃO duplica channel/ui_mode aqui)
        // --------------------------------------------
        const entryMeta = payload.meta && typeof payload.meta === "object" ? payload.meta : {};
        const meta = {
            ...(entryMeta || {}),
            session_id: resolvedSessionId || null,
        };
        logger.info("API CHAT received", { phone, chatId, channel, ui_mode: uiMode, session_id: resolvedSessionId || null }, "WEBHOOK");
        try {
            const result = await responseAgent.processMessage(phone, chatId, userMessage, {
                channel,
                ui_mode: uiMode,
                meta,
            });
            const reply = safeString(result?.response) || safeString(result?.reply) || "Recebi sua mensagem 🙂";
            const responsePlan = result?.responsePlan || result?.plan || null;
            return {
                ok: true,
                reply,
                responsePlan,
                emotion: result?.emotion || "neutral",
                intention: result?.intention || "outros",
                stage: result?.stage || "new",
                shouldEscalate: !!result?.shouldEscalate,
                meta: {
                    sessionId: resolvedSessionId || null,
                    phone,
                    chatId,
                    channel,
                    ui_mode: uiMode,
                },
            };
        }
        catch (err) {
            logger.error("Error in handleChat", err, "WEBHOOK");
            if (looksLikeQuotaError(err)) {
                const fb = fallbackNoCreditsReply();
                return {
                    ok: true,
                    reply: fb.reply,
                    responsePlan: fb.responsePlan,
                    emotion: "neutral",
                    intention: "outros",
                    stage: "new",
                    shouldEscalate: false,
                    meta: {
                        sessionId: resolvedSessionId || null,
                        phone,
                        chatId,
                        channel,
                        ui_mode: uiMode,
                        quota_error: true,
                    },
                };
            }
            return {
                ok: false,
                reply: "Ops 😅 tivemos um problema ao responder. Tente novamente.",
            };
        }
    }
}
// Singleton
export const webhookService = new WebhookService();
