// ============================================================
// src/services/zapi.service.ts
// Serviço para envio de mensagens via Z-API
// Docs: https://developer.z-api.io
// ============================================================
import { logger } from "../utils/logger.js";
// ============================================================
// ZAPI SERVICE CLASS
// ============================================================
export class ZAPIService {
    configs = new Map();
    defaultConfig = null;
    constructor() {
        // Carregar config padrão do ENV (se existir)
        const instanceId = process.env.ZAPI_INSTANCE_ID;
        const token = process.env.ZAPI_TOKEN;
        const clientToken = process.env.ZAPI_CLIENT_TOKEN;
        if (instanceId && token) {
            this.defaultConfig = {
                instanceId,
                token,
                clientToken,
                baseUrl: "https://api.z-api.io",
            };
            logger.info("Z-API default config loaded from ENV", { instanceId });
        }
    }
    // ============================================================
    // CONFIGURAÇÃO
    // ============================================================
    /**
     * Registra config de um tenant específico
     */
    registerTenantConfig(tenantId, config) {
        this.configs.set(tenantId, {
            ...config,
            baseUrl: config.baseUrl || "https://api.z-api.io",
        });
        logger.info("Z-API config registered for tenant", { tenantId, instanceId: config.instanceId });
    }
    /**
     * Obtém config de um tenant ou usa default
     */
    getConfig(tenantId) {
        if (tenantId && this.configs.has(tenantId)) {
            return this.configs.get(tenantId);
        }
        return this.defaultConfig;
    }
    /**
     * Verifica se tenant tem config válida
     */
    hasConfig(tenantId) {
        return !!this.getConfig(tenantId);
    }
    // ============================================================
    // HELPERS
    // ============================================================
    getHeaders(config) {
        const headers = {
            "Content-Type": "application/json",
        };
        if (config.clientToken) {
            headers["Client-Token"] = config.clientToken;
        }
        return headers;
    }
    getBaseUrl(config) {
        return `${config.baseUrl}/instances/${config.instanceId}/token/${config.token}`;
    }
    formatPhone(phone) {
        // Remove tudo que não é número
        let cleaned = String(phone).replace(/\D/g, "");
        // Remove @c.us, @g.us, etc se existir
        cleaned = cleaned.replace(/@.*$/, "");
        // Se começar com 55 e tiver 13 dígitos (com 9), está ok
        // Se começar com 55 e tiver 12 dígitos (sem 9), adiciona o 9
        if (cleaned.startsWith("55") && cleaned.length === 12) {
            // Adiciona o 9 após o DDD (posição 4)
            cleaned = cleaned.slice(0, 4) + "9" + cleaned.slice(4);
        }
        return cleaned;
    }
    async request(method, endpoint, config, body) {
        const url = `${this.getBaseUrl(config)}/${endpoint}`;
        const headers = this.getHeaders(config);
        try {
            const response = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!response.ok) {
                const errorText = await response.text();
                logger.error("Z-API request failed", {
                    status: response.status,
                    endpoint,
                    error: errorText,
                });
                return null;
            }
            const data = await response.json();
            return data;
        }
        catch (error) {
            logger.error("Z-API request error", { endpoint, error });
            return null;
        }
    }
    // ============================================================
    // ENVIO DE MENSAGENS
    // ============================================================
    /**
     * Envia mensagem de texto simples
     */
    async sendText(options, tenantId) {
        const config = this.getConfig(tenantId);
        if (!config) {
            logger.error("Z-API config not found", { tenantId });
            return null;
        }
        const phone = this.formatPhone(options.phone);
        const body = {
            phone,
            message: options.message,
        };
        if (options.delayMessage) {
            body.delayMessage = options.delayMessage;
        }
        if (options.delayTyping) {
            body.delayTyping = options.delayTyping;
        }
        logger.info("Z-API sending text", { phone, messageLength: options.message.length, tenantId });
        return this.request("POST", "send-text", config, body);
    }
    /**
     * Envia imagem
     */
    async sendImage(options, tenantId) {
        const config = this.getConfig(tenantId);
        if (!config)
            return null;
        const phone = this.formatPhone(options.phone);
        return this.request("POST", "send-image", config, {
            phone,
            image: options.image,
            caption: options.caption || "",
        });
    }
    /**
     * Envia áudio
     */
    async sendAudio(options, tenantId) {
        const config = this.getConfig(tenantId);
        if (!config)
            return null;
        const phone = this.formatPhone(options.phone);
        return this.request("POST", "send-audio", config, {
            phone,
            audio: options.audio,
        });
    }
    /**
     * Envia documento
     */
    async sendDocument(options, tenantId) {
        const config = this.getConfig(tenantId);
        if (!config)
            return null;
        const phone = this.formatPhone(options.phone);
        return this.request("POST", "send-document-url", config, {
            phone,
            document: options.document,
            fileName: options.fileName || "document",
        });
    }
    /**
     * Envia botões de ação
     */
    async sendButtons(options, tenantId) {
        const config = this.getConfig(tenantId);
        if (!config)
            return null;
        const phone = this.formatPhone(options.phone);
        return this.request("POST", "send-button-actions", config, {
            phone,
            message: options.message,
            title: options.title || "",
            footer: options.footer || "",
            buttons: options.buttons.map((btn, idx) => ({
                id: btn.id || String(idx + 1),
                label: btn.label,
            })),
        });
    }
    /**
     * Envia lista de opções
     */
    async sendList(options, tenantId) {
        const config = this.getConfig(tenantId);
        if (!config)
            return null;
        const phone = this.formatPhone(options.phone);
        return this.request("POST", "send-option-list", config, {
            phone,
            message: options.message,
            buttonLabel: options.buttonLabel,
            sections: options.sections,
        });
    }
    /**
     * Simula digitando
     */
    async sendTyping(phone, duration = 3000, tenantId) {
        const config = this.getConfig(tenantId);
        if (!config)
            return null;
        const formattedPhone = this.formatPhone(phone);
        // Z-API não tem endpoint de typing, mas podemos usar delay no send-text
        // Retorna true para compatibilidade
        return { success: true, duration };
    }
    /**
     * Envia mensagem usando interface compatível com WAHA
     * (para facilitar migração)
     */
    async sendMessage(options, tenantId) {
        return this.sendText({
            phone: options.chatId,
            message: options.text,
        }, tenantId);
    }
    // ============================================================
    // STATUS E UTILIDADES
    // ============================================================
    /**
     * Verifica status da instância
     */
    async getStatus(tenantId) {
        const config = this.getConfig(tenantId);
        if (!config)
            return null;
        return this.request("GET", "status", config);
    }
    /**
     * Verifica se número tem WhatsApp
     */
    async checkNumber(phone, tenantId) {
        const config = this.getConfig(tenantId);
        if (!config)
            return null;
        const formattedPhone = this.formatPhone(phone);
        return this.request("GET", `phone-exists/${formattedPhone}`, config);
    }
    /**
     * Obtém QR Code para conexão
     */
    async getQRCode(tenantId) {
        const config = this.getConfig(tenantId);
        if (!config)
            return null;
        return this.request("GET", "qr-code/image", config);
    }
    /**
     * Desconecta instância
     */
    async disconnect(tenantId) {
        const config = this.getConfig(tenantId);
        if (!config)
            return null;
        return this.request("GET", "disconnect", config);
    }
    /**
     * Reinicia instância
     */
    async restart(tenantId) {
        const config = this.getConfig(tenantId);
        if (!config)
            return null;
        return this.request("GET", "restart", config);
    }
}
// ============================================================
// SINGLETON EXPORT
// ============================================================
export const zapiService = new ZAPIService();
export default zapiService;
