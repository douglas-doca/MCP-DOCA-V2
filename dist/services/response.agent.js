// ============================================
// MCP-DOCA-V2 - Response Agent
// Agente de Respostas Inteligentes com Detecção de Emoções
// ============================================
import { logger } from '../utils/logger.js';
import { aiService } from './ai.service.js';
import { supabaseService } from './supabase.service.js';
import { emotionService } from './emotion.service.js';
// ============================================
// CACHE DO PROMPT (recarrega a cada 5 minutos)
// ============================================
let cachedPrompt = null;
let promptLastFetch = 0;
const PROMPT_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
async function getPromptFromDB() {
    const now = Date.now();
    if (cachedPrompt && (now - promptLastFetch) < PROMPT_CACHE_TTL) {
        return cachedPrompt;
    }
    try {
        const result = await supabaseService.request('GET', 'settings', {
            query: 'key=eq.agent_prompt'
        });
        if (result && result[0]?.value) {
            cachedPrompt = result[0].value;
            promptLastFetch = now;
            logger.info('Prompt carregado do Supabase', undefined, 'AGENT');
            return cachedPrompt;
        }
    }
    catch (error) {
        logger.error('Erro ao buscar prompt do Supabase', error, 'AGENT');
    }
    return DOUGLAS_SYSTEM_PROMPT;
}
// Buscar FAQs relevantes da base de conhecimento
async function getRelevantFAQs(userMessage) {
    if (!userMessage)
        return '';
    try {
        const result = await supabaseService.request('GET', 'knowledge_base', {
            query: 'active=is.true&order=priority.desc'
        });
        if (!result || result.length === 0)
            return '';
        const msgLower = userMessage.toLowerCase();
        const relevantFaqs = result.filter((faq) => {
            if (!faq.keywords || faq.keywords.length === 0)
                return false;
            return faq.keywords.some((kw) => msgLower.includes(kw.toLowerCase()));
        }).slice(0, 3);
        if (relevantFaqs.length === 0)
            return '';
        let faqText = '\n\n---\n## 📚 BASE DE CONHECIMENTO RELEVANTE\n';
        relevantFaqs.forEach((faq) => {
            faqText += `\n**P:** ${faq.question}\n**R:** ${faq.answer}\n`;
        });
        return faqText;
    }
    catch (error) {
        logger.error('Erro ao buscar FAQs', error, 'AGENT');
        return '';
    }
}
export function reloadPrompt() {
    cachedPrompt = null;
    promptLastFetch = 0;
}
// ============================================
// SISTEMA DE DETECÇÃO DE EMOÇÕES
// ============================================
const EMOTION_PATTERNS = {
    skeptical: {
        pattern: /duvido|será|não acredito|mentira|enganação|furada|falso|golpe|spam|bot|robô/i,
        style: 'Validar preocupação, mostrar provas sociais, ser transparente',
    },
    anxious: {
        pattern: /urgente|rápido|agora|hoje|já|pressa|correndo|preciso muito|desesperado/i,
        style: 'Transmitir calma, mostrar que vai resolver, dar próximo passo claro',
    },
    frustrated: {
        pattern: /desisto|cansado|nada funciona|difícil|complicado|chato|irritado|problema|não aguento/i,
        style: 'Empatia genuína, reconhecer a dor, mostrar que entende',
    },
    excited: {
        pattern: /quero|vamos|ótimo|perfeito|maravilha|top|bora|show|incrível|massa|demais/i,
        style: 'Manter energia, acelerar processo, aproveitar momento',
    },
    price_sensitive: {
        pattern: /caro|valor|preço|quanto custa|custo|pagar|dinheiro|grana|investimento|orçamento/i,
        style: 'Focar em ROI e valor, não em preço. Não passar valores por mensagem.',
    },
    ready: {
        pattern: /agendar|marcar|quando|horário|dia|disponível|vamos fazer|fechar|contratar/i,
        style: 'Ir direto ao agendamento, não enrolar, capturar compromisso',
    },
    curious: {
        pattern: /como funciona|o que é|explica|me conta|quero saber|entender|conhecer/i,
        style: 'Explicar de forma simples, usar exemplos, despertar interesse',
    },
};
function detectEmotion(message) {
    const msg = message.toLowerCase();
    for (const [emotion, config] of Object.entries(EMOTION_PATTERNS)) {
        if (config.pattern.test(msg)) {
            return { emotion, style: config.style };
        }
    }
    return { emotion: 'neutral', style: 'Descobrir mais sobre a pessoa, fazer perguntas abertas' };
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

📸 **DOCA Studio** - Ensaios fotográficos com IA
→ Redução de 70% nos custos com foto profissional

🐙 **DOCA Multi Agentes** - Automação de WhatsApp
→ Atendimento 24/7, qualificação de leads, dashboard completo

⚡ **Automação de Processos** - IA para tarefas repetitivas
→ Equipe focada no que importa, não em burocracia

🎓 **Treinamento em IA** - Capacitação de equipes
→ Time usando IA no dia a dia com produtividade

🎬 **Vídeos com IA** - Produção automatizada de conteúdo
→ Escala na criação de vídeos

**Diferenciais:**
- Economia de tempo
- Qualificação detalhada de leads
- Dashboard completo com métricas
- Padronização de atendimento
- Atendimento 24/7
- Redução de equipe ou foco no essencial

**Redes:**
- Instagram: @docaperformance
- Site: docaperformance.com.br

---`;
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
            businessInfo: config?.businessInfo || '',
            tone: config?.tone || 'professional',
            enableSentimentAnalysis: config?.enableSentimentAnalysis ?? true,
            enableIntentDetection: config?.enableIntentDetection ?? true,
            escalationKeywords: config?.escalationKeywords || [
                'falar com humano',
                'atendente real',
                'pessoa de verdade',
            ],
        };
        logger.agent('Response Agent initialized', {
            tone: this.config.tone,
            maxContext: this.config.maxContextMessages
        });
    }
    async processMessage(phone, chatId, userMessage) {
        const timer = logger.startTimer('Response Agent - Process Message');
        try {
            // 0. Detectar emoção
            const emotionData = detectEmotion(userMessage);
            logger.agent('Emotion detected', emotionData);
            // 1. Buscar ou criar conversa
            const conversation = await supabaseService.getOrCreateConversation(phone, chatId);
            // 2. Salvar mensagem do usuário
            await supabaseService.addMessage(conversation.id, {
                role: 'user',
                content: userMessage,
                timestamp: new Date(),
            });
            // 3. Salvar evento de emoção
            try {
                const lead = await supabaseService.getLeadByPhone(phone);
                if (lead) {
                    await emotionService.saveEmotionEvent({
                        conversation_id: conversation.id,
                        lead_id: lead.id,
                        emotion: emotionData.emotion,
                        message_content: userMessage,
                        confidence: 0.8,
                        metadata: {
                            source: "response.agent",
                            model: "heuristic",
                        },
                    });
                    // Atualizar métricas do lead em background
                    emotionService.updateLeadMetrics(lead.id).catch(err => {
                        logger.error('Failed to update lead metrics', err, 'AGENT');
                    });
                }
                else {
                    // Criar lead se não existir
                    const newLead = await supabaseService.createLead({
                        phone,
                        source: 'whatsapp',
                        status: 'new'
                    });
                    await emotionService.saveEmotionEvent({
                        conversation_id: conversation.id,
                        lead_id: newLead.id,
                        emotion: emotionData.emotion,
                        message_content: userMessage,
                        confidence: 0.8,
                        metadata: {
                            source: "response.agent",
                            model: "heuristic",
                        },
                    });
                }
            }
            catch (error) {
                logger.error('Failed to save emotion', error, 'AGENT');
                // Continua mesmo se falhar
            }
            // 4. Atualizar status da conversa
            await supabaseService.updateConversationStatus(conversation.id, 'active');
            // 5. Verificar escalação
            const escalationCheck = this.checkEscalation(userMessage);
            if (escalationCheck.shouldEscalate) {
                await supabaseService.updateConversationStatus(conversation.id, 'waiting_response');
                return {
                    response: this.getEscalationResponse(escalationCheck.reason || "Escalação"),
                    shouldEscalate: true,
                    escalationReason: escalationCheck.reason,
                    emotion: emotionData.emotion,
                };
            }
            // 6. Gerar resposta com IA (passando contexto de emoção e mensagem)
            const response = await this.generateResponse(conversation, userMessage, emotionData);
            // 7. Salvar resposta
            await supabaseService.addMessage(conversation.id, {
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            });
            timer();
            return {
                response,
                shouldEscalate: false,
                emotion: emotionData.emotion,
            };
        }
        catch (error) {
            logger.error('Error processing message', error, 'AGENT');
            throw error;
        }
    }
    async generateResponse(conversation, userMessage, emotionData) {
        // Buscar mensagens recentes para contexto
        const recentMessages = await supabaseService.getRecentMessages(conversation.id, this.config.maxContextMessages);
        // Montar histórico para IA
        const aiMessages = recentMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
        }));
        // Construir system prompt com contexto de emoção e FAQs
        const systemPrompt = await this.buildSystemPrompt(conversation, emotionData, userMessage);
        // Gerar resposta
        const response = await aiService.chat(userMessage, systemPrompt, aiMessages);
        return response;
    }
    async buildSystemPrompt(conversation, emotionData, userMessage) {
        const lead = conversation.phone ? await supabaseService.getLeadByPhone(conversation.phone) : null;
        // Buscar prompt do Supabase
        let prompt = await getPromptFromDB();
        // Adicionar contexto de emoção detectada
        prompt += `\n\n---\n## 🎭 CONTEXTO ATUAL DA CONVERSA\n`;
        prompt += `**Emoção detectada:** ${emotionData.emotion.toUpperCase()}\n`;
        prompt += `**Como responder:** ${emotionData.style}\n`;
        // Adicionar info do lead se existir
        if (lead?.name) {
            prompt += `\n**Cliente:** ${lead.name}`;
        }
        // Adicionar stage e health score se existir
        if (lead?.stage) {
            prompt += `\n**Stage no Funil:** ${lead.stage}`;
        }
        if (lead?.health_score) {
            prompt += `\n**Health Score:** ${lead.health_score}/100`;
        }
        // Adicionar info adicional do negócio
        if (this.config.businessInfo) {
            prompt += `\n\nInformações adicionais:\n${this.config.businessInfo}`;
        }
        // Adicionar FAQs relevantes
        const faqContent = await getRelevantFAQs(userMessage);
        if (faqContent) {
            prompt += faqContent;
        }
        return prompt;
    }
    checkEscalation(message) {
        const lowerMessage = message.toLowerCase();
        for (const keyword of this.config.escalationKeywords) {
            if (lowerMessage.includes(keyword.toLowerCase())) {
                return {
                    shouldEscalate: true,
                    reason: `Palavra-chave detectada: "${keyword}"`,
                };
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
//# sourceMappingURL=response.agent.js.map