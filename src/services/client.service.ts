// ============================================
// MCP-DOCA-V2 - Client Service
// Gerencia clientes a partir da pasta /clientes
// ============================================

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

interface ClientConfig {
  id: string;
  nome: string;
  nome_exibicao: string;
  telefone?: string;
  endereco?: string;
  especialidade?: string;
  site?: string;
  horario_funcionamento?: any;
  servicos?: string[];
  personalizacao?: any;
  zapi?: {
    instance_id: string;
    token: string;
    clientToken: string;
  };
  crm?: any;
  ai_config?: any;
  features?: any;
  conversation?: any;
  emotion_mapping?: any;
  journey_stages?: any;
}

interface Client {
  id: string;
  config: ClientConfig;
  prompt: string;
  knowledge: string;
  provasSociais: string[];
}

class ClientService {
  private clientsPath: string;
  private clients: Map<string, Client> = new Map();
  private phoneToClient: Map<string, string> = new Map();

  constructor() {
    this.clientsPath = path.join(process.cwd(), 'clientes');
    this.loadClients();
  }

  // ============ Carregar Clientes ============

  loadClients(): void {
    try {
      if (!fs.existsSync(this.clientsPath)) {
        logger.warn(`Pasta de clientes não encontrada: ${this.clientsPath}`, undefined, 'CLIENT');
        return;
      }

      const folders = fs.readdirSync(this.clientsPath);

      for (const folder of folders) {
        if (folder.startsWith('_') || folder.startsWith('.')) continue;

        const clientPath = path.join(this.clientsPath, folder);
        const stat = fs.statSync(clientPath);

        if (!stat.isDirectory()) continue;

        try {
          const client = this.loadClient(folder, clientPath);
          if (client) {
            this.clients.set(folder, client);
            
            // Mapear telefone para cliente
            if (client.config.telefone) {
              const phone = client.config.telefone.replace(/\D/g, '');
              this.phoneToClient.set(phone, folder);
            }

            // Mapear instance_id Z-API para cliente
            if (client.config.zapi?.instance_id) {
              this.phoneToClient.set(client.config.zapi.instance_id, folder);
            }

            logger.info(`✅ Cliente carregado: ${folder} (${client.config.nome_exibicao})`, undefined, 'CLIENT');
          }
        } catch (err) {
          logger.error(`Erro ao carregar cliente ${folder}:`, err, 'CLIENT');
        }
      }

      logger.info(`📊 Total de clientes carregados: ${this.clients.size}`, undefined, 'CLIENT');
    } catch (error) {
      logger.error('Erro ao carregar clientes:', error, 'CLIENT');
    }
  }

  private loadClient(id: string, clientPath: string): Client | null {
    const configPath = path.join(clientPath, 'config.json');
    const promptPath = path.join(clientPath, 'prompt.md');
    const knowledgePath = path.join(clientPath, 'knowledge.md');
    const provasSociaisPath = path.join(clientPath, 'provas-sociais');

    // Config é obrigatório
    if (!fs.existsSync(configPath)) {
      logger.warn(`Config não encontrado para: ${id}`, undefined, 'CLIENT');
      return null;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const prompt = fs.existsSync(promptPath) 
      ? fs.readFileSync(promptPath, 'utf8') 
      : '';
    const knowledge = fs.existsSync(knowledgePath) 
      ? fs.readFileSync(knowledgePath, 'utf8') 
      : '';

    // Listar provas sociais
    let provasSociais: string[] = [];
    if (fs.existsSync(provasSociaisPath)) {
      provasSociais = fs.readdirSync(provasSociaisPath)
        .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    }

    return {
      id,
      config: { ...config, id },
      prompt,
      knowledge,
      provasSociais,
    };
  }

  // ============ Getters ============

  getClient(clientId: string): Client | undefined {
    return this.clients.get(clientId);
  }

  getClientConfig(clientId: string): ClientConfig | undefined {
    return this.clients.get(clientId)?.config;
  }

  getClientPrompt(clientId: string): string {
    const client = this.clients.get(clientId);
    if (!client) return '';

    // Substituir variáveis temporais
    const now = new Date();
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    let prompt = client.prompt;
    prompt = prompt.replace(/\{\{DATA_ATUAL\}\}/g, now.toLocaleDateString('pt-BR'));
    prompt = prompt.replace(/\{\{DIA_SEMANA\}\}/g, dias[now.getDay()]);
    prompt = prompt.replace(/\{\{HORA_ATUAL\}\}/g, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    
    // Data de amanhã
    const amanha = new Date(now);
    amanha.setDate(amanha.getDate() + 1);
    prompt = prompt.replace(/\{\{DATA_AMANHA\}\}/g, amanha.toLocaleDateString('pt-BR'));

    return prompt;
  }

  getClientKnowledge(clientId: string): string {
    return this.clients.get(clientId)?.knowledge || '';
  }

  getAllClients(): Client[] {
    return Array.from(this.clients.values());
  }

  listClients(): Array<{ id: string; nome: string; telefone?: string }> {
    return Array.from(this.clients.values()).map(c => ({
      id: c.id,
      nome: c.config.nome_exibicao || c.config.nome,
      telefone: c.config.telefone,
    }));
  }

  // ============ Detecção de Cliente ============

  detectClient(phone?: string, instanceId?: string): string | null {
    // Por instance_id do Z-API
    if (instanceId && this.phoneToClient.has(instanceId)) {
      return this.phoneToClient.get(instanceId)!;
    }

    // Por telefone
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (this.phoneToClient.has(cleanPhone)) {
        return this.phoneToClient.get(cleanPhone)!;
      }
    }

    // Retorna primeiro cliente como fallback
    const firstClient = this.clients.keys().next().value;
    return firstClient || null;
  }

  // ============ Build System Prompt ============

  buildSystemPrompt(clientId: string): string {
    const client = this.clients.get(clientId);
    if (!client) return '';

    const prompt = this.getClientPrompt(clientId);
    const knowledge = this.getClientKnowledge(clientId);

    return `${prompt}\n\n---\n\n# BASE DE CONHECIMENTO\n\n${knowledge}`;
  }

  // ============ Reload ============

  reload(): void {
    this.clients.clear();
    this.phoneToClient.clear();
    this.loadClients();
    logger.info('Clientes recarregados', undefined, 'CLIENT');
  }

  // ============ Sync com Supabase ============

  async syncToSupabase(supabase: any): Promise<void> {
    for (const [id, client] of this.clients) {
      try {
        const { error } = await supabase
          .from('tenants')
          .upsert({
            slug: id,
            name: client.config.nome_exibicao || client.config.nome,
            phone: client.config.telefone,
            address: client.config.endereco,
            specialty: client.config.especialidade,
            agent_config: client.config.personalizacao,
            zapi_config: client.config.zapi,
            crm_config: client.config.crm,
            business_hours: client.config.horario_funcionamento,
            prompt: client.prompt,
            knowledge: client.knowledge,
          }, { onConflict: 'slug' });

        if (error) {
          logger.error(`Erro ao sincronizar ${id}:`, error, 'CLIENT');
        } else {
          logger.info(`✅ Sincronizado: ${id}`, undefined, 'CLIENT');
        }
      } catch (err) {
        logger.error(`Erro ao sincronizar ${id}:`, err, 'CLIENT');
      }
    }
  }
}

// Exportar instância singleton
export const clientService = new ClientService();
