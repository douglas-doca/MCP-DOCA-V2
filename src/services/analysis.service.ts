// src/services/analysis.service.ts
import { supabaseService } from "./supabase.service.js";
import { wahaService } from "./waha.service.js";
import { aiService } from "./ai.service.js";
import { logger } from "../utils/logger.js";

type Range = "today" | "7d" | "30d";

export class AnalysisService {
  async getStalledConversations(opts: {
    min_minutes: number;
    limit: number;
    status: "open" | "closed";
  }) {
    const { min_minutes, limit, status } = opts;

    // Pega conversas e filtra por "paradas"
    const conversations = await supabaseService.getConversations(limit * 3);

    const now = Date.now();
    const minMs = min_minutes * 60_000;

    const stalled = (conversations || [])
      .filter((c: any) => {
        // status é opcional mas aqui vem sempre
        if (status && c.status && c.status !== status) return false;

        // Supabase geralmente salva como string ISO
        const updatedIso = c.updated_at || c.updatedAt || c.created_at || c.createdAt || 0;
        const updated = new Date(updatedIso).getTime();

        if (!updated || Number.isNaN(updated)) return false;
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

  async getSummary(opts: { range: Range }) {
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

  async runAnalysis(opts: {
    conversation_id: string;
    mode: "followup" | "insights";
    language: string;
  }) {
    const { conversation_id, mode } = opts;

    // Buscar mensagens
    const messages = await supabaseService.getRecentMessages(conversation_id, 80);

    if (!messages || messages.length === 0) {
      return { ok: false, error: "No messages found", conversation_id };
    }

    // Última mensagem (usa "content", conforme seu type Message)
    const last = messages[messages.length - 1] as any;
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
    const followup =
      text.length > 0
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

  async approveAndSend(opts: {
    conversation_id: string;
    text: string;
    followup_id?: string;
    phone?: string;
  }) {
    const { conversation_id, text, phone } = opts;

    // Se não veio phone, tenta inferir pela conversa
    let to = phone;

    if (!to) {
      const conv = await supabaseService.getConversationById(conversation_id);

      // Conforme seu type Conversation: chatId (camelCase)
      // Mas como supabase pode retornar snake_case, damos fallback
      to = (conv as any)?.chatId || (conv as any)?.chat_id || (conv as any)?.phone;
    }

    if (!to) {
      return { ok: false, error: "Phone/chatId not found for conversation" };
    }

    const cleanText = String(text || "").trim();
    if (cleanText.length < 2) {
      return { ok: false, error: "Text is too short" };
    }

    const result = await wahaService.sendMessage({
      chatId: to,
      text: cleanText,
    });

    // Aqui você pode salvar no supabase um log de followup enviado
    logger.info("Followup sent", { conversation_id, to }, "ANALYSIS");

    return { ok: true, conversation_id, to, result };
  }
}

export const analysisService = new AnalysisService();
