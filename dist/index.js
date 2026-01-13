#!/usr/bin/env node
// ============================================
// MCP-DOCA-V2 - Main Server
// Model Context Protocol Server para DOCA Agência IA
// ============================================
// ✅ CARREGAR .env PRIMEIRO (antes de qualquer import de services)
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';
import { wahaService } from './services/waha.service.js';
import { aiService } from './services/ai.service.js';
// ✅ NOVOS SERVICES
import { analysisService } from './services/analysis.service.js';
import { emotionService } from './services/emotion.service.js';
import { supabaseService } from './services/supabase.service.js';
import { clientService } from './services/client.service.js';
// ============================================
// Server Configuration
// ============================================
const SERVER_NAME = 'mcp-doca-v2';
const SERVER_VERSION = '1.0.0';
logger.separator('MCP-DOCA-V2 Server');
logger.info(`Starting ${SERVER_NAME} v${SERVER_VERSION}`);
// ============================================
// MCP Server Instance
// ============================================
const server = new Server({
    name: SERVER_NAME,
    version: SERVER_VERSION,
}, {
    capabilities: {
        tools: {},
        resources: {},
    },
});
// ============================================
// Tools Definition
// ============================================
const TOOLS = [
    // ========== WAHA Tools ==========
    {
        name: 'waha_send_message',
        description: 'Envia uma mensagem de texto via WhatsApp usando WAHA',
        inputSchema: {
            type: 'object',
            properties: {
                phone: {
                    type: 'string',
                    description: 'Número do telefone (ex: 5511999999999)',
                },
                message: {
                    type: 'string',
                    description: 'Texto da mensagem a enviar',
                },
            },
            required: ['phone', 'message'],
        },
    },
    {
        name: 'waha_send_image',
        description: 'Envia uma imagem via WhatsApp usando WAHA',
        inputSchema: {
            type: 'object',
            properties: {
                phone: {
                    type: 'string',
                    description: 'Número do telefone',
                },
                imageUrl: {
                    type: 'string',
                    description: 'URL da imagem',
                },
                caption: {
                    type: 'string',
                    description: 'Legenda da imagem (opcional)',
                },
            },
            required: ['phone', 'imageUrl'],
        },
    },
    {
        name: 'waha_get_messages',
        description: 'Obtém histórico de mensagens de um chat',
        inputSchema: {
            type: 'object',
            properties: {
                phone: {
                    type: 'string',
                    description: 'Número do telefone',
                },
                limit: {
                    type: 'number',
                    description: 'Quantidade de mensagens (padrão: 50)',
                },
            },
            required: ['phone'],
        },
    },
    {
        name: 'waha_check_number',
        description: 'Verifica se um número existe no WhatsApp',
        inputSchema: {
            type: 'object',
            properties: {
                phone: {
                    type: 'string',
                    description: 'Número do telefone para verificar',
                },
            },
            required: ['phone'],
        },
    },
    {
        name: 'waha_session_status',
        description: 'Verifica o status da sessão WAHA',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    // ========== AI Tools ==========
    {
        name: 'ai_generate_response',
        description: 'Gera uma resposta usando IA para uma mensagem do cliente',
        inputSchema: {
            type: 'object',
            properties: {
                userMessage: {
                    type: 'string',
                    description: 'Mensagem do usuário',
                },
                leadName: {
                    type: 'string',
                    description: 'Nome do lead (opcional)',
                },
                context: {
                    type: 'string',
                    description: 'Contexto adicional sobre o negócio ou conversa',
                },
                tone: {
                    type: 'string',
                    enum: ['formal', 'casual', 'professional'],
                    description: 'Tom da resposta',
                },
            },
            required: ['userMessage'],
        },
    },
    {
        name: 'ai_analyze_intent',
        description: 'Analisa a intenção de uma mensagem',
        inputSchema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    description: 'Mensagem para analisar',
                },
            },
            required: ['message'],
        },
    },
    {
        name: 'ai_analyze_sentiment',
        description: 'Analisa o sentimento de uma mensagem',
        inputSchema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    description: 'Mensagem para analisar',
                },
            },
            required: ['message'],
        },
    },
    {
        name: 'ai_qualify_lead',
        description: 'Qualifica um lead baseado no histórico de conversa',
        inputSchema: {
            type: 'object',
            properties: {
                conversation: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            role: { type: 'string', enum: ['user', 'assistant'] },
                            content: { type: 'string' },
                        },
                    },
                    description: 'Histórico da conversa',
                },
            },
            required: ['conversation'],
        },
    },
    {
        name: 'ai_summarize',
        description: 'Resume uma conversa',
        inputSchema: {
            type: 'object',
            properties: {
                conversation: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            role: { type: 'string', enum: ['user', 'assistant'] },
                            content: { type: 'string' },
                        },
                    },
                    description: 'Conversa para resumir',
                },
            },
            required: ['conversation'],
        },
    },
    // ========== Utility Tools ==========
    {
        name: 'get_current_time',
        description: 'Retorna a data e hora atual no fuso horário de São Paulo',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    // ========== Analysis Tools (Follow-ups IA) ==========
    {
        name: 'analysis_get_stalled_conversations',
        description: 'Lista conversas paradas para sugerir follow-ups',
        inputSchema: {
            type: 'object',
            properties: {
                min_minutes: {
                    type: 'number',
                    description: 'Mínimo de minutos parado (ex: 240)',
                },
                limit: { type: 'number', description: 'Quantidade máxima (ex: 20)' },
                status: {
                    type: 'string',
                    enum: ['open', 'closed'],
                    description: 'Status da conversa (padrão: open)',
                },
            },
            required: [],
        },
    },
    {
        name: 'analysis_get_summary',
        description: 'Resumo geral da aba de análise (stalled, followups sugeridos, enviados)',
        inputSchema: {
            type: 'object',
            properties: {
                range: {
                    type: 'string',
                    enum: ['today', '7d', '30d'],
                    description: 'Período (today, 7d, 30d)',
                },
            },
            required: [],
        },
    },
    {
        name: 'analysis_run_followup',
        description: 'Roda IA em uma conversa e sugere follow-up + alternativas',
        inputSchema: {
            type: 'object',
            properties: {
                conversation_id: {
                    type: 'string',
                    description: 'ID da conversa (conv-xxx ou uuid)',
                },
                mode: {
                    type: 'string',
                    enum: ['followup', 'insights'],
                    description: 'Modo de análise',
                },
                language: {
                    type: 'string',
                    description: 'Idioma (ex: pt-BR)',
                },
            },
            required: ['conversation_id'],
        },
    },
    {
        name: 'analysis_approve_send_followup',
        description: 'Aprova e envia o follow-up pelo WhatsApp (WAHA)',
        inputSchema: {
            type: 'object',
            properties: {
                conversation_id: { type: 'string', description: 'ID da conversa' },
                text: { type: 'string', description: 'Texto aprovado para envio' },
                followup_id: {
                    type: 'string',
                    description: 'ID do followup salvo (opcional)',
                },
                phone: {
                    type: 'string',
                    description: 'Telefone/chatId (opcional, força envio)',
                },
            },
            required: ['conversation_id', 'text'],
        },
    },
    // ========== Emotion Tools ==========
    {
        name: 'emotion_get_dashboard_metrics',
        description: 'Retorna métricas gerais: total leads, média health, total eventos, distribuições',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'emotion_get_sentiment_matrix',
        description: 'Retorna a matriz sentimento x intenção para dashboard',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'emotion_get_emotional_funnel',
        description: 'Retorna funil emocional (stages + contagens)',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'emotion_get_lead_health',
        description: 'Retorna health score + estágio emocional de um lead',
        inputSchema: {
            type: 'object',
            properties: {
                lead_id: { type: 'string', description: 'ID do lead' },
            },
            required: ['lead_id'],
        },
    },
];
// ============================================
// Resources Definition
// ============================================
const RESOURCES = [
    {
        uri: 'doca://config/server',
        name: 'Server Configuration',
        description: 'Configurações atuais do servidor MCP',
        mimeType: 'application/json',
    },
    {
        uri: 'doca://config/ai',
        name: 'AI Configuration',
        description: 'Configurações do serviço de IA',
        mimeType: 'application/json',
    },
    {
        uri: 'doca://status/waha',
        name: 'WAHA Status',
        description: 'Status atual da sessão WAHA',
        mimeType: 'application/json',
    },
];
// ============================================
// Request Handlers
// ============================================
// List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.mcp('List tools requested');
    return { tools: TOOLS };
});
// List Resources Handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    logger.mcp('List resources requested');
    return { resources: RESOURCES };
});
// Read Resource Handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.mcp(`Read resource: ${uri}`);
    try {
        let content;
        switch (uri) {
            case 'doca://config/server':
                content = JSON.stringify({
                    name: SERVER_NAME,
                    version: SERVER_VERSION,
                    timestamp: new Date().toISOString(),
                }, null, 2);
                break;
            case 'doca://config/ai':
                content = JSON.stringify(aiService.getConfig(), null, 2);
                break;
            case 'doca://status/waha':
                try {
                    const status = wahaService.getSessionStatus
                        ? await wahaService.getSessionStatus()
                        : { status: 'unknown', message: 'getSessionStatus not available' };
                    content = JSON.stringify(status, null, 2);
                }
                catch (error) {
                    content = JSON.stringify({ error: 'WAHA not available' });
                }
                break;
            default:
                throw new Error(`Unknown resource: ${uri}`);
        }
        return {
            contents: [
                {
                    uri,
                    mimeType: 'application/json',
                    text: content,
                },
            ],
        };
    }
    catch (error) {
        logger.error(`Error reading resource: ${uri}`, error);
        throw error;
    }
});
// Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.mcp(`Tool called: ${name}`, args);
    try {
        let result;
        switch (name) {
            // ========== WAHA Tools ==========
            case 'waha_send_message':
                result = await wahaService.sendMessage({
                    chatId: args.phone,
                    text: args.message,
                });
                break;
            case 'waha_send_image':
                result = await wahaService.sendImage(args.phone, args.imageUrl, args.caption);
                break;
            case 'waha_get_messages':
                result = await wahaService.getMessages(args.phone, args.limit || 50);
                break;
            case 'waha_check_number':
                result = await wahaService.checkNumber(args.phone);
                break;
            case 'waha_session_status':
                result = wahaService.getSessionStatus
                    ? await wahaService.getSessionStatus()
                    : { status: 'unknown', message: 'getSessionStatus not available' };
                break;
            // ========== AI Tools ==========
            case 'ai_generate_response':
                result = await aiService.generateResponse(args.userMessage, {
                    leadName: args.leadName,
                    businessInfo: args.context,
                    tone: args.tone,
                });
                break;
            case 'ai_analyze_intent':
                result = await aiService.analyzeIntent(args.message);
                break;
            case 'ai_analyze_sentiment':
                result = await aiService.analyzeSentiment(args.message);
                break;
            case 'ai_qualify_lead':
                result = await aiService.qualifyLead(args.conversation);
                break;
            case 'ai_summarize':
                result = await aiService.summarizeConversation(args.conversation);
                break;
            // ========== Utility Tools ==========
            case 'get_current_time':
                result = {
                    timestamp: new Date().toISOString(),
                    formatted: new Date().toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                    }),
                    timezone: 'America/Sao_Paulo',
                };
                break;
            // ========== Analysis Tools ==========
            case 'analysis_get_stalled_conversations':
                result = await analysisService.getStalledConversations({
                    min_minutes: args.min_minutes ?? 240,
                    limit: args.limit ?? 20,
                    status: args.status ?? 'open',
                });
                break;
            case 'analysis_get_summary':
                result = await analysisService.getSummary({
                    range: args.range ?? 'today',
                });
                break;
            case 'analysis_run_followup':
                result = await analysisService.runAnalysis({
                    conversation_id: args.conversation_id,
                    mode: args.mode ?? 'followup',
                    language: args.language ?? 'pt-BR',
                });
                break;
            case 'analysis_approve_send_followup':
                result = await analysisService.approveAndSend({
                    conversation_id: args.conversation_id,
                    text: args.text,
                    followup_id: args.followup_id || undefined,
                    phone: args.phone || undefined,
                });
                break;
            // ========== Emotion Tools ==========
            case 'emotion_get_dashboard_metrics':
                result = await emotionService.getDashboardMetrics();
                break;
            case 'emotion_get_sentiment_matrix':
                result = await emotionService.getSentimentMatrix();
                break;
            case 'emotion_get_emotional_funnel':
                result = await emotionService.getEmotionalFunnel();
                break;
            case 'emotion_get_lead_health':
                result = await emotionService.getLeadHealth(args.lead_id);
                break;
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
        logger.mcp(`Tool ${name} completed successfully`);
        return {
            content: [
                {
                    type: 'text',
                    text: typeof result === 'string'
                        ? result
                        : JSON.stringify(result, null, 2),
                },
            ],
        };
    }
    catch (error) {
        logger.error(`Tool ${name} failed`, error);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        error: true,
                        message: error instanceof Error ? error.message : 'Unknown error',
                        tool: name,
                    }),
                },
            ],
            isError: true,
        };
    }
});
// ============================================
// Server Startup
// ============================================
async function main() {
    try {
        // (Opcional) inicializa supabase, caso sua app precise conectar antes
        // Se seu supabaseService já auto-init no constructor, pode remover.
        try {
            if (typeof supabaseService.initialize === 'function') {
                await supabaseService.initialize();
            }
        }
        catch (e) {
            logger.warn('Supabase initialize skipped/failed (continuing)...');
        }
        const transport = new StdioServerTransport();
        logger.info('Connecting transport...');
        await server.connect(transport);
        logger.info(`${SERVER_NAME} running on stdio`);
        logger.info(`Tools available: ${TOOLS.length}`);
        logger.info(`Resources available: ${RESOURCES.length}`);
        // Listar clientes carregados
        console.log('📁 Clientes disponíveis:', clientService.listClients());
        logger.separator();
    }
    catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
}
// Handle shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    process.exit(0);
});
// Start server
main();
