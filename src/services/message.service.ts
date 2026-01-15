// ============================================================
// src/services/message.service.ts
// Serviço unificado de mensagens - escolhe entre WAHA e Z-API
// baseado na configuração do cliente
// ============================================================

import { logger } from "../utils/logger.js";
import { wahaService } from "./waha.service.js";
import { zapiService } from "./zapi.service.js";
import { clientService } from "./client.service.js";
import { WebhookProvider } from "../types/webhook.types.js";

// ============================================================
// TIPOS
// ============================================================

export interface SendMessageOptions {
  chatId: string;
  text: string;
  clientId?: string;
}

export interface SendMessageResult {
  success: boolean;
  provider: WebhookProvider;
  messageId?: string;
  error?: string;
}

// ============================================================
// MESSAGE SERVICE CLASS
// ============================================================

class MessageService {
  private initialized = false;
  
  constructor() {}
  
  /**
   * Inicializa configs de Z-API de todos os clientes
   */
  initialize(): void {
    if (this.initialized) return;
    
    const clients = clientService.getAllClients();
    
    for (const client of clients) {
      if (client.config.zapi?.instance_id && client.config.zapi?.token) {
        zapiService.registerTenantConfig(client.id, {
          instanceId: client.config.zapi.instance_id,
          token: client.config.zapi.token,
          clientToken: client.config.zapi.clientToken,
        });
      }
    }
    
    this.initialized = true;
    logger.info("MessageService initialized", { clients: clients.length }, "MESSAGE");
  }
  
  /**
   * Determina o provider do cliente
   */
  getProvider(clientId?: string): WebhookProvider {
    if (!clientId) return "waha"; // Default
    
    const config = clientService.getClientConfig(clientId);
    if (!config) return "waha";
    
    // Verifica campo message_provider no config
    const provider = (config as any).message_provider;
    if (provider === "zapi" || provider === "waha") {
      return provider;
    }
    
    // Fallback: se tem config Z-API válido, usa Z-API
    if (config.zapi?.instance_id && config.zapi?.token) {
      return "zapi";
    }
    
    return "waha";
  }
  
  /**
   * Envia mensagem usando o provider correto
   */
  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const { chatId, text, clientId } = options;
    const provider = this.getProvider(clientId);
    
    logger.info("Sending message", {
      provider,
      clientId,
      chatId: chatId.substring(0, 15) + "...",
      textLength: text.length,
    }, "MESSAGE");
    
    try {
      if (provider === "zapi") {
        return await this.sendViaZapi(chatId, text, clientId);
      } else {
        return await this.sendViaWaha(chatId, text);
      }
    } catch (error: any) {
      logger.error("Error sending message", { provider, chatId, error }, "MESSAGE");
      return {
        success: false,
        provider,
        error: error?.message || "Unknown error",
      };
    }
  }
  
  private async sendViaWaha(chatId: string, text: string): Promise<SendMessageResult> {
    const result = await wahaService.sendMessage({ chatId, text });
    
    return {
      success: !!result,
      provider: "waha",
      messageId: result?.id || result?.key?.id,
    };
  }
  
  private async sendViaZapi(chatId: string, text: string, clientId?: string): Promise<SendMessageResult> {
    const result = await zapiService.sendText({
      phone: chatId,
      message: text,
    }, clientId);
    
    return {
      success: !!result && !result.error,
      provider: "zapi",
      messageId: result?.messageId,
      error: result?.error,
    };
  }
  
  /**
   * Envia múltiplas bolhas (humanizado)
   */
  async sendBubbles(
    chatId: string,
    bubbles: Array<{ text: string; delay?: number }>,
    clientId?: string
  ): Promise<SendMessageResult[]> {
    const results: SendMessageResult[] = [];
    
    for (const bubble of bubbles) {
      if (bubble.delay && bubble.delay > 0) {
        await this.sleep(bubble.delay);
      }
      
      const result = await this.sendMessage({
        chatId,
        text: bubble.text,
        clientId,
      });
      
      results.push(result);
      
      if (!result.success) break;
    }
    
    return results;
  }
  
  /**
   * Envia plano humanizado (compatível com wahaService.sendPlanV3)
   */
  async sendPlan(
    chatId: string,
    planItems: Array<{ type: string; text?: string; delayMs?: number }>,
    clientId?: string
  ): Promise<void> {
    const provider = this.getProvider(clientId);
    
    // Se for WAHA e tiver sendPlanV3, usa direto
    if (provider === "waha" && typeof (wahaService as any)?.sendPlanV3 === "function") {
      await (wahaService as any).sendPlanV3(chatId, planItems);
      return;
    }
    
    // Fallback: enviar manualmente
    for (const item of planItems) {
      if (item.type === "typing" || item.type === "delay") {
        const delay = item.delayMs || 1000;
        await this.sleep(delay);
        continue;
      }
      
      if (item.type === "text" && item.text) {
        await this.sendMessage({
          chatId,
          text: item.text,
          clientId,
        });
      }
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// SINGLETON
// ============================================================

export const messageService = new MessageService();
export default messageService;