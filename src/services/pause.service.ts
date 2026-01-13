// ============================================================
// PAUSE SERVICE - Persistência de pause via Supabase
// ============================================================
// Usa o supabaseService.request() para manter compatibilidade

import { supabaseService } from "./supabase.service.js";
import { logger } from "../utils/logger.js";

// Tipos
export type PauseReason =
  | "human_intervention" // Operador assumiu
  | "manual" // Pause manual via dashboard
  | "scheduled" // Pause agendado
  | "escalation"; // Escalação automática

export interface PauseInfo {
  isPaused: boolean;
  pausedUntil: Date | null;
  reason: PauseReason | null;
  pausedBy: string | null;
  pausedAt: Date | null;
}

// ============================================================
// FUNÇÕES PRINCIPAIS
// ============================================================

/**
 * Pausa uma conversa por X minutos (por conversation_id)
 */
export async function pauseChat(
  conversationId: string,
  reason: PauseReason,
  ttlMinutes: number = 30,
  pausedBy: string = "system"
): Promise<boolean> {
  try {
    const pausedUntil = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const result = await supabaseService.request("PATCH", "conversations", {
      query: `id=eq.${conversationId}`,
      body: {
        paused_until: pausedUntil.toISOString(),
        paused_reason: reason,
        paused_by: pausedBy,
        paused_at: new Date().toISOString(),
      },
    });

    if (!result) {
      logger.error("[PauseService] Erro ao pausar", { conversationId });
      return false;
    }

    logger.info(`[PauseService] Chat ${conversationId} pausado por ${ttlMinutes}min (${reason})`, { conversationId, reason, ttlMinutes });
    return true;
  } catch (err) {
    logger.error("[PauseService] Erro ao pausar", err);
    return false;
  }
}

/**
 * Pausa por chat_id (telefone/chatId do WhatsApp) em vez de conversation_id
 */
export async function pauseChatByPhone(
  chatId: string,
  reason: PauseReason,
  ttlMinutes: number = 30,
  pausedBy: string = "system"
): Promise<boolean> {
  try {
    const pausedUntil = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const result = await supabaseService.request("PATCH", "conversations", {
      query: `chat_id=eq.${encodeURIComponent(chatId)}`,
      body: {
        paused_until: pausedUntil.toISOString(),
        paused_reason: reason,
        paused_by: pausedBy,
        paused_at: new Date().toISOString(),
      },
    });

    // Também tenta pelo phone (sem @c.us/@lid)
    const cleanPhone = chatId.replace(/@(c\.us|g\.us|lid)$/, "");
    if (cleanPhone !== chatId) {
      await supabaseService.request("PATCH", "conversations", {
        query: `phone=eq.${encodeURIComponent(cleanPhone)}`,
        body: {
          paused_until: pausedUntil.toISOString(),
          paused_reason: reason,
          paused_by: pausedBy,
          paused_at: new Date().toISOString(),
        },
      });
    }

    logger.info(`[PauseService] Chat ${chatId} pausado por ${ttlMinutes}min (${reason})`, { chatId, reason, ttlMinutes });
    return true;
  } catch (err) {
    logger.error("[PauseService] Erro ao pausar por phone", err);
    return false;
  }
}

/**
 * Retoma uma conversa (remove o pause) por conversation_id
 */
export async function resumeChat(conversationId: string): Promise<boolean> {
  try {
    const result = await supabaseService.request("PATCH", "conversations", {
      query: `id=eq.${conversationId}`,
      body: {
        paused_until: null,
        paused_reason: null,
        paused_by: null,
        paused_at: null,
      },
    });

    logger.info(`[PauseService] Chat ${conversationId} resumido`, { conversationId });
    return true;
  } catch (err) {
    logger.error("[PauseService] Erro ao resumir", err);
    return false;
  }
}

/**
 * Retoma por chat_id (telefone/chatId do WhatsApp)
 */
