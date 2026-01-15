// ============================================================
// src/services/webhookNormalizer.ts
// Normaliza payloads de WAHA e Z-API para formato interno único
// ============================================================

import { logger } from "../utils/logger.js";
import { WebhookProvider, NormalizedMessage } from "../types/webhook.types.js";

// ============================================================
// DETECÇÃO DE PROVIDER
// ============================================================

export function detectProvider(payload: any): WebhookProvider | "unknown" {
  if (!payload || typeof payload !== "object") {
    return "unknown";
  }

  // ========== Z-API Detection ==========
  // Z-API sempre tem `type: "ReceivedCallback"`
  if (payload.type === "ReceivedCallback") {
    return "zapi";
  }
  
  // Z-API tem `instanceId` + `momment` + `phone`
  if (payload.instanceId && payload.momment !== undefined && payload.phone) {
    return "zapi";
  }
  
  // Z-API tem `connectedPhone`
  if (payload.connectedPhone && payload.phone) {
    return "zapi";
  }

  // ========== WAHA Detection ==========
  // WAHA tem `event` + `payload.from`
  if (payload.event && payload.payload?.from) {
    return "waha";
  }
  
  // WAHA tem `session` + `payload`
  if (payload.session && payload.payload) {
    return "waha";
  }
  
  // WAHA: payload direto com `from` e `body`
  if (payload.from && (payload.body !== undefined || payload.hasMedia)) {
    return "waha";
  }

  return "unknown";
}

// ============================================================
// NORMALIZAÇÃO WAHA
// ============================================================

function normalizeWaha(payload: any): NormalizedMessage {
  const p = payload.payload || payload;
  const from = String(p.from || "");
  
  // Extrair telefone limpo
  const phone = from
    .replace("@c.us", "")
    .replace("@g.us", "")
    .replace("@lid", "")
    .replace(/\D/g, "");
  
  // Detectar tipo de mensagem
  let type: NormalizedMessage["type"] = "unknown";
  let text: string | undefined;
  let mediaUrl: string | undefined;
  let mimeType: string | undefined;
  let caption: string | undefined;
  
  // Texto
  if (p.body && typeof p.body === "string") {
    type = "text";
    text = p.body;
  }
  
  // Mídia
  if (p.hasMedia || p.mediaUrl) {
    const pType = String(p.type || "").toLowerCase();
    const pMime = String(p.mimetype || "").toLowerCase();
    
    if (pType === "image" || pMime.startsWith("image/")) {
      type = "image";
    } else if (pType === "audio" || pType === "ptt" || pMime.startsWith("audio/")) {
      type = "audio";
    } else if (pType === "video" || pMime.startsWith("video/")) {
      type = "video";
    } else if (pType === "document" || pType === "file") {
      type = "document";
    } else if (pType === "sticker") {
      type = "sticker";
    }
    
    mediaUrl = p.mediaUrl;
    mimeType = p.mimetype;
    caption = p.caption;
  }
  
  // Location
  if (p.type === "location" || p.location) {
    type = "location";
  }
  
  // Contact
  if (p.type === "vcard" || p.type === "contact" || p.vCards) {
    type = "contact";
  }
  
  return {
    provider: "waha",
    messageId: p.id?._serialized || p.id || `waha-${Date.now()}`,
    chatId: from,
    phone,
    type,
    text,
    caption,
    mediaUrl,
    mimeType,
    fromMe: p.fromMe || false,
    isGroup: from.includes("@g.us"),
    timestamp: p.timestamp ? p.timestamp * 1000 : Date.now(),
    senderName: p._data?.notifyName || p.notifyName,
    senderPhoto: p.senderPhoto,
    participantPhone: p.participant?.replace("@c.us", "").replace(/\D/g, ""),
    session: payload.session,
    instanceId: payload.session,
    raw: payload,
  };
}

// ============================================================
// NORMALIZAÇÃO Z-API
// ============================================================

