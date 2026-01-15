// src/services/scheduler.service.ts
// ============================================
// Scheduler Service - Integração com APIs de Agendamento
// ============================================

import { logger } from "../utils/logger.js";
import { clientService } from "./client.service.js";

interface HorariosResponse {
  success: boolean;
  data?: string;
  horarios?: string[];
  total?: number;
  error?: string;
}

interface AgendarResponse {
  success: boolean;
  reservaId?: string;
  message?: string;
  error?: string;
}

class SchedulerService {
  
  hasSchedulerTool(clientId: string): boolean {
    const config = clientService.getClientConfig(clientId);
    if (!config) return false;
    const tools = (config as any).tools || [];
    return tools.includes('agendamento') || tools.includes('scheduler');
  }

  getSchedulerUrl(clientId: string): string | null {
    const config = clientService.getClientConfig(clientId);
    if (!config) return null;
    return (config as any).scheduler_url || null;
  }

  async consultarHorarios(clientId: string, data: string): Promise<HorariosResponse> {
    const url = this.getSchedulerUrl(clientId);
    
    if (!url) {
      logger.warn("Scheduler URL not configured", { clientId }, "SCHEDULER");
      return { success: false, error: "Scheduler não configurado" };
    }

    try {
      logger.info("Consultando horários", { clientId, data, url }, "SCHEDULER");
      
      const response = await fetch(`${url}/api/horarios?data=${encodeURIComponent(data)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(120000)
      });

      const result = await response.json() as HorariosResponse;
      
      if (result.success) {
        logger.info("Horários obtidos", { clientId, data, total: result.total }, "SCHEDULER");
      }

      return result;
    } catch (error: any) {
      logger.error("Falha ao consultar horários", error, "SCHEDULER");
      return { success: false, error: error.message };
    }
  }

  async agendar(clientId: string, dados: {
    nome: string;
    telefone: string;
    data: string;
    horario: string;
    dataNascimento?: string;
  }): Promise<AgendarResponse> {
    const url = this.getSchedulerUrl(clientId);
    
    if (!url) {
      return { success: false, error: "Scheduler não configurado" };
    }

    try {
      logger.info("Criando reserva", { clientId, ...dados }, "SCHEDULER");
      
      const response = await fetch(`${url}/api/agendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
        signal: AbortSignal.timeout(30000)
      });

      return await response.json() as AgendarResponse;
    } catch (error: any) {
      logger.error("Falha ao criar reserva", error, "SCHEDULER");
      return { success: false, error: error.message };
    }
  }

  detectSchedulingIntent(message: string): { 
    isScheduling: boolean; 
    wantsToKnowHorarios: boolean;
    data?: string;
    horario?: string;
  } {
    const msg = (message || "").toLowerCase();
    
    // Quer saber horários disponíveis
    const horariosPatterns = [
      /hor[aá]rio/i,
      /disponib/i,
      /quando (posso|pode|tem|dá)/i,
      /qual.*(dia|hor[aá]rio)/i,
      /tem (vaga|agenda)/i,
      /quero (ver|saber).*hor/i
    ];
    
    // Quer agendar
    const agendarPatterns = [
      /agendar/i,
      /marcar/i,
      /quero (ir|marcar|agendar)/i,
      /pode ser/i,
      /fecha/i,
      /bora/i,
      /vou nesse/i,
      /esse mesmo/i,
      /confirm/i
    ];

    const wantsToKnowHorarios = horariosPatterns.some(p => p.test(msg));
    const wantsToAgendar = agendarPatterns.some(p => p.test(msg));
    const isScheduling = wantsToKnowHorarios || wantsToAgendar;
    
    if (!isScheduling) {
      return { isScheduling: false, wantsToKnowHorarios: false };
    }

    // Extrair data
    let data: string | undefined;
    
    if (/hoje/i.test(msg)) data = 'hoje';
    else if (/amanh[ãa]/i.test(msg)) data = 'amanha';
    else if (/segunda/i.test(msg)) data = 'segunda';
    else if (/ter[çc]a/i.test(msg)) data = 'terca';
    else if (/quarta/i.test(msg)) data = 'quarta';
    else if (/quinta/i.test(msg)) data = 'quinta';
    else if (/sexta/i.test(msg)) data = 'sexta';
    else if (/s[aá]bado/i.test(msg)) data = 'sabado';
    
    // Extrair horário
    let horario: string | undefined;
    const horarioMatch = msg.match(/(\d{1,2})[h:]?(\d{2})?/);
    if (horarioMatch) {
      const hora = horarioMatch[1].padStart(2, '0');
      const min = horarioMatch[2] || '00';
      horario = `${hora}:${min}`;
    }

    return { isScheduling, wantsToKnowHorarios, data, horario };
  }

  formatHorariosParaPrompt(horarios: string[], data: string): string {
    if (!horarios || horarios.length === 0) {
      return `\n\n---\n## ⚠️ HORÁRIOS\nNão há horários disponíveis para ${data}. Sugira outra data.\n`;
    }

    let texto = `\n\n---\n## 📅 HORÁRIOS DISPONÍVEIS (${data.toUpperCase()})\n`;
    texto += `${horarios.length} opções: ${horarios.join(', ')}\n`;
    texto += `\n**Instrução:** Ofereça 2-3 horários de forma natural, não liste todos.\n`;
    
    return texto;
  }
}

export const schedulerService = new SchedulerService();