export async function resumeChatByPhone(chatId: string): Promise<boolean> {
  try {
    await supabaseService.request("PATCH", "conversations", {
      query: `chat_id=eq.${encodeURIComponent(chatId)}`,
      body: {
        paused_until: null,
        paused_reason: null,
        paused_by: null,
        paused_at: null,
      },
    });

    // Também tenta pelo phone (sem @c.us/@lid)
    const cleanPhone = chatId.replace(/@(c\.us|g\.us|lid)$/, "");
    if (cleanPhone !== chatId) {
      await supabaseService.request("PATCH", "conversations", {
        query: `phone=eq.${encodeURIComponent(cleanPhone)}`,
        body: {
          paused_until: null,
          paused_reason: null,
          paused_by: null,
          paused_at: null,
        },
      });
    }

    logger.info(`[PauseService] Chat ${chatId} resumido`, { chatId });
    return true;
  } catch (err) {
    logger.error("[PauseService] Erro ao resumir por phone", err);
    return false;
  }
}

/**
 * Verifica se uma conversa está pausada (por conversation_id)
 */
export async function isChatPaused(conversationId: string): Promise<boolean> {
  try {
    const result = await supabaseService.request<any[]>("GET", "conversations", {
      query: `id=eq.${conversationId}&select=paused_until`,
    });

    if (!result || !result[0]) return false;

    const pausedUntil = result[0].paused_until;
    if (!pausedUntil) return false;

    return new Date(pausedUntil) > new Date();
  } catch (err) {
    logger.error("[PauseService] Erro ao verificar pause", err);
    return false;
  }
}

/**
 * Verifica por chat_id (telefone/chatId do WhatsApp)
 */
export async function isChatPausedByPhone(chatId: string): Promise<boolean> {
  try {
    // Tenta primeiro pelo chat_id exato
    let result = await supabaseService.request<any[]>("GET", "conversations", {
      query: `chat_id=eq.${encodeURIComponent(chatId)}&select=paused_until&limit=1`,
    });

    // Se não encontrou, tenta pelo phone
    if (!result || !result[0]) {
      const cleanPhone = chatId.replace(/@(c\.us|g\.us|lid)$/, "");
      result = await supabaseService.request<any[]>("GET", "conversations", {
        query: `phone=eq.${encodeURIComponent(cleanPhone)}&select=paused_until&order=updated_at.desc&limit=1`,
      });
    }

    if (!result || !result[0]) return false;

    const pausedUntil = result[0].paused_until;
    if (!pausedUntil) return false;

    return new Date(pausedUntil) > new Date();
  } catch (err) {
    logger.error("[PauseService] Erro ao verificar pause por phone", err);
    return false;
  }
}

/**
 * Pega informações completas do pause
 */
export async function getPauseInfo(conversationId: string): Promise<PauseInfo> {
  try {
    const result = await supabaseService.request<any[]>("GET", "conversations", {
      query: `id=eq.${conversationId}&select=paused_until,paused_reason,paused_by,paused_at`,
    });

    if (!result || !result[0]) {
      return { isPaused: false, pausedUntil: null, reason: null, pausedBy: null, pausedAt: null };
    }

    const data = result[0];
    const pausedUntil = data.paused_until ? new Date(data.paused_until) : null;
    const isPaused = pausedUntil ? pausedUntil > new Date() : false;

    return {
      isPaused,
      pausedUntil,
      reason: data.paused_reason as PauseReason | null,
      pausedBy: data.paused_by,
      pausedAt: data.paused_at ? new Date(data.paused_at) : null,
    };
  } catch (err) {
    logger.error("[PauseService] Erro ao pegar info", err);
    return { isPaused: false, pausedUntil: null, reason: null, pausedBy: null, pausedAt: null };
  }
}

/**
 * Lista todas as conversas pausadas (útil pro dashboard)
 */
export async function listPausedChats(): Promise<
  Array<{
    id: string;
    chat_id: string;
    phone: string;
    paused_until: string;
    paused_reason: string;
    paused_by: string;
  }>
> {
  try {
    const now = new Date().toISOString();

    const result = await supabaseService.request<any[]>("GET", "conversations", {
      query: `paused_until=gt.${now}&select=id,chat_id,phone,paused_until,paused_reason,paused_by`,
    });

    return result || [];
  } catch (err) {
    logger.error("[PauseService] Erro ao listar pausados", err);
    return [];
  }
}