function normalizeZapi(payload: any): NormalizedMessage {
  const rawPhone = String(payload.phone || "");
  const phone = rawPhone
    .replace("@c.us", "")
    .replace("@g.us", "")
    .replace("-group", "")
    .replace(/\D/g, "");
  
  // ChatId para responder
  const chatId = rawPhone.includes("@") ? rawPhone : `${phone}@c.us`;
  
  // Detectar tipo
  let type: NormalizedMessage["type"] = "unknown";
  let text: string | undefined;
  let mediaUrl: string | undefined;
  let mimeType: string | undefined;
  let caption: string | undefined;
  
  // Texto simples
  if (payload.text?.message) {
    type = "text";
    text = payload.text.message;
  }
  
  // Imagem
  if (payload.image) {
    type = "image";
    mediaUrl = payload.image.imageUrl;
    mimeType = payload.image.mimeType;
    caption = payload.image.caption;
  }
  
  // Áudio
  if (payload.audio) {
    type = "audio";
    mediaUrl = payload.audio.audioUrl;
    mimeType = payload.audio.mimeType;
  }
  
  // Vídeo
  if (payload.video) {
    type = "video";
    mediaUrl = payload.video.videoUrl;
    mimeType = payload.video.mimeType;
    caption = payload.video.caption;
  }
  
  // Documento
  if (payload.document) {
    type = "document";
    mediaUrl = payload.document.documentUrl;
    mimeType = payload.document.mimeType;
    caption = payload.document.fileName;
  }
  
  // Sticker
  if (payload.sticker) {
    type = "sticker";
    mediaUrl = payload.sticker.stickerUrl;
    mimeType = payload.sticker.mimeType;
  }
  
  // Localização
  if (payload.location) {
    type = "location";
  }
  
  // Contato
  if (payload.contact) {
    type = "contact";
  }
  
  // Reação
  if (payload.reaction) {
    type = "reaction";
    text = payload.reaction.value;
  }
  
  // Enquete
  if (payload.poll || payload.pollVote) {
    type = "poll";
  }
  
  // Pedido/Carrinho
  if (payload.order || payload.reviewAndPay) {
    type = "order";
  }
  
  // Resposta de botão
  if (payload.buttonsResponseMessage) {
    type = "text";
    text = payload.buttonsResponseMessage.message || payload.buttonsResponseMessage.buttonId;
  }
  
  // Resposta de lista
  if (payload.listResponseMessage) {
    type = "text";
    text = payload.listResponseMessage.title || payload.listResponseMessage.selectedRowId;
  }
  
  return {
    provider: "zapi",
    messageId: payload.messageId || `zapi-${Date.now()}`,
    chatId,
    phone,
    type,
    text,
    caption,
    mediaUrl,
    mimeType,
    fromMe: payload.fromMe || false,
    isGroup: payload.isGroup || rawPhone.includes("-group") || rawPhone.includes("@g.us"),
    timestamp: payload.momment || Date.now(),
    senderName: payload.senderName || payload.chatName,
    senderPhoto: payload.senderPhoto || payload.photo,
    participantPhone: payload.participantPhone?.replace(/\D/g, ""),
    instanceId: payload.instanceId,
    connectedPhone: payload.connectedPhone,
    raw: payload,
  };
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

export function normalizeWebhook(payload: any): NormalizedMessage | null {
  const provider = detectProvider(payload);
  
  if (provider === "unknown") {
    logger.warn("Could not normalize webhook - unknown provider", {
      keys: Object.keys(payload || {}).slice(0, 10),
    }, "WEBHOOK");
    return null;
  }
  
  try {
    if (provider === "waha") {
      return normalizeWaha(payload);
    }
    
    if (provider === "zapi") {
      return normalizeZapi(payload);
    }
  } catch (error) {
    logger.error("Error normalizing webhook", { provider, error }, "WEBHOOK");
    return null;
  }
  
  return null;
}

// ============================================================
// HELPERS
// ============================================================

export function isValidMessageEvent(payload: any): boolean {
  const provider = detectProvider(payload);
  
  if (provider === "waha") {
    return payload.event === "message";
  }
  
  if (provider === "zapi") {
    if (payload.type !== "ReceivedCallback") return false;
    if (payload.notification) return false; // Ignorar notificações
    if (payload.waitingMessage) return false; // Mensagem não decriptada
    
    const hasContent = !!(
      payload.text?.message ||
      payload.image ||
      payload.audio ||
      payload.video ||
      payload.document ||
      payload.sticker ||
      payload.location ||
      payload.contact ||
      payload.buttonsResponseMessage ||
      payload.listResponseMessage
    );
    
    return hasContent;
  }
  
  return false;
}

export function isFromMe(payload: any): boolean {
  const provider = detectProvider(payload);
  
  if (provider === "waha") {
    return payload.payload?.fromMe === true;
  }
  
  if (provider === "zapi") {
    return payload.fromMe === true;
  }
  
  return false;
}

export default {
  detectProvider,
  normalizeWebhook,
  isValidMessageEvent,
  isFromMe,
};