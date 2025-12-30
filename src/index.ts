#!/usr/bin/env node
// ============================================
// MCP-DOCA-V2 - Main Server
// Model Context Protocol Server para DOCA Agência IA
// ============================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { logger } from './utils/logger.js';
import { wahaService } from './services/waha.service.js';
import { aiService } from './services/ai.service.js';

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

const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

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
    let content: string;

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
          const status = await wahaService.getSessionStatus();
          content = JSON.stringify(status, null, 2);
        } catch (error) {
          content = JSON.stringify({ error: 'WAHA not available' });
        }
        break;

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: content,
      }],
    };
  } catch (error) {
    logger.error(`Error reading resource: ${uri}`, error);
    throw error;
  }
});

// Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.mcp(`Tool called: ${name}`, args);

  try {
    let result: unknown;

    switch (name) {
      // ========== WAHA Tools ==========
      case 'waha_send_message':
        result = await wahaService.sendMessage({
          chatId: args.phone as string,
          text: args.message as string,
        });
        break;

      case 'waha_send_image':
        result = await wahaService.sendImage(
          args.phone as string,
          args.imageUrl as string,
          args.caption as string | undefined
        );
        break;

      case 'waha_get_messages':
        result = await wahaService.getMessages(
          args.phone as string,
          (args.limit as number) || 50
        );
        break;

      case 'waha_check_number':
        result = await wahaService.checkNumberExists(args.phone as string);
        break;

      case 'waha_session_status':
        result = await wahaService.getSessionStatus();
        break;

      // ========== AI Tools ==========
      case 'ai_generate_response':
        result = await aiService.generateResponse(
          args.userMessage as string,
          {
            leadName: args.leadName as string | undefined,
            businessInfo: args.context as string | undefined,
            tone: args.tone as 'formal' | 'casual' | 'professional' | undefined,
          }
        );
        break;

      case 'ai_analyze_intent':
        result = await aiService.analyzeIntent(args.message as string);
        break;

      case 'ai_analyze_sentiment':
        result = await aiService.analyzeSentiment(args.message as string);
        break;

      case 'ai_qualify_lead':
        result = await aiService.qualifyLead(
          args.conversation as Array<{ role: 'user' | 'assistant'; content: string }>
        );
        break;

      case 'ai_summarize':
        result = await aiService.summarizeConversation(
          args.conversation as Array<{ role: 'user' | 'assistant'; content: string }>
        );
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    logger.mcp(`Tool ${name} completed successfully`);

    return {
      content: [{
        type: 'text',
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      }],
    };
  } catch (error) {
    logger.error(`Tool ${name} failed`, error);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error',
          tool: name,
        }),
      }],
      isError: true,
    };
  }
});

// ============================================
// Server Startup
// ============================================

async function main() {
  try {
    const transport = new StdioServerTransport();
    
    logger.info('Connecting transport...');
    await server.connect(transport);
    
    logger.info(`${SERVER_NAME} running on stdio`);
    logger.info(`Tools available: ${TOOLS.length}`);
    logger.info(`Resources available: ${RESOURCES.length}`);
    logger.separator();

  } catch (error) {
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
