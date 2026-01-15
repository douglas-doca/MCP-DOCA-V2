// src/services/response.agent.ts
// ============================================
// MCP-DOCA-V2 - Response Agent
// Agente de Respostas Inteligentes com Detecção de Emoções
//
// V4 - Natural Humanizer:
// - humanizer deixa de ser "rule engine" travado
// - IA decide conteúdo e quantidade de bolhas; humanizer só formata e simula
// - NÃO inventa bolha 2
// - NÃO força pergunta
// - templates viram fallback (não sobrepõem IA)
// - terminal detection + pós-agendamento: evita puxar conversa desnecessária
// - memória de cenário via conversation.context.profile.has_scenario
// - ✅ suporte channel/ui_mode/meta (landing_chat)
// - ✅ Landing prompt + intention override
// - ✅ Multi-tenant: tenant_id nas criações
// ============================================
import { logger } from "../utils/logger.js";
import { aiService } from "./ai.service.js";
import { supabaseService } from "./supabase.service.js";
import { emotionService, detectEmotion } from "./emotion.service.js";
import { calendarOrchestrator } from "./calendar/calendar.orchestrator.js";
import { clientService } from "./client.service.js";
import { schedulerService } from "./scheduler.service.js";
// ============================================
// CACHE DO PROMPT (recarrega a cada 5 minutos)
// ============================================
let cachedPrompt = null;
let promptLastFetch = 0;
const PROMPT_CACHE_TTL = 5 * 60 * 1000; // 5 min
async function getPromptFromDB() {
    const now = Date.now();
    if (cachedPrompt && now - promptLastFetch < PROMPT_CACHE_TTL) {
        return cachedPrompt;
    }
    try {
        const result = await supabaseService.request("GET", "settings", {
            query: "key=eq.agent_prompt",
        });
        if (result && result[0]?.value) {
            cachedPrompt = typeof result[0].value === "string" ? result[0].value : String(result[0].value);
            promptLastFetch = now;
            logger.info("Prompt carregado do Supabase", undefined, "AGENT");
            return cachedPrompt;
        }
    }
    catch (error) {
        logger.error("Erro ao buscar prompt do Supabase", error, "AGENT");
    }
    return DOUGLAS_SYSTEM_PROMPT;
}
export function reloadPrompt() {
    cachedPrompt = null;
    promptLastFetch = 0;
}
// ============================================
// Buscar FAQs relevantes da base de conhecimento
// ============================================
async function getRelevantFAQs(userMessage) {
    if (!userMessage)
        return "";
    try {
        const result = await supabaseService.request("GET", "knowledge_base", {
            query: "active=is.true&order=priority.desc",
        });
        if (!result || result.length === 0)
            return "";
        const msgLower = userMessage.toLowerCase();
        const relevantFaqs = result
            .filter((faq) => {
            if (!faq.keywords || faq.keywords.length === 0)
                return false;
            return faq.keywords.some((kw) => msgLower.includes(String(kw).toLowerCase()));
        })
            .slice(0, 3);
        if (relevantFaqs.length === 0)
            return "";
        let faqText = "\n\n---\n## 📚 BASE DE CONHECIMENTO RELEVANTE\n";
        relevantFaqs.forEach((faq) => {
            faqText += `\n**P:** ${faq.question}\n**R:** ${faq.answer}\n`;
        });
        return faqText;
    }
    catch (error) {
        logger.error("Erro ao buscar FAQs", error, "AGENT");
        return "";
    }
}
const DEFAULT_HUMANIZER_CONFIG = {
    // ✅ Liberdade total - IA decide quantas bolhas
    maxBubbles: 8,
    maxSentencesPerBubble: 5,
    maxEmojiPerBubble: 3,
    bubbleCharSoftLimit: 280,
    bubbleCharHardLimit: 500,
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
        cold: { maxBubbles: 6, requireQuestion: false, ctaLevel: "soft" },
        warm: { maxBubbles: 8, requireQuestion: false, ctaLevel: "medium" },
        hot: { maxBubbles: 8, requireQuestion: false, ctaLevel: "hard" },
    },
    saveChunksToDB: false, // ✅ Desativado (reduz I/O)
    saveTypingChunks: false,
    intentModes: {
        primeiro_contato: {
            templates: [
                "Oi! 👋 Prazer, sou o Douglas da DOCA.",
                "Me conta rapidinho: você quer melhorar marketing, vendas ou operação?",
            ],
            variants: [
                ["Show! 😄", "Me conta rapidinho: hoje o seu problema é mais gerar mais leads ou deixar o atendimento redondinho?"],
                ["Opa! Douglas aqui 😄", "Hoje você tá buscando mais leads ou automatizar o atendimento/agenda?"],
                ["Boa! 👋", "Qual tá pegando mais aí hoje: trazer mais leads ou organizar o atendimento?"],
                ["Fechado 😄", "Me diz em 1 frase: sua prioridade hoje é lead ou atendimento/agenda?"],
            ],
        },
        cliente_bravo: {
            templates: ["Poxa… entendi. Sinto muito por isso 🙏", "Me diz o que aconteceu (e o número/contato) que eu resolvo agora."],
            variants: [
                ["Poxa… entendi 😕", "Me conta rapidinho o que aconteceu pra eu resolver agora."],
                ["Caramba… sinto muito por isso 🙏", "Você consegue me dizer o que deu errado pra eu corrigir já?"],
                ["Entendi 😕", "Me passa o detalhe (e se tiver print) que eu resolvo aqui contigo."],
            ],
        },
        orcamento: {
            templates: ["Consigo sim 😊 Só pra eu te passar certinho:", "é pra você ou pra equipe? E qual objetivo principal (leads, conversão ou atendimento)?"],
            variants: [
                ["Consigo sim 😊", "Só pra eu te passar certinho: é pra você ou pra equipe? E qual objetivo principal?"],
                ["Bora! 😄", "Antes de falar de valor, me diz: seu foco é mais leads, conversão ou atendimento?"],
                ["Fechado 😊", "Me conta rapidinho seu cenário e meta principal que eu te passo o melhor caminho."],
            ],
        },
    },
};
function safeJsonParse(val, fallback) {
    try {
        if (!val)
            return fallback;
        if (typeof val === "string")
            return JSON.parse(val);
        return val;
    }
    catch {
        return fallback;
    }
}
function mergeHumanizerConfig(base, incoming) {
    const inc = incoming || {};
    return {
        ...base,
        ...inc,
        delay: {
            ...base.delay,
            ...inc.delay,
        },
        stageBehavior: {
            cold: { ...base.stageBehavior.cold, ...inc.stageBehavior?.cold },
            warm: { ...base.stageBehavior.warm, ...inc.stageBehavior?.warm },
            hot: { ...base.stageBehavior.hot, ...inc.stageBehavior?.hot },
        },
        intentModes: {
            primeiro_contato: {
                templates: inc.intentModes?.primeiro_contato?.templates || base.intentModes.primeiro_contato.templates,
                variants: inc.intentModes?.primeiro_contato?.variants || base.intentModes.primeiro_contato.variants,
            },
            cliente_bravo: {
                templates: inc.intentModes?.cliente_bravo?.templates || base.intentModes.cliente_bravo.templates,
                variants: inc.intentModes?.cliente_bravo?.variants || base.intentModes.cliente_bravo.variants,
            },
            orcamento: {
                templates: inc.intentModes?.orcamento?.templates || base.intentModes.orcamento.templates,
                variants: inc.intentModes?.orcamento?.variants || base.intentModes.orcamento.variants,
            },
        },
    };
}
// cache do humanizer
let cachedHumanizer = null;
let humanizerLastFetch = 0;
const HUMANIZER_CACHE_TTL = 5 * 60 * 1000; // 5 min
export function reloadHumanizerConfig() {
    cachedHumanizer = null;
    humanizerLastFetch = 0;
    logger.info("Humanizer config cache cleared", undefined, "AGENT");
}
async function getHumanizerConfigFromDB() {
    const now = Date.now();
    if (cachedHumanizer && now - humanizerLastFetch < HUMANIZER_CACHE_TTL) {
        return cachedHumanizer;
    }
    try {
        const result = await supabaseService.request("GET", "settings", {
            query: "key=eq.agent_humanizer_config",
        });
        if (!result || !result[0]?.value) {
            cachedHumanizer = DEFAULT_HUMANIZER_CONFIG;
            humanizerLastFetch = now;
            return cachedHumanizer;
        }
        const parsed = safeJsonParse(result[0].value, {});
        const incoming = parsed?.humanizer || {};
        cachedHumanizer = mergeHumanizerConfig(DEFAULT_HUMANIZER_CONFIG, incoming);
        humanizerLastFetch = now;
        logger.info("Humanizer config carregado do Supabase", undefined, "AGENT");
        return cachedHumanizer;
    }
    catch (error) {
        logger.error("Erro ao buscar humanizer config do Supabase", error, "AGENT");
        cachedHumanizer = DEFAULT_HUMANIZER_CONFIG;
        humanizerLastFetch = now;
        return cachedHumanizer;
    }
}
// ============================================
// ✅ Anti-repetição helpers
// ============================================
function normalizeText(t) {
    return String(t || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}
function isTerminalMessage(text) {
    const t = normalizeText(text);
    const patterns = [
        /confirmad[oa]/i,
        /agendad[oa]/i,
        /marquei/i,
        /convite enviado/i,
        /nos vemos/i,
        /até (já|logo)/i,
        /segue (o|a)/i,
        /aqui est(á|a)/i,
        /\blink\b/i,
        /google meet/i,
        /meet:/i,
        /zoom/i,
        /calendar/i,
        /evento criado/i,
    ];
    return patterns.some((p) => p.test(t));
}
function textHasQuestion(text) {
    const t = String(text || "").trim();
    if (!t)
        return false;
    if (t.includes("?"))
        return true;
    return /(me diz|me fala|você quer|qual|quando|onde|como|quanto|topa|bora)/i.test(t);
}
function safeGetConversationContext(conversation) {
    const ctx = conversation?.context;
    if (!ctx)
        return {};
    if (typeof ctx === "string") {
        try {
            return JSON.parse(ctx);
        }
        catch {
            return {};
        }
    }
    if (typeof ctx === "object")
        return ctx;
    return {};
}
async function safeUpdateConversationContext(conversationId, nextContext) {
    const fn = supabaseService?.updateConversationContext;
    if (typeof fn === "function") {
        await fn(conversationId, nextContext);
        return;
    }
    try {
        await supabaseService.request("PATCH", "conversations", {
            query: `id=eq.${conversationId}`,
            body: { context: nextContext },
        });
    }
    catch {
        // não quebra o fluxo
    }
}
// ============================================
// DETECÇÃO DE EMOÇÕES - Importado de emotion.service.ts
// ============================================
// ============================================
// DETECÇÃO DE INTENÇÃO (HEURÍSTICA)
// ============================================
const INTENTION_PATTERNS = {
    primeiro_contato: /oi|olá|e aí|bom dia|boa tarde|boa noite|tudo bem|quem é|prazer|primeira vez|conheci|vim do/i,
    cliente_bravo: /reclama|insatisfeito|péssimo|horrível|não gostei|não funciona|problema|quero cancelar|raiva|irritado|enganado|golpe|suporte/i,
    orcamento: /preço|valor|quanto custa|orçamento|plano|investimento|mensalidade|quanto fica|cotação/i,
    agendamento: /agendar|marcar|reunião|call|quando|horário|dia|agenda|disponível/i,
    curiosidade: /como funciona|o que é|explica|me conta|quero saber|entender|conhecer/i,
    outros: /.^/,
};
export function detectIntention(message, emotion) {
    const msg = (message || "").toLowerCase();
    if ((emotion === "frustrated" || emotion === "skeptical") && INTENTION_PATTERNS.cliente_bravo.test(msg)) {
        return "cliente_bravo";
    }
    if (INTENTION_PATTERNS.orcamento.test(msg))
        return "orcamento";
    if (INTENTION_PATTERNS.agendamento.test(msg))
        return "agendamento";
    if (INTENTION_PATTERNS.curiosidade.test(msg))
        return "curiosidade";
    if (INTENTION_PATTERNS.primeiro_contato.test(msg))
        return "primeiro_contato";
    if (INTENTION_PATTERNS.cliente_bravo.test(msg))
        return "cliente_bravo";
    return "outros";
}
// ============================================
// ✅ LANDING OVERRIDES
// ============================================
function overrideIntentionForLanding(message, current) {
    const m = normalizeText(message);
    if (/(agendar|marcar|reuni(ã|a)o|call|hor(a|á)rio|agenda|dispon(í|i)vel)/i.test(m))
        return "agendamento";
    if (/(pre(ç|c)o|valor|quanto custa|or(ç|c)amento|plano|investimento)/i.test(m))
        return "orcamento";
    if (/(quero saber mais|como funciona|o que (é|e)|me explica|agente de ia|ia|intelig(ê|e)ncia artificial)/i.test(m))
        return "curiosidade";
    if (/(^oi$|^ol(a|á)$|bom dia|boa tarde|boa noite|tudo bem)/i.test(m))
        return "primeiro_contato";
    return current;
}
function buildLandingSystemPrompt(basePrompt, meta) {
    const utmSource = meta?.utm_source ? String(meta.utm_source) : null;
    const utmCampaign = meta?.utm_campaign ? String(meta.utm_campaign) : null;
    const adName = meta?.ad_name ? String(meta.ad_name) : null;
    let prompt = basePrompt;
    prompt += `\n\n---\n## ✅ CONTEXTO (LANDING PAGE)\n`;
    prompt += `Você está falando com um lead que veio de uma Landing Page sobre **Agente de IA para WhatsApp**.\n`;
    prompt += `Objetivo: qualificar rápido e levar para demo (30min).\n`;
    prompt += `Produto: Agente de IA que atende, qualifica, agenda, e organiza tudo no cockpit (funil/temperatura/seguimento).\n`;
    if (utmSource || utmCampaign || adName) {
        prompt += `\n\n**Origem do lead (meta):**\n`;
        if (utmSource)
            prompt += `- utm_source: ${utmSource}\n`;
        if (utmCampaign)
            prompt += `- utm_campaign: ${utmCampaign}\n`;
        if (adName)
            prompt += `- ad_name: ${adName}\n`;
    }
    prompt += `\n\n**Regras específicas (Landing):**\n`;
    prompt += `- Seja MUITO direto e objetivo\n`;
    prompt += `- Foque no Agente de IA para WhatsApp: atendimento, qualificação, agendamento e cockpit\n`;
    prompt += `- Sempre puxe para 1 de 2 caminhos: (1) Leads/Vendas ou (2) Atendimento/Suporte\n`;
    prompt += `- Emojis com moderação (não force)\n`;
    prompt += `- Não invente perguntas: só pergunte se fizer sentido\n`;
    return prompt;
}
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function normalizeWhitespace(text) {
    return String(text || "")
        .replace(/\r/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}
function splitIntoSentences(text) {
    const t = normalizeWhitespace(text);
    if (!t)
        return [];
    const parts = t
        .split(/(?<=[.!?])\s+/)
        .map((p) => p.trim())
        .filter(Boolean);
    return parts.length ? parts : [t];
}
function stripTooManyEmojis(text, maxEmojis = 3) {
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const matches = text.match(emojiRegex) || [];
    if (matches.length <= maxEmojis)
        return text;
    let removeCount = matches.length - maxEmojis;
    return text
        .replace(emojiRegex, (m) => {
        if (removeCount <= 0)
            return m;
        removeCount--;
        return "";
    })
        .replace(/\s{2,}/g, " ")
        .trim();
}
function normalizeStage(stage) {
    const s = String(stage || "").toLowerCase();
    if (s.includes("cold"))
        return "cold";
    if (s.includes("warm"))
        return "warm";
    if (s.includes("hot"))
        return "hot";
    return "unknown";
}
function emotionDelayMultiplier(emotion, cfg) {
    const e = String(emotion || "").toLowerCase();
    if (e === "anxious")
        return cfg?.anxiousMultiplier ?? 0.65;
    if (e === "skeptical")
        return cfg?.skepticalMultiplier ?? 1.15;
    if (e === "frustrated")
        return cfg?.frustratedMultiplier ?? 1.0;
    if (e === "excited")
        return cfg?.excitedMultiplier ?? 0.9;
    return 1.0;
}
function calcDelayMs(text, cfg, multiplier = 1.0) {
    const t = (text || "").trim();
    if (!t)
        return Math.round(cfg.base * multiplier);
    const raw = cfg.base + t.length * cfg.perChar;
    const clamped = clamp(raw, cfg.base, cfg.cap);
    return Math.round(clamped * multiplier);
}
// ✅ RANDOM helpers
function pickRandom(arr, fallback) {
    if (!Array.isArray(arr) || arr.length === 0)
        return fallback;
    return arr[Math.floor(Math.random() * arr.length)];
}
function pickIntentVariant(hz, key) {
    const mode = hz.intentModes?.[key];
    const fallback = mode?.templates || ["Oi! 👋", "Me conta rapidinho: qual sua meta principal hoje?"];
    const variants = Array.isArray(mode?.variants) ? mode?.variants : [];
    const picked = pickRandom(variants, fallback);
    const b1 = String(picked?.[0] || fallback[0]).trim();
    const b2 = String(picked?.[1] || fallback[1]).trim();
    return [b1 || fallback[0], b2 || fallback[1]];
}
function pickModeV2(intention, emotion, stage) {
    const st = normalizeStage(stage);
    const e = String(emotion || "").toLowerCase();
    // mantém compatibilidade mas agora são "tendências", não regras duras
    if (intention === "primeiro_contato")
        return "FIRST_CONTACT";
    if (intention === "cliente_bravo")
        return "BRAVO";
    if (intention === "orcamento")
        return "BUDGET";
    if (st === "hot")
        return "HOT_CTA";
    if (e === "skeptical")
        return "SKEPTICAL";
    if (e === "anxious" || intention === "agendamento")
        return "SINGLE";
    return "TWO_BUBBLES";
}
/**
 * ✅ HUMANIZER NATURAL
 * - Se IA separou em parágrafos, respeita como bolhas
 * - Se veio tudo junto, quebra em chunks suaves por sentenças/tamanho
 * - NÃO inventa conteúdo
 * - Templates só entram como fallback quando IA veio curta/ruim
 */
function buildBubblesFromAITextNatural(aiText, hz, opts) {
    const cleaned = normalizeWhitespace(aiText);
    if (!cleaned) {
        const fb = opts?.fallbackTemplates;
        if (opts?.allowFallbackTemplates && fb)
            return [fb[0], fb[1]].filter(Boolean);
        return ["Perfeito. 😊"];
    }
    // respeita parágrafos
    const paragraphs = cleaned
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
    let raw = [];
    if (paragraphs.length >= 2) {
        raw = paragraphs;
    }
    else {
        // quebra por sentenças e limite suave
        const sentences = splitIntoSentences(cleaned);
        let current = "";
        for (const s of sentences) {
            const next = (current ? current + " " : "") + s;
            if (next.length > hz.bubbleCharSoftLimit && current) {
                raw.push(current.trim());
                current = s;
            }
            else {
                current = next;
            }
            // hard stop por segurança
            if (current.length > hz.bubbleCharHardLimit) {
                raw.push(current.trim());
                current = "";
            }
        }
        if (current.trim())
            raw.push(current.trim());
    }
    raw = raw.map((b) => stripTooManyEmojis(b, hz.maxEmojiPerBubble)).filter(Boolean);
    if (raw.length > hz.maxBubbles)
        raw = raw.slice(0, hz.maxBubbles);
    return raw;
}
function enforceBubbleRulesSoft(bubbles, hz, maxBubblesOverride) {
    let b = (bubbles || []).map(normalizeWhitespace).filter(Boolean);
    const cap = typeof maxBubblesOverride === "number" ? maxBubblesOverride : hz.maxBubbles;
    if (b.length > cap)
        b = b.slice(0, cap);
    b = b.map((bubble) => {
        // só encurta se explodiu (soft)
        const sentences = splitIntoSentences(bubble);
        if (sentences.length <= hz.maxSentencesPerBubble)
            return bubble;
        return stripTooManyEmojis(sentences.slice(0, hz.maxSentencesPerBubble).join(" "), hz.maxEmojiPerBubble);
    });
    return b;
}
/**
 * Tweaks agora são bem leves:
 * - não força pergunta
 * - só adiciona uma frase de transparência em skeptical
 */
function applyEmotionTweaksSoft(bubbles, emotion) {
    const e = String(emotion || "").toLowerCase();
    const b = [...bubbles];
    if (!b.length)
        return b;
    if (e === "skeptical") {
        // adiciona transparência só na primeira bolha
        if (b[0] && !/sem promessas|sem milagre/i.test(b[0])) {
            b[0] = `${b[0]}\n\nSem promessas mágicas — eu te mostro exemplo real primeiro.`;
        }
    }
    return b;
}
function buildMessagePlanV2(bubbles, meta, delayCfg, delayMultiplier) {
    const items = [];
    for (let i = 0; i < bubbles.length; i++) {
        const text = bubbles[i];
        const delayMs = calcDelayMs(text, delayCfg, delayMultiplier);
        // typing start
        items.push({ type: "typing", action: "start", delayMs: i === 0 ? 0 : 200 });
        // text
        items.push({ type: "text", text, delayMs });
        // typing stop
        items.push({ type: "typing", action: "stop", delayMs: 0 });
    }
    return { items, bubbles, meta };
}
// ============================================
// PROMPT PRINCIPAL DO AGENTE DOUGLAS (FALLBACK)
// ============================================
const DOUGLAS_SYSTEM_PROMPT = `## 🎯 IDENTIDADE

Você É Douglas, fundador da DOCA Agência IA. Não diga que é um assistente, bot ou IA - você é o Douglas conversando pelo WhatsApp.

**Personalidade:**
- Amigável mas profissional
- Linguagem jovem sem ser forçado
- Direto ao ponto, sem enrolação
- Empático e atento às emoções
- Usa emojis com moderação (1-2 por mensagem, não em toda mensagem)

**Tom de voz:**
- "E aí, tudo bem?" ao invés de "Olá, como vai?"
- "Show!" ao invés de "Excelente!"
- "Bora marcar?" ao invés de "Podemos agendar?"
- Sem formalidade excessiva, mas sem gírias demais

---

## 🏢 SOBRE A DOCA

A DOCA Agência IA transforma negócios com inteligência artificial prática.

**Serviços:**
🐙 **DOCA Multi Agentes** - Automação de WhatsApp
⚡ **Automação de Processos** - IA para tarefas repetitivas
🎓 **Treinamento em IA** - Capacitação de equipes

**Redes:**
- Instagram: @docaperformance
- Site: docaperformance.com.br
`;
// ============================================
// RESPONSE AGENT CLASS
// ============================================
export class ResponseAgent {
    config;
    constructor(config) {
        this.config = {
            maxContextMessages: config?.maxContextMessages || 10,
            responseDelayMs: config?.responseDelayMs || 1000,
            systemPrompt: config?.systemPrompt || DOUGLAS_SYSTEM_PROMPT,
            businessInfo: config?.businessInfo || "",
            tone: config?.tone || "professional",
            enableSentimentAnalysis: config?.enableSentimentAnalysis ?? true,
            enableIntentDetection: config?.enableIntentDetection ?? true,
            escalationKeywords: config?.escalationKeywords || ["falar com humano", "atendente real", "pessoa de verdade"],
            humanizer: mergeHumanizerConfig(DEFAULT_HUMANIZER_CONFIG, config?.humanizer || {}),
        };
        logger.agent("Response Agent initialized", {
            tone: this.config.tone,
            maxContext: this.config.maxContextMessages,
        });
    }
    async processMessage(phone, chatId, userMessage, opts) {
        const timer = logger.startTimer("Response Agent - Process Message");
        const channel = String(opts?.channel || "").trim() || "whatsapp";
        const uiMode = String(opts?.ui_mode || "").trim() || "real";
        const entryMeta = opts?.meta && typeof opts.meta === "object" ? opts.meta : {};
        const clientId = opts?.clientId || clientService.detectClient(phone) || undefined;
        // ✅ MULTI-TENANT: Buscar tenant_id pelo slug do cliente
        let tenantId = undefined;
        if (clientId) {
            const clientConfig = clientService.getClientConfig(clientId);
            logger.agent("Client detected", { clientId, clientName: clientConfig?.nome_exibicao });
            // ✅ Buscar tenant_id no Supabase
            const fetchedTenantId = await supabaseService.getTenantIdBySlug(clientId);
            if (fetchedTenantId) {
                tenantId = fetchedTenantId;
                logger.agent("Tenant ID resolved", { clientId, tenantId });
            }
        }
        try {
            // ✅ Carrega humanizer config do Supabase (cache TTL)
            try {
                const remoteHumanizer = await getHumanizerConfigFromDB();
                this.config.humanizer = remoteHumanizer;
            }
            catch {
                // fallback silencioso
            }
            // 0) emoção
            const emotionData = detectEmotion(userMessage);
            logger.agent("Emotion detected", emotionData);
            // 0.1) intenção
            let intention = this.config.enableIntentDetection
                ? detectIntention(userMessage, emotionData.emotion)
                : "outros";
            // ✅ Landing override
            if (channel === "landing_chat") {
                intention = overrideIntentionForLanding(userMessage, intention);
            }
            logger.agent("Intention detected", { intention, channel });
            // 1) conversa - ✅ PASSA tenantId
            const conversation = await supabaseService.getOrCreateConversation(phone, chatId, tenantId);
            // 1.1) contexto (memória)
            const context = safeGetConversationContext(conversation);
            context.profile = context.profile || {};
            context.calendar = context.calendar || {};
            // memória de cenário (bem simples e útil)
            if (!context.profile.has_scenario) {
                const msg = normalizeText(userMessage);
                const looksLikeScenario = msg.length >= 18 &&
                    !/(^oi$|^ol(a|á)$|bom dia|boa tarde|boa noite|tudo bem|quero saber mais|como funciona|pre(ç|c)o|valor|quanto custa)/i.test(msg);
                if (looksLikeScenario)
                    context.profile.has_scenario = true;
            }
            // 2) salva msg usuário
            await supabaseService.addMessage(conversation.id, {
                role: "user",
                content: userMessage,
                timestamp: new Date(),
                metadata: {
                    emotion: emotionData.emotion,
                    intention,
                    channel,
                    ui_mode: uiMode,
                    ...(entryMeta || {}),
                },
            });
            // salva contexto
            try {
                await safeUpdateConversationContext(conversation.id, context);
            }
            catch {
                // ignore
            }
            // 3) evento emoção + métricas
            try {
                const lead = await supabaseService.getLeadByPhone(phone);
                if (lead) {
                    await emotionService.saveEmotionEvent({
                        conversation_id: conversation.id,
                        lead_id: lead.id,
                        emotion: emotionData.emotion,
                        message_content: userMessage,
                        confidence: 0.8,
                        metadata: { source: "response.agent", model: "heuristic", channel },
                    });
                    emotionService.updateLeadMetrics(lead.id).catch((err) => {
                        logger.error("Failed to update lead metrics", err, "AGENT");
                    });
                }
                else {
                    // ✅ MULTI-TENANT: Passa tenant_id ao criar lead
                    const newLead = await supabaseService.createLead({
                        phone,
                        source: channel === "landing_chat" ? "landing" : "whatsapp",
                        status: "new",
                        tenant_id: tenantId,
                    });
                    if (newLead) {
                        await emotionService.saveEmotionEvent({
                            conversation_id: conversation.id,
                            lead_id: newLead.id,
                            emotion: emotionData.emotion,
                            message_content: userMessage,
                            confidence: 0.8,
                            metadata: { source: "response.agent", model: "heuristic", channel },
                        });
                    }
                }
            }
            catch (error) {
                logger.error("Failed to save emotion", error, "AGENT");
            }
            // 4) status conversa
            await supabaseService.updateConversationStatus(conversation.id, "active");
            // stage (antes da resposta)
            const lead = conversation.phone ? await supabaseService.getLeadByPhone(conversation.phone) : null;
            const stage = lead?.stage || "unknown";
            // 5) escalação
            const escalationCheck = this.checkEscalation(userMessage);
            if (escalationCheck.shouldEscalate) {
                await supabaseService.updateConversationStatus(conversation.id, "waiting_response");
                const escalationText = this.getEscalationResponse(escalationCheck.reason || "Escalação");
                const escalationPlan = this.createResponsePlan({
                    aiText: escalationText,
                    intention,
                    emotion: emotionData.emotion,
                    stage,
                    context,
                });
                timer();
                return {
                    response: escalationText,
                    responsePlan: escalationPlan,
                    shouldEscalate: true,
                    escalationReason: escalationCheck.reason,
                    emotion: emotionData.emotion,
                    intention,
                    stage,
                    channel,
                };
            }
            // ✅ 5.5) Calendar Orchestrator (agenda / scheduling)
            try {
                logger.info("CalendarOrchestrator check", { phone, stage, intention, userMessage, channel }, "AGENT");
                const cal = await calendarOrchestrator.handle({
                    phone,
                    chatId,
                    userText: userMessage,
                    stage,
                    intention,
                    leadEmail: lead?.email,
                    leadName: lead?.name || lead?.full_name,
                });
                if (cal.handled && cal.reply) {
                    const responseText = cal.reply;
                    // pós-agendamento: flag por 1 turno
                    context.calendar.just_scheduled = true;
                    await safeUpdateConversationContext(conversation.id, context);
                    const responsePlan = this.createResponsePlan({
                        aiText: responseText,
                        intention,
                        emotion: emotionData.emotion,
                        stage,
                        context,
                    });
                    const savedAssistantMessage = await supabaseService.addMessage(conversation.id, {
                        role: "assistant",
                        content: responseText,
                        timestamp: new Date(),
                        metadata: {
                            emotion: emotionData.emotion,
                            intention,
                            stage,
                            plan_mode: responsePlan.meta.mode,
                            bubbles_count: responsePlan.bubbles.length,
                            calendar: true,
                            channel,
                            ui_mode: uiMode,
                            ...(entryMeta || {}),
                        },
                    });
                    if (this.config.humanizer.saveChunksToDB && savedAssistantMessage?.id && responsePlan?.items?.length) {
                        try {
                            const messageId = savedAssistantMessage.id;
                            const rows = responsePlan.items
                                .filter((item) => {
                                if (item.type === "typing")
                                    return !!this.config.humanizer.saveTypingChunks;
                                return true;
                            })
                                .map((item, idx) => {
                                if (item.type === "typing") {
                                    return {
                                        conversation_id: conversation.id,
                                        message_id: messageId,
                                        chunk_index: idx,
                                        kind: "typing",
                                        action: item.action,
                                        content: null,
                                        delay_ms: item.delayMs,
                                        emotion: responsePlan.meta.emotion,
                                        intention: responsePlan.meta.intention,
                                        stage: responsePlan.meta.stage,
                                        mode: responsePlan.meta.mode,
                                        created_at: new Date().toISOString(),
                                    };
                                }
                                return {
                                    conversation_id: conversation.id,
                                    message_id: messageId,
                                    chunk_index: idx,
                                    kind: "text",
                                    action: null,
                                    content: item.text,
                                    delay_ms: item.delayMs,
                                    emotion: responsePlan.meta.emotion,
                                    intention: responsePlan.meta.intention,
                                    stage: responsePlan.meta.stage,
                                    mode: responsePlan.meta.mode,
                                    created_at: new Date().toISOString(),
                                };
                            });
                            await supabaseService.request("POST", "message_chunks", { body: rows });
                        }
                        catch (err) {
                            logger.error("Failed to save message chunks (calendar)", err, "AGENT");
                        }
                    }
                    timer();
                    return {
                        response: responseText,
                        responsePlan,
                        shouldEscalate: false,
                        emotion: emotionData.emotion,
                        intention,
                        stage,
                        calendar: true,
                        channel,
                    };
                }
            }
            catch (err) {
                logger.error("Calendar orchestrator failed (ignored)", err, "AGENT");
            }
            // 6) resposta IA
            const responseText = await this.generateResponse(conversation, userMessage, emotionData, {
                channel,
                meta: entryMeta,
                clientId,
            });
            // 6.1) plano humanizado
            const responsePlan = this.createResponsePlan({
                aiText: responseText,
                intention,
                emotion: emotionData.emotion,
                stage,
                context,
            });
            logger.agent("Response plan created", {
                bubbles: responsePlan?.bubbles?.length,
                items: responsePlan?.items?.length,
                meta: responsePlan?.meta,
            });
            // 7) salva resposta principal
            const savedAssistantMessage = await supabaseService.addMessage(conversation.id, {
                role: "assistant",
                content: responseText,
                timestamp: new Date(),
                metadata: {
                    emotion: emotionData.emotion,
                    intention,
                    stage,
                    plan_mode: responsePlan.meta.mode,
                    bubbles_count: responsePlan.bubbles.length,
                    channel,
                    ui_mode: uiMode,
                    ...(entryMeta || {}),
                },
            });
            // 7.1) salva chunks no DB (replay)
            if (this.config.humanizer.saveChunksToDB && savedAssistantMessage?.id && responsePlan?.items?.length) {
                try {
                    const messageId = savedAssistantMessage.id;
                    const rows = responsePlan.items
                        .filter((item) => {
                        if (item.type === "typing")
                            return !!this.config.humanizer.saveTypingChunks;
                        return true;
                    })
                        .map((item, idx) => {
                        if (item.type === "typing") {
                            return {
                                conversation_id: conversation.id,
                                message_id: messageId,
                                chunk_index: idx,
                                kind: "typing",
                                action: item.action,
                                content: null,
                                delay_ms: item.delayMs,
                                emotion: responsePlan.meta.emotion,
                                intention: responsePlan.meta.intention,
                                stage: responsePlan.meta.stage,
                                mode: responsePlan.meta.mode,
                                created_at: new Date().toISOString(),
                            };
                        }
                        return {
                            conversation_id: conversation.id,
                            message_id: messageId,
                            chunk_index: idx,
                            kind: "text",
                            action: null,
                            content: item.text,
                            delay_ms: item.delayMs,
                            emotion: responsePlan.meta.emotion,
                            intention: responsePlan.meta.intention,
                            stage: responsePlan.meta.stage,
                            mode: responsePlan.meta.mode,
                            created_at: new Date().toISOString(),
                        };
                    });
                    await supabaseService.request("POST", "message_chunks", { body: rows });
                }
                catch (err) {
                    logger.error("Failed to save message chunks", err, "AGENT");
                }
            }
            else if (this.config.humanizer.saveChunksToDB && !savedAssistantMessage?.id) {
                logger.error("Assistant message ID missing; cannot link chunks", undefined, "AGENT");
            }
            // limpa flag just_scheduled (1 turno)
            try {
                if (context?.calendar?.just_scheduled) {
                    context.calendar.just_scheduled = false;
                    await safeUpdateConversationContext(conversation.id, context);
                }
            }
            catch {
                // ignore
            }
            timer();
            return {
                response: responseText,
                responsePlan,
                shouldEscalate: false,
                emotion: emotionData.emotion,
                intention,
                stage,
                channel,
            };
        }
        catch (error) {
            logger.error("Error processing message", error, "AGENT");
            throw error;
        }
    }
    async generateResponse(conversation, userMessage, emotionData, opts) {
        const recentMessages = await supabaseService.getRecentMessages(conversation.id, this.config.maxContextMessages);
        const aiMessages = (recentMessages || []).map((msg) => ({
            role: msg.role,
            content: msg.content,
        }));
        const systemPrompt = await this.buildSystemPrompt(conversation, emotionData, userMessage, opts);
        const response = await aiService.chat(userMessage, systemPrompt, aiMessages);
        return normalizeWhitespace(response);
    }
    async buildSystemPrompt(conversation, emotionData, userMessage, opts) {
        const lead = conversation.phone ? await supabaseService.getLeadByPhone(conversation.phone) : null;
        // ✅ Prioridade: prompt do cliente > prompt do DB > fallback
        let prompt;
        if (opts?.clientId) {
            const clientPrompt = clientService.buildSystemPrompt(opts.clientId);
            if (clientPrompt) {
                prompt = clientPrompt;
                logger.agent("Using client prompt", { clientId: opts.clientId });
            }
            else {
                prompt = await getPromptFromDB();
            }
        }
        else {
            prompt = await getPromptFromDB();
        }
        if (String(opts?.channel || "") === "landing_chat") {
            prompt = buildLandingSystemPrompt(prompt, opts?.meta);
        }
        // ✅ SCHEDULER: Buscar horários se cliente tem tool de agendamento
        if (opts?.clientId && schedulerService.hasSchedulerTool(opts.clientId)) {
            const schedulingIntent = schedulerService.detectSchedulingIntent(userMessage);
            if (schedulingIntent.isScheduling && schedulingIntent.wantsToKnowHorarios) {
                const dataConsulta = schedulingIntent.data || 'hoje';
                logger.info("Scheduler intent detected", {
                    clientId: opts.clientId,
                    data: dataConsulta
                }, "SCHEDULER");
                try {
                    const horariosResult = await schedulerService.consultarHorarios(opts.clientId, dataConsulta);
                    if (horariosResult.success && horariosResult.horarios) {
                        prompt += schedulerService.formatHorariosParaPrompt(horariosResult.horarios, dataConsulta);
                        logger.info("Horários injetados no prompt", {
                            total: horariosResult.horarios.length
                        }, "SCHEDULER");
                    }
                }
                catch (err) {
                    logger.error("Erro ao buscar horários", err, "SCHEDULER");
                }
            }
        }
        prompt += `\n\n---\n## 🎭 CONTEXTO ATUAL DA CONVERSA\n`;
        prompt += `**Emoção detectada:** ${String(emotionData.emotion).toUpperCase()}\n`;
        prompt += `**Como responder:** ${emotionData.style}\n`;
        if (lead?.name)
            prompt += `\n**Cliente:** ${lead.name}`;
        if (lead?.stage)
            prompt += `\n**Stage no Funil:** ${lead.stage}`;
        if (lead?.health_score)
            prompt += `\n**Health Score:** ${lead.health_score}/100`;
        prompt += `\n\n---\n## ✅ REGRAS DE RESPOSTA (WHATSAPP)\n`;
        prompt += `- Responda curto e humano\n`;
        prompt += `- Evite textão\n`;
        prompt += `- Não force perguntas; só pergunte se fizer sentido\n`;
        prompt += `- Emojis podem aparecer quando ficar natural (não force)\n`;
        prompt += `- Não passe preços por mensagem. Peça contexto e ofereça call rápida\n`;
        prompt += `- Se a pessoa estiver brava: valide e resolva sem justificar demais\n`;
        if (this.config.businessInfo) {
            prompt += `\n\nInformações adicionais:\n${this.config.businessInfo}`;
        }
        const faqContent = await getRelevantFAQs(userMessage);
        if (faqContent)
            prompt += faqContent;
        return prompt;
    }
    /**
     * ✅ createResponsePlan (NATURAL)
     * - NÃO força pergunta
     * - NÃO força 2 bolhas
     * - Templates só como fallback se IA veio curta/ruim
     */
    createResponsePlan(params) {
        const { aiText, intention, emotion, stage } = params;
        const ctx = params.context || {};
        const hz = mergeHumanizerConfig(DEFAULT_HUMANIZER_CONFIG, this.config.humanizer || {});
        const mode = pickModeV2(intention, emotion, stage);
        const terminal = isTerminalMessage(aiText);
        const justScheduled = !!ctx?.calendar?.just_scheduled;
        // quando terminal ou acabou de agendar: não mexe em nada, só formata
        const avoidTweaks = terminal || justScheduled;
        // stage caps
        const st = normalizeStage(stage);
        const stageCfg = hz.stageBehavior?.[st] || null;
        const maxBubbles = stageCfg?.maxBubbles ?? hz.maxBubbles;
        // templates como fallback SOMENTE se IA veio fraca
        let fallbackTemplates = null;
        if (mode === "FIRST_CONTACT")
            fallbackTemplates = pickIntentVariant(hz, "primeiro_contato");
        if (mode === "BRAVO")
            fallbackTemplates = pickIntentVariant(hz, "cliente_bravo");
        if (mode === "BUDGET")
            fallbackTemplates = pickIntentVariant(hz, "orcamento");
        const allowFallbackTemplates = !!fallbackTemplates && normalizeWhitespace(aiText).length < 40 && !avoidTweaks;
        let bubbles = buildBubblesFromAITextNatural(aiText, hz, {
            allowFallbackTemplates,
            fallbackTemplates,
        });
        // tweaks leves (só se não terminal)
        if (!avoidTweaks) {
            bubbles = applyEmotionTweaksSoft(bubbles, emotion);
        }
        // enforce soft
        bubbles = enforceBubbleRulesSoft(bubbles, hz, maxBubbles);
        const multiplier = emotionDelayMultiplier(emotion, hz.delay);
        return buildMessagePlanV2(bubbles, { intention, emotion, stage, mode }, hz.delay, multiplier);
    }
    checkEscalation(message) {
        const lower = (message || "").toLowerCase();
        for (const keyword of this.config.escalationKeywords || []) {
            if (lower.includes(String(keyword).toLowerCase())) {
                return { shouldEscalate: true, reason: `Palavra-chave detectada: "${keyword}"` };
            }
        }
        return { shouldEscalate: false };
    }
    getEscalationResponse(_reason) {
        return `Entendi! Vou te passar pro atendimento direto. Um momento que já te chamo. 👋`;
    }
    setSystemPrompt(prompt) {
        this.config.systemPrompt = prompt;
    }
    setBusinessInfo(info) {
        this.config.businessInfo = info;
    }
}
export const responseAgent = new ResponseAgent({});
