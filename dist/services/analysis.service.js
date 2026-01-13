// src/services/analysis.service.ts
import { supabaseService } from "./supabase.service.js";
import { wahaService } from "./index.js";
import { logger } from "../utils/logger.js";
import { responseAgent } from "./response.agent.js";
function normalizePhoneOrChatId(input) {
    const raw = String(input || "").trim();
    const chatId = raw.includes("@") ? raw : raw; // WAHAService pode normalizar; mantemos compat
    const phone = raw.replace("@c.us", "").replace(/\D/g, "");
    return { chatId, phone };
}
export class AnalysisService {
    // ============================================================
    // ✅ Humanized Sender (Agent Studio / Humanizer integration)
    // ============================================================
    /**
     * Envia mensagem passando pelo humanizer (Agent Studio).
     * Usa responseAgent.createResponsePlan() para gerar um plan com bolhas, delays e typing.
     * Se plan não existir (ou falhar), faz fallback para sendMessage.
     */
    async sendHumanized(phoneOrChatId, text, meta) {
        const clean = String(text || "").trim();
        if (!clean)
            return;
        const { chatId } = normalizePhoneOrChatId(phoneOrChatId);
        const stage = meta?.stage || "warm";
        const emotion = meta?.emotion || "neutral";
        const intention = meta?.intention || "followup";
        // Gera plan usando o mesmo motor do Agent Studio (simulate)
        const plan = typeof responseAgent?.createResponsePlan === "function"
            ? responseAgent.createResponsePlan({
                aiText: clean,
                intention,
                emotion,
                stage,
            })
            : null;
        const items = plan?.items && Array.isArray(plan.items) ? plan.items : null;
        try {
            // ✅ se existir plan + method sendPlanV3, executa humanizado
            if (items?.length && typeof wahaService?.sendPlanV3 === "function") {
                await wahaService.sendPlanV3(chatId, items);
                return;
            }
            // fallback: 1 mensagem
            await wahaService.sendMessage({ chatId, text: clean });
        }
        catch (err) {
            // fallback absoluto
            try {
                await wahaService.sendMessage({ chatId, text: clean });
            }
            catch {
                // ignore
            }
        }
    }
    async getStalledConversations(opts) {
        const { min_minutes, limit, status } = opts;
        // Pega conversas e filtra por "paradas"
        const conversations = await supabaseService.getConversations(limit * 3);
        const now = Date.now();
        const minMs = min_minutes * 60_000;
        const stalled = (conversations || [])
            .filter((c) => {
            // status é opcional mas aqui vem sempre
            if (status && c.status && c.status !== status)
                return false;
            // Supabase geralmente salva como string ISO
            const updatedIso = c.updated_at || c.updatedAt || c.created_at || c.createdAt || 0;
            const updated = new Date(updatedIso).getTime();
            if (!updated || Number.isNaN(updated))
                return false;
            return now - updated >= minMs;
        })
            .slice(0, limit);
        return {
            ok: true,
            min_minutes,
            count: stalled.length,
            conversations: stalled,
        };
    }
    async getSummary(opts) {
        const range = opts.range ?? "today";
        // Aqui pode virar query real no supabase (mensagens enviadas, followups aprovados etc)
        return {
            ok: true,
            range,
            stalled: 0,
            suggested: 0,
            sent: 0,
        };
    }
    async runAnalysis(opts) {
        const { conversation_id, mode } = opts;
        // Buscar mensagens
        const messages = await supabaseService.getRecentMessages(conversation_id, 80);
        if (!messages || messages.length === 0) {
            return { ok: false, error: "No messages found", conversation_id };
        }
        // Última mensagem (usa "content", conforme seu type Message)
        const last = messages[messages.length - 1];
        const text = String(last?.content || "").trim().slice(0, 400);
        if (mode === "insights") {
            return {
                ok: true,
                conversation_id,
                insights: {
                    last_message: text || "—",
                    total_messages: messages.length,
                    hint: "Trocar por IA real depois",
                },
            };
        }
        // followup heurístico (pode trocar pelo aiService depois)
        const followup = text.length > 0
            ? `Oi! Vi sua mensagem: "${text}". Quer que eu te ajude com os próximos passos?`
            : `Oi! Vi que você chamou aqui 😊 Quer que eu te ajude com os próximos passos?`;
        return {
            ok: true,
            conversation_id,
            mode: "followup",
            followups: [
                {
                    id: `fu_${Date.now()}`,
                    title: "Follow-up rápido",
                    timing: "Hoje",
                    text: followup,
                    confidence: 0.7,
                    stage: "reativacao",
                    tags: ["followup", "heurístico"],
                },
            ],
        };
    }
    async approveAndSend(opts) {
        const { conversation_id, text, phone } = opts;
        // Se não veio phone, tenta inferir pela conversa
        let to = phone;
        if (!to) {
            const conv = await supabaseService.getConversationById(conversation_id);
            // Conforme seu type Conversation: chatId (camelCase)
            // Mas como supabase pode retornar snake_case, damos fallback
            to = conv?.chatId || conv?.chat_id || conv?.phone;
        }
        if (!to) {
            return { ok: false, error: "Phone/chatId not found for conversation" };
        }
        const cleanText = String(text || "").trim();
        if (cleanText.length < 2) {
            return { ok: false, error: "Text is too short" };
        }
        const { phone: phoneNormalized } = normalizePhoneOrChatId(String(to));
        // ✅ stage do lead (melhora CTA / comportamento do humanizer)
        let stage = "warm";
        try {
            if (phoneNormalized) {
                const lead = await supabaseService.getLeadByPhone(phoneNormalized);
                stage = lead?.stage || "warm";
            }
        }
        catch { }
        // ✅ envio humanizado (bolhas + typing + delays)
        await this.sendHumanized(String(to), cleanText, {
            intention: "followup",
            emotion: "neutral",
            stage,
        });
        logger.info("Followup sent", { conversation_id, to, stage }, "ANALYSIS");
        return { ok: true, conversation_id, to, stage };
    }
}
export const analysisService = new AnalysisService();
