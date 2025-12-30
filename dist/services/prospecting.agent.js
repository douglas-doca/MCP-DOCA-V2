// ============================================
// MCP-DOCA-V2 - Prospecting Agent
// Agente de Prospecção e Follow-up
// ============================================
import { logger } from '../utils/logger.js';
import { wahaService } from './waha.service.js';
import { aiService } from './ai.service.js';
import { supabaseService } from './supabase.service.js';
export class ProspectingAgent {
    config;
    sequences;
    dailyMessageCount = 0;
    lastResetDate = '';
    constructor(config) {
        this.config = {
            enabled: config?.enabled ?? (process.env.PROSPECTING_ENABLED === 'true'),
            maxDailyMessages: config?.maxDailyMessages || parseInt(process.env.PROSPECTING_MAX_DAILY || '100'),
            businessHoursStart: config?.businessHoursStart || parseInt(process.env.BUSINESS_HOURS_START || '9'),
            businessHoursEnd: config?.businessHoursEnd || parseInt(process.env.BUSINESS_HOURS_END || '18'),
            timezone: config?.timezone || process.env.TZ || 'America/Sao_Paulo',
            antiGhosting: config?.antiGhosting || {
                enabled: true,
                checkIntervalHours: 1,
                maxAttempts: 3,
                intervals: [24, 48, 72],
                messages: [
                    'Oi! 👋 Vi que não conseguimos continuar nossa conversa. Posso te ajudar em algo?',
                    'Olá! Passando para ver se ainda posso te ajudar com alguma dúvida. 😊',
                    'Oi! Última tentativa de contato. Se precisar de algo, estou por aqui! 🙏',
                ],
            },
        };
        this.sequences = new Map();
        this.loadDefaultSequences();
        logger.agent('Prospecting Agent initialized', {
            enabled: this.config.enabled,
            maxDaily: this.config.maxDailyMessages,
            businessHours: `${this.config.businessHoursStart}h-${this.config.businessHoursEnd}h`,
        });
    }
    // ============ Sequence Management ============
    loadDefaultSequences() {
        // Sequência de Boas-vindas
        this.registerSequence({
            id: 'welcome',
            name: 'Sequência de Boas-vindas',
            description: 'Para novos leads que entraram em contato',
            steps: [
                {
                    order: 1,
                    delayHours: 0,
                    type: 'message',
                    template: 'Olá! 👋 Obrigado por entrar em contato com a DOCA Agência IA!\n\nSomos especialistas em automação com IA para WhatsApp e redes sociais.\n\nComo posso te ajudar hoje?',
                },
                {
                    order: 2,
                    delayHours: 24,
                    type: 'ai_generated',
                    aiPrompt: 'Gere uma mensagem de follow-up amigável perguntando se o lead ainda tem interesse, mencionando que oferecemos uma demonstração gratuita.',
                    condition: { type: 'no_response' },
                },
            ],
        });
        // Sequência de Reengajamento
        this.registerSequence({
            id: 'reengagement',
            name: 'Sequência de Reengajamento',
            description: 'Para leads que ficaram inativos',
            steps: [
                {
                    order: 1,
                    delayHours: 0,
                    type: 'message',
                    template: 'Oi! 👋 Faz um tempo que não conversamos.\n\nTivemos algumas novidades que podem te interessar! Quer saber mais?',
                },
                {
                    order: 2,
                    delayHours: 48,
                    type: 'message',
                    template: 'Só passando para lembrar que estamos à disposição!\n\nTemos uma oferta especial para quem quer começar a automatizar o atendimento. 🚀',
                    condition: { type: 'no_response' },
                },
                {
                    order: 3,
                    delayHours: 72,
                    type: 'message',
                    template: 'Última mensagem! 😊\n\nSe mudar de ideia ou tiver alguma dúvida, pode me chamar a qualquer momento.\n\nAté mais! 👋',
                    condition: { type: 'no_response' },
                },
            ],
        });
        // Sequência Pós-Demonstração
        this.registerSequence({
            id: 'post_demo',
            name: 'Sequência Pós-Demonstração',
            description: 'Follow-up após demonstração do produto',
            steps: [
                {
                    order: 1,
                    delayHours: 2,
                    type: 'message',
                    template: 'Oi! 👋 Espero que tenha gostado da nossa demonstração!\n\nFicou com alguma dúvida? Posso te ajudar a esclarecer qualquer ponto.',
                },
                {
                    order: 2,
                    delayHours: 24,
                    type: 'ai_generated',
                    aiPrompt: 'Gere uma mensagem perguntando se o lead teve tempo de avaliar a proposta e se gostaria de discutir os próximos passos.',
                    condition: { type: 'no_response' },
                },
                {
                    order: 3,
                    delayHours: 72,
                    type: 'message',
                    template: 'Oi! Só queria verificar se posso te ajudar com a decisão.\n\nTemos condições especiais para fechamento esta semana! 🎯',
                    condition: { type: 'no_response' },
                },
            ],
        });
    }
    registerSequence(sequence) {
        this.sequences.set(sequence.id, sequence);
        logger.agent(`Sequence registered: ${sequence.name}`);
    }
    getSequence(id) {
        return this.sequences.get(id);
    }
    listSequences() {
        return Array.from(this.sequences.values());
    }
    // ============ Prospecting Actions ============
    async startSequence(phone, sequenceId) {
        if (!this.config.enabled) {
            return { success: false, message: 'Prospecção está desabilitada' };
        }
        if (!this.isWithinBusinessHours()) {
            return { success: false, message: 'Fora do horário comercial' };
        }
        if (!this.canSendMessage()) {
            return { success: false, message: 'Limite diário de mensagens atingido' };
        }
        const sequence = this.sequences.get(sequenceId);
        if (!sequence) {
            return { success: false, message: `Sequência não encontrada: ${sequenceId}` };
        }
        try {
            // Buscar ou criar lead
            let lead = await supabaseService.getLeadByPhone(phone);
            if (!lead) {
                lead = await supabaseService.createLead({ phone, source: 'prospecting' });
            }
            // Iniciar sequência no banco
            const sequenceRunId = await supabaseService.startProspectingSequence(lead.id, sequenceId);
            // Executar primeiro step
            await this.executeStep(phone, sequence.steps[0], lead);
            // Agendar próximos steps (em produção, usar job queue)
            this.scheduleNextSteps(sequenceRunId, sequence, lead.id, 1);
            logger.agent('Sequence started', { phone, sequenceId, sequenceRunId });
            return {
                success: true,
                message: `Sequência "${sequence.name}" iniciada`,
                sequenceRunId,
            };
        }
        catch (error) {
            logger.error('Failed to start sequence', error, 'AGENT');
            return { success: false, message: 'Erro ao iniciar sequência' };
        }
    }
    async executeStep(phone, step, lead) {
        try {
            let message;
            switch (step.type) {
                case 'message':
                    message = this.interpolateTemplate(step.template, lead);
                    break;
                case 'ai_generated':
                    message = await aiService.chat(step.aiPrompt, `Você está gerando uma mensagem de prospecção para um lead chamado ${lead.name || 'cliente'}.
            Seja conciso, amigável e direto. Use emojis moderadamente.
            Não seja muito formal nem muito informal.`);
                    break;
                case 'media':
                    await wahaService.sendMedia({
                        chatId: phone,
                        mediaUrl: step.mediaUrl,
                        caption: step.template ? this.interpolateTemplate(step.template, lead) : undefined,
                    });
                    this.incrementMessageCount();
                    return true;
                default:
                    logger.warn(`Unknown step type: ${step.type}`, undefined, 'AGENT');
                    return false;
            }
            await wahaService.sendMessage({ chatId: phone, text: message });
            this.incrementMessageCount();
            logger.agent('Step executed', { phone, stepOrder: step.order, type: step.type });
            return true;
        }
        catch (error) {
            logger.error('Failed to execute step', error, 'AGENT');
            return false;
        }
    }
    scheduleNextSteps(sequenceRunId, sequence, leadId, startFromStep) {
        // Em produção, usar uma job queue como Bull, Agenda, etc.
        // Por agora, apenas log que deveria ser agendado
        const remainingSteps = sequence.steps.slice(startFromStep);
        for (const step of remainingSteps) {
            const nextActionAt = new Date(Date.now() + step.delayHours * 60 * 60 * 1000);
            logger.agent('Step scheduled (mock)', {
                sequenceRunId,
                stepOrder: step.order,
                scheduledFor: nextActionAt.toISOString(),
            });
        }
    }
    // ============ Anti-Ghosting ============
    async checkAndFollowUp() {
        if (!this.config.enabled || !this.config.antiGhosting.enabled) {
            return { checked: 0, followedUp: 0 };
        }
        const results = { checked: 0, followedUp: 0 };
        for (const hours of this.config.antiGhosting.intervals) {
            const ghostedConversations = await supabaseService.getGhostedConversations(hours);
            results.checked += ghostedConversations.length;
            for (const conversation of ghostedConversations) {
                if (!this.canSendMessage())
                    break;
                if (!this.isWithinBusinessHours())
                    break;
                const followUpAttempts = this.getFollowUpAttempts(conversation);
                if (followUpAttempts >= this.config.antiGhosting.maxAttempts) {
                    // Marcar como ghosted definitivamente
                    await supabaseService.updateConversationStatus(conversation.id, 'ghosted');
                    continue;
                }
                const message = this.config.antiGhosting.messages[followUpAttempts]
                    || this.config.antiGhosting.messages[this.config.antiGhosting.messages.length - 1];
                try {
                    await wahaService.sendMessage({
                        chatId: conversation.phone,
                        text: message,
                    });
                    this.incrementMessageCount();
                    results.followedUp++;
                    // Atualizar contexto com tentativa de follow-up
                    const context = conversation.context || {};
                    context.followUpAttempts = (context.followUpAttempts || 0) + 1;
                    context.lastFollowUp = new Date().toISOString();
                    await supabaseService.updateConversationContext(conversation.id, context);
                    logger.agent('Anti-ghosting follow-up sent', {
                        phone: conversation.phone,
                        attempt: followUpAttempts + 1,
                    });
                }
                catch (error) {
                    logger.error('Failed to send follow-up', error, 'AGENT');
                }
            }
        }
        return results;
    }
    getFollowUpAttempts(conversation) {
        const context = conversation.context;
        return context?.followUpAttempts || 0;
    }
    // ============ Lead Qualification ============
    async qualifyLead(phone) {
        const conversation = await supabaseService.getConversationByPhone(phone);
        if (!conversation || conversation.messages.length === 0) {
            return {
                score: 0,
                status: 'new',
                interests: [],
                recommendation: 'Iniciar conversa para qualificar',
            };
        }
        const messages = conversation.messages.map((m) => ({
            role: m.role,
            content: m.content,
        }));
        const qualification = await aiService.qualifyLead(messages);
        // Atualizar lead no banco
        const lead = await supabaseService.getLeadByPhone(phone);
        if (lead) {
            let newStatus = 'new';
            if (qualification.score >= 80)
                newStatus = 'qualified';
            else if (qualification.score >= 50)
                newStatus = 'contacted';
            await supabaseService.updateLead(lead.id, {
                score: qualification.score,
                status: newStatus,
                tags: [...new Set([...(lead.tags || []), ...qualification.interests])],
            });
        }
        // Gerar recomendação
        let recommendation;
        if (qualification.score >= 80) {
            recommendation = 'Lead quente! Priorizar contato comercial.';
        }
        else if (qualification.score >= 50) {
            recommendation = 'Lead morno. Continuar nutrição com conteúdo relevante.';
        }
        else {
            recommendation = 'Lead frio. Manter em sequência de aquecimento.';
        }
        return {
            score: qualification.score,
            status: lead?.status || 'new',
            interests: qualification.interests,
            recommendation,
        };
    }
    // ============ Bulk Operations ============
    async sendBulkMessage(phones, message, options) {
        const results = { total: phones.length, sent: 0, failed: 0, skipped: 0 };
        const delay = options?.delayBetweenMs || 2000;
        for (const phone of phones) {
            if (!this.canSendMessage()) {
                logger.warn('Daily limit reached, stopping bulk send', undefined, 'AGENT');
                break;
            }
            if (!this.isWithinBusinessHours()) {
                logger.warn('Outside business hours, stopping bulk send', undefined, 'AGENT');
                break;
            }
            if (options?.skipExisting) {
                const existing = await supabaseService.getConversationByPhone(phone);
                if (existing && existing.messages.length > 0) {
                    results.skipped++;
                    continue;
                }
            }
            try {
                await wahaService.sendMessage({ chatId: phone, text: message });
                this.incrementMessageCount();
                results.sent++;
                // Criar/atualizar lead
                let lead = await supabaseService.getLeadByPhone(phone);
                if (!lead) {
                    lead = await supabaseService.createLead({ phone, source: 'bulk' });
                }
                // Delay entre mensagens
                await this.sleep(delay);
            }
            catch (error) {
                logger.error(`Failed to send to ${phone}`, error, 'AGENT');
                results.failed++;
            }
        }
        logger.agent('Bulk send completed', results);
        return results;
    }
    // ============ Helpers ============
    interpolateTemplate(template, lead) {
        return template
            .replace(/\{name\}/g, lead.name || 'cliente')
            .replace(/\{phone\}/g, lead.phone)
            .replace(/\{email\}/g, lead.email || '')
            .replace(/\{score\}/g, String(lead.score));
    }
    isWithinBusinessHours() {
        const now = new Date();
        const hour = now.getHours();
        return hour >= this.config.businessHoursStart && hour < this.config.businessHoursEnd;
    }
    canSendMessage() {
        this.resetDailyCountIfNeeded();
        return this.dailyMessageCount < this.config.maxDailyMessages;
    }
    incrementMessageCount() {
        this.resetDailyCountIfNeeded();
        this.dailyMessageCount++;
    }
    resetDailyCountIfNeeded() {
        const today = new Date().toISOString().split('T')[0];
        if (this.lastResetDate !== today) {
            this.dailyMessageCount = 0;
            this.lastResetDate = today;
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // ============ Stats ============
    getStats() {
        return {
            enabled: this.config.enabled,
            dailyMessagesSent: this.dailyMessageCount,
            dailyLimit: this.config.maxDailyMessages,
            remainingToday: Math.max(0, this.config.maxDailyMessages - this.dailyMessageCount),
            isWithinBusinessHours: this.isWithinBusinessHours(),
            registeredSequences: this.sequences.size,
        };
    }
}
// Singleton
export const prospectingAgent = new ProspectingAgent();
//# sourceMappingURL=prospecting.agent.js.map