// ============================================
// MCP-DOCA-V2 - Emotion Service
// Serviço de Análise Emocional e Métricas
// ============================================
import { logger } from '../utils/logger.js';
import { supabaseService } from './supabase.service.js';
// Mapeamento de emoções para stages do funil
const EMOTION_TO_STAGE = {
    skeptical: 'cético',
    frustrated: 'frustrado',
    curious: 'curioso',
    price_sensitive: 'sensível_preço',
    excited: 'empolgado',
    ready: 'pronto',
    anxious: 'curioso',
    neutral: 'curioso',
};
// Scores de temperatura por emoção (0-100)
const EMOTION_TEMPERATURE = {
    ready: 95,
    excited: 85,
    price_sensitive: 65,
    curious: 50,
    anxious: 70,
    frustrated: 30,
    skeptical: 20,
    neutral: 40,
};
// Scores de conversão por emoção (0-1)
const EMOTION_CONVERSION = {
    ready: 0.85,
    excited: 0.70,
    anxious: 0.60,
    curious: 0.45,
    price_sensitive: 0.40,
    frustrated: 0.25,
    skeptical: 0.15,
    neutral: 0.35,
};
export class EmotionService {
    // ============ Salvar Eventos de Emoção ============
    async saveEmotionEvent(event) {
        try {
            await supabaseService.request('POST', 'emotion_events', {
                body: {
                    ...event,
                    detected_at: new Date().toISOString(),
                    metadata: {}
                }
            });
            // Atualizar emoção atual na conversa
            await supabaseService.request('PATCH', 'conversations', {
                query: `id=eq.${event.conversation_id}`,
                body: {
                    current_emotion: event.emotion,
                    emotion_score: Math.round(event.confidence * 100),
                    temperature: EMOTION_TEMPERATURE[event.emotion] || 50
                }
            });
            logger.info('Emotion event saved', {
                emotion: event.emotion,
                lead_id: event.lead_id
            }, 'EMOTION');
        }
        catch (error) {
            logger.error('Failed to save emotion event', error, 'EMOTION');
            throw error;
        }
    }
    // ============ Atualizar Métricas do Lead ============
    async updateLeadMetrics(leadId) {
        try {
            // Buscar eventos de emoção do lead
            const events = await supabaseService.request('GET', 'emotion_events', {
                query: `lead_id=eq.${leadId}&order=detected_at.desc&limit=50`
            });
            if (!events || events.length === 0)
                return;
            // Calcular profile emocional
            const profile = this.calculateEmotionProfile(events);
            // Calcular health metrics
            const health = this.calculateHealthMetrics(events, profile);
            // Determinar stage atual
            const stage = EMOTION_TO_STAGE[profile.dominant_emotion] || 'curioso';
            // Atualizar lead
            await supabaseService.request('PATCH', 'leads', {
                query: `id=eq.${leadId}`,
                body: {
                    emotion_profile: profile,
                    health_score: health.health_score,
                    stage,
                    urgency_level: health.urgency_level,
                    conversion_probability: health.conversion_probability
                }
            });
            logger.info('Lead metrics updated', {
                leadId,
                health_score: health.health_score,
                stage
            }, 'EMOTION');
        }
        catch (error) {
            logger.error('Failed to update lead metrics', error, 'EMOTION');
        }
    }
    // ============ Calcular Profile Emocional ============
    calculateEmotionProfile(events) {
        const distribution = {};
        const transitions = [];
        // Contar distribuição de emoções
        events.forEach(event => {
            const emotion = event.emotion;
            distribution[emotion] = (distribution[emotion] || 0) + 1;
        });
        // Calcular transições (simplificado - só pega últimas 10)
        for (let i = 0; i < Math.min(events.length - 1, 10); i++) {
            const from = events[i + 1].emotion;
            const to = events[i].emotion;
            if (from !== to) {
                const existing = transitions.find(t => t.from === from && t.to === to);
                if (existing) {
                    existing.count++;
                }
                else {
                    transitions.push({ from, to, count: 1 });
                }
            }
        }
        // Encontrar emoção dominante
        let dominantEmotion = 'neutral';
        let maxCount = 0;
        Object.entries(distribution).forEach(([emotion, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominantEmotion = emotion;
            }
        });
        return {
            dominant_emotion: dominantEmotion,
            emotion_distribution: distribution,
            emotion_transitions: transitions,
            last_updated: new Date()
        };
    }
    // ============ Calcular Health Metrics ============
    calculateHealthMetrics(events, profile) {
        const recentEvents = events.slice(0, 10); // Últimos 10
        // Temperatura média ponderada (eventos mais recentes pesam mais)
        let temperature = 0;
        let totalWeight = 0;
        recentEvents.forEach((event, index) => {
            const weight = 1 / (index + 1); // Peso decrescente
            temperature += EMOTION_TEMPERATURE[event.emotion] * weight;
            totalWeight += weight;
        });
        temperature = Math.round(temperature / totalWeight);
        // Probabilidade de conversão baseada na emoção dominante
        const conversion_probability = EMOTION_CONVERSION[profile.dominant_emotion] || 0.35;
        // Health score (0-100)
        const health_score = Math.round(temperature * 0.6 + // 60% temperatura
            conversion_probability * 100 * 0.4 // 40% probabilidade
        );
        // Nível de urgência
        let urgency_level = 'normal';
        if (profile.dominant_emotion === 'anxious' || temperature > 80) {
            urgency_level = 'high';
        }
        else if (profile.dominant_emotion === 'frustrated') {
            urgency_level = 'critical';
        }
        else if (temperature < 30) {
            urgency_level = 'low';
        }
        // Pontos de fricção
        const friction_points = [];
        if (profile.dominant_emotion === 'skeptical') {
            friction_points.push('Ceticismo sobre o produto');
        }
        if (profile.dominant_emotion === 'frustrated') {
            friction_points.push('Frustração com o processo');
        }
        if (profile.dominant_emotion === 'price_sensitive') {
            friction_points.push('Sensibilidade a preço');
        }
        // Sinais positivos
        const positive_signals = [];
        if (profile.dominant_emotion === 'excited') {
            positive_signals.push('Empolgação com a solução');
        }
        if (profile.dominant_emotion === 'ready') {
            positive_signals.push('Pronto para fechar');
        }
        if (temperature > 70) {
            positive_signals.push('Alta temperatura');
        }
        return {
            health_score,
            temperature,
            conversion_probability,
            urgency_level,
            friction_points,
            positive_signals
        };
    }
    // ============ APIs para Dashboard ============
    async getDashboardMetrics() {
        try {
            const [leads, conversations, events] = await Promise.all([
                supabaseService.request('GET', 'leads', { query: 'limit=1000' }),
                supabaseService.request('GET', 'conversations', { query: 'limit=1000' }),
                supabaseService.request('GET', 'emotion_events', {
                    query: 'order=detected_at.desc&limit=5000'
                })
            ]);
            // Métricas gerais
            const totalLeads = leads?.length || 0;
            const avgHealthScore = leads?.reduce((acc, l) => acc + (l.health_score || 0), 0) / totalLeads || 0;
            const avgTemperature = conversations?.reduce((acc, c) => acc + (c.temperature || 0), 0) / (conversations?.length || 1) || 0;
            // Distribuição por stage
            const stageDistribution = {};
            leads?.forEach((lead) => {
                const stage = lead.stage || 'curioso';
                stageDistribution[stage] = (stageDistribution[stage] || 0) + 1;
            });
            // Urgências
            const urgencyDistribution = {};
            leads?.forEach((lead) => {
                const urgency = lead.urgency_level || 'normal';
                urgencyDistribution[urgency] = (urgencyDistribution[urgency] || 0) + 1;
            });
            return {
                total_leads: totalLeads,
                avg_health_score: Math.round(avgHealthScore),
                avg_temperature: Math.round(avgTemperature),
                stage_distribution: stageDistribution,
                urgency_distribution: urgencyDistribution,
                total_emotion_events: events?.length || 0
            };
        }
        catch (error) {
            logger.error('Failed to get dashboard metrics', error, 'EMOTION');
            throw error;
        }
    }
    async getSentimentMatrix() {
        try {
            const leads = await supabaseService.request('GET', 'leads', {
                query: 'limit=500&order=created_at.desc'
            });
            if (!leads || leads.length === 0) {
                return { data: [] };
            }
            // Mapear leads para pontos no gráfico
            const data = leads.map((lead) => {
                const emotion = lead.emotion_profile?.dominant_emotion || 'neutral';
                const sentiment = this.emotionToSentiment(emotion);
                const intention = lead.conversion_probability || 0.35;
                return {
                    id: lead.id,
                    phone: lead.phone,
                    name: lead.name,
                    emotion,
                    sentiment,
                    intention,
                    health_score: lead.health_score || 50,
                    stage: lead.stage || 'curioso'
                };
            });
            return { data };
        }
        catch (error) {
            logger.error('Failed to get sentiment matrix', error, 'EMOTION');
            throw error;
        }
    }
    async getEmotionalFunnel() {
        try {
            const leads = await supabaseService.request('GET', 'leads', {
                query: 'limit=1000'
            });
            if (!leads || leads.length === 0) {
                return { funnel: [] };
            }
            // Contar por stage
            const stages = ['cético', 'frustrado', 'curioso', 'sensível_preço', 'empolgado', 'pronto'];
            const funnel = stages.map(stage => {
                const count = leads.filter((l) => l.stage === stage).length;
                return {
                    stage,
                    count,
                    percentage: Math.round((count / leads.length) * 100)
                };
            });
            return { funnel };
        }
        catch (error) {
            logger.error('Failed to get emotional funnel', error, 'EMOTION');
            throw error;
        }
    }
    async getLeadHealth(leadId) {
        try {
            const lead = await supabaseService.request('GET', 'leads', {
                query: `id=eq.${leadId}`
            });
            if (!lead || lead.length === 0) {
                return null;
            }
            const l = lead[0];
            return {
                health_score: l.health_score || 50,
                temperature: l.temperature || 50,
                conversion_probability: l.conversion_probability || 0.35,
                urgency_level: l.urgency_level || 'normal',
                friction_points: [],
                positive_signals: []
            };
        }
        catch (error) {
            logger.error('Failed to get lead health', error, 'EMOTION');
            return null;
        }
    }
    // ============ Helpers ============
    emotionToSentiment(emotion) {
        // Mapeia emoção para score de sentimento (-1 a 1)
        const sentimentMap = {
            skeptical: -0.6,
            frustrated: -0.8,
            anxious: -0.3,
            neutral: 0,
            curious: 0.3,
            price_sensitive: 0.2,
            excited: 0.8,
            ready: 0.9
        };
        return sentimentMap[emotion] || 0;
    }
}
// Singleton
export const emotionService = new EmotionService();
//# sourceMappingURL=emotion.service.js.map