// ============================================
// MCP-DOCA-V2 - Response Agent
// Agente de Respostas Inteligentes com Detecção de Emoções
// V3: modos por intenção + ajustes por stage/emotion + multi bolhas + typing/delay
// V3: salva chunks (bolhas + typing) no DB (message_chunks) para dashboard/replay
// V3: humanizer config via Supabase (agent_humanizer_config) com cache TTL
// ============================================
import { logger } from '../utils/logger.js';
import { aiService } from './ai.service.js';
import { supabaseService } from './supabase.service.js';
import { emotionService } from './emotion.service.js';

// ============================================
// CACHE DO PROMPT (recarrega a cada 5 minutos)
// ============================================
let cachedPrompt: string | null = null;
let promptLastFetch = 0;
const PROMPT_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getPromptFromDB(): Promise<string> {
  const now = Date.now();
  if (cachedPrompt && (now - promptLastFetch) < PROMPT_CACHE_TTL) {
    return cachedPrompt;
  }
  try {
    const result: any = await supabaseService.request('GET', 'settings', {
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
async function getRelevantFAQs(userMessage: string): Promise<string> {
  if (!userMessage) return '';
  try {
    const result: any = await supabaseService.request('GET', 'knowledge_base', {
      query: 'active=is.true&order=priority.desc'
    });
    if (!result || result.length === 0) return '';
    const msgLower = userMessage.toLowerCase();
    const relevantFaqs = result.filter((faq: any) => {
      if (!faq.keywords || faq.keywords.length === 0) return false;
      return faq.keywords.some((kw: string) => msgLower.includes(kw.toLowerCase()));
    }).slice(0, 3);

    if (relevantFaqs.length === 0) return '';

    let faqText = '\n\n---\n## 📚 BASE DE CONHECIMENTO RELEVANTE\n';
    relevantFaqs.forEach((faq: any) => {
      faqText += `\n**P:** ${faq.question}\n**R:** ${faq.answer}\n`;
    });
    return faqText;
  }
  catch (error) {
    logger.error('Erro ao buscar FAQs', error, 'AGENT');
    return '';
  }
}

export function reloadPrompt(): void {
  cachedPrompt = null;
  promptLastFetch = 0;
}

// ============================================
// HUMANIZER CONFIG VIA SUPABASE (V3)
// ============================================
type Intention =
  | 'primeiro_contato'
  | 'cliente_bravo'
  | 'orcamento'
  | 'agendamento'
  | 'curiosidade'
  | 'outros';

type ResponseMode =
  | 'SINGLE'
  | 'TWO_BUBBLES'
  | 'BRAVO'
  | 'BUDGET'
  | 'FIRST_CONTACT'
  | 'SKEPTICAL'
  | 'HOT_CTA';

type HumanizerConfig = {
  maxBubbles: number;
  maxSentencesPerBubble: number;
  maxEmojiPerBubble: number;

  delay: {
    base: number;
    perChar: number;
    cap: number;

    anxiousMultiplier: number;
    skepticalMultiplier: number;
    frustratedMultiplier: number;
    excitedMultiplier: number;
  };

  stageBehavior: Record<
    'cold' | 'warm' | 'hot',
    { maxBubbles: number; requireQuestion: boolean; ctaLevel: 'soft' | 'medium' | 'hard' }
  >;

  saveChunksToDB: boolean;
  saveTypingChunks: boolean;

  intentModes: Record<
    'primeiro_contato' | 'cliente_bravo' | 'orcamento',
    { templates: [string, string] }
  >;
};

type AgentHumanizerPayload = { humanizer?: Partial<HumanizerConfig> };

const DEFAULT_HUMANIZER_CONFIG: HumanizerConfig = {
  maxBubbles: 2,
  maxSentencesPerBubble: 2,
  maxEmojiPerBubble: 1,

  delay: {
    base: 450,
    perChar: 18,
    cap: 1750,

    anxiousMultiplier: 0.6,
    skepticalMultiplier: 1.15,
    frustratedMultiplier: 1.0,
    excitedMultiplier: 0.9,
  },

  stageBehavior: {
    cold: { maxBubbles: 2, requireQuestion: true, ctaLevel: 'soft' },
    warm: { maxBubbles: 2, requireQuestion: true, ctaLevel: 'medium' },
    hot: { maxBubbles: 2, requireQuestion: true, ctaLevel: 'hard' },
  },

  saveChunksToDB: true,
  saveTypingChunks: true,

  intentModes: {
    primeiro_contato: {
      templates: [
        'Oi! 👋 Prazer, sou o Douglas da DOCA.',
        'Me conta rapidinho: você tá buscando melhorar marketing, vendas ou operação?'
      ],
    },
    cliente_bravo: {
      templates: [
        'Poxa… entendi. Sinto muito por isso 🙏',
        'Me diz o que aconteceu (e o número/contato) que eu já resolvo pra você agora.'
      ],
    },
    orcamento: {
      templates: [
        'Consigo sim 😊 Só pra eu te passar certinho:',
        'é pra você ou pra equipe? E qual objetivo principal (mais leads, conversão ou atendimento)?'
      ],
    },
  },
};

function safeJsonParse<T>(val: any, fallback: T): T {
  try {
    if (!val) return fallback;
    if (typeof val === 'string') return JSON.parse(val) as T;
    return val as T;
  } catch {
    return fallback;
  }
}

function mergeHumanizerConfig(
  base: HumanizerConfig,
  incoming?: Partial<HumanizerConfig> | null
): HumanizerConfig {
  const inc = incoming || {};
  return {
    ...base,
    ...inc,

    delay: {
      ...base.delay,
      ...(inc as any).delay,
    },

    stageBehavior: {
      cold: { ...base.stageBehavior.cold, ...(inc as any).stageBehavior?.cold },
      warm: { ...base.stageBehavior.warm, ...(inc as any).stageBehavior?.warm },
      hot: { ...base.stageBehavior.hot, ...(inc as any).stageBehavior?.hot },
    },

    intentModes: {
      primeiro_contato: {
        templates:
          ((inc as any).intentModes?.primeiro_contato?.templates as any) ||
          base.intentModes.primeiro_contato.templates,
      },
      cliente_bravo: {
        templates:
          ((inc as any).intentModes?.cliente_bravo?.templates as any) ||
          base.intentModes.cliente_bravo.templates,
      },
      orcamento: {
        templates:
          ((inc as any).intentModes?.orcamento?.templates as any) ||
          base.intentModes.orcamento.templates,
      },
    },
  };
}

// cache do humanizer
let cachedHumanizer: HumanizerConfig | null = null;
let humanizerLastFetch = 0;
const HUMANIZER_CACHE_TTL = 5 * 60 * 1000; // 5 min

export function reloadHumanizerConfig(): void {
  cachedHumanizer = null;
  humanizerLastFetch = 0;
  logger.info('Humanizer config cache cleared', undefined, 'AGENT');
}

async function getHumanizerConfigFromDB(): Promise<HumanizerConfig> {
  const now = Date.now();

  if (cachedHumanizer && (now - humanizerLastFetch) < HUMANIZER_CACHE_TTL) {
    return cachedHumanizer;
  }

  try {
    const result: any = await supabaseService.request('GET', 'settings', {
      query: 'key=eq.agent_humanizer_config'
    });

    // ⚠️ nosso settings usa key custom; na tua API era GET /api/settings?key=...
    // mas aqui estamos indo direto no Supabase REST. Então key precisa bater.
    // Se você preferir manter "agent_humanizer_config", troque a linha acima por:
    // query: 'key=eq.agent_humanizer_config'

    // O correto (como combinamos na aba):
    // key = agent_humanizer_config
    // então vamos validar e fallback:
    if (!result || !result[0]?.value) {
      // tenta pelo nome sem agent_
      const result2: any = await supabaseService.request('GET', 'settings', {
        query: 'key=eq.agent_humanizer_config'
      });

      if (!result2 || !result2[0]?.value) {
        cachedHumanizer = DEFAULT_HUMANIZER_CONFIG;
        humanizerLastFetch = now;
        return cachedHumanizer;
      }

      const parsed2 = safeJsonParse<AgentHumanizerPayload>(result2[0].value, {});
      cachedHumanizer = mergeHumanizerConfig(DEFAULT_HUMANIZER_CONFIG, parsed2?.humanizer || {});
      humanizerLastFetch = now;
      logger.info('Humanizer config carregado do Supabase (agent_humanizer_config)', undefined, 'AGENT');
      return cachedHumanizer;
    }

    const parsed = safeJsonParse<AgentHumanizerPayload>(result[0].value, {});
    cachedHumanizer = mergeHumanizerConfig(DEFAULT_HUMANIZER_CONFIG, parsed?.humanizer || {});
    humanizerLastFetch = now;

    logger.info('Humanizer config carregado do Supabase (agent_humanizer_config)', undefined, 'AGENT');
    return cachedHumanizer;

  } catch (error) {
    logger.error('Erro ao buscar humanizer config do Supabase', error, 'AGENT');
    cachedHumanizer = DEFAULT_HUMANIZER_CONFIG;
    humanizerLastFetch = now;
    return cachedHumanizer;
  }
}

// ⚠️ Ajuste definitivo: como na aba usamos "agent_humanizer_config",
// eu recomendo você manter esse key único.
// Vamos fixar de vez o query correto:
async function getHumanizerConfigFromDB_FIXED(): Promise<HumanizerConfig> {
  const now = Date.now();

  if (cachedHumanizer && (now - humanizerLastFetch) < HUMANIZER_CACHE_TTL) {
    return cachedHumanizer;
  }

  try {
    const result: any = await supabaseService.request('GET', 'settings', {
      query: 'key=eq.agent_humanizer_config'
    });

    if (!result || !result[0]?.value) {
      cachedHumanizer = DEFAULT_HUMANIZER_CONFIG;
      humanizerLastFetch = now;
      return cachedHumanizer;
    }

    const parsed = safeJsonParse<AgentHumanizerPayload>(result[0].value, {});
    cachedHumanizer = mergeHumanizerConfig(DEFAULT_HUMANIZER_CONFIG, parsed?.humanizer || {});
    humanizerLastFetch = now;

    logger.info('Humanizer config carregado do Supabase', undefined, 'AGENT');
    return cachedHumanizer;
  } catch (error) {
    logger.error('Erro ao buscar humanizer config do Supabase', error, 'AGENT');
    cachedHumanizer = DEFAULT_HUMANIZER_CONFIG;
    humanizerLastFetch = now;
    return cachedHumanizer;
  }
}

// ============================================
// SISTEMA DE DETECÇÃO DE EMOÇÕES (HEURÍSTICO)
// ============================================
const EMOTION_PATTERNS = {
  skeptical: {
    pattern: /duvido|será|não acredito|mentira|enganação|furada|falso|golpe|spam|bot|robô/i,
    style: 'Validar preocupação, mostrar transparência, evitar exageros, oferecer prova social leve',
  },
  anxious: {
    pattern: /urgente|rápido|agora|hoje|já|pressa|correndo|preciso muito|desesperado/i,
    style: 'Transmitir calma, dizer o próximo passo, mostrar que vai resolver',
  },
  frustrated: {
    pattern: /desisto|cansado|nada funciona|difícil|complicado|chato|irritado|problema|não aguento/i,
    style: 'Empatia genuína, reconhecer a dor, oferecer solução concreta',
  },
  excited: {
    pattern: /quero|vamos|ótimo|perfeito|maravilha|top|bora|show|incrível|massa|demais/i,
    style: 'Manter energia, acelerar processo, aproveitar o momento',
  },
  price_sensitive: {
    pattern: /caro|valor|preço|quanto custa|custo|pagar|dinheiro|grana|investimento|orçamento/i,
    style: 'Focar em ROI e valor, sem passar valores por mensagem, pedir contexto antes',
  },
  ready: {
    pattern: /agendar|marcar|quando|horário|dia|disponível|vamos fazer|fechar|contratar/i,
    style: 'Ir direto ao agendamento, não enrolar, capturar compromisso',
  },
  curious: {
    pattern: /como funciona|o que é|explica|me conta|quero saber|entender|conhecer/i,
    style: 'Explicar simples, usar exemplos, despertar interesse',
  },
};

function detectEmotion(message: string): { emotion: string; style: string } {
  const msg = (message || '').toLowerCase();
  for (const [emotion, config] of Object.entries(EMOTION_PATTERNS)) {
    if ((config as any).pattern.test(msg)) {
      return { emotion, style: (config as any).style };
    }
  }
  return { emotion: 'neutral', style: 'Descobrir mais sobre a pessoa, fazer perguntas abertas' };
}

// ============================================
// DETECÇÃO DE INTENÇÃO (HEURÍSTICA) - V2
// ============================================
const INTENTION_PATTERNS: Record<Intention, RegExp> = {
  primeiro_contato: /oi|olá|e aí|bom dia|boa tarde|boa noite|tudo bem|quem é|prazer|primeira vez|conheci|vim do/i,
  cliente_bravo: /reclama|insatisfeito|péssimo|horrível|não gostei|não funciona|problema|quero cancelar|raiva|irritado|enganado|golpe|suporte/i,
  orcamento: /preço|valor|quanto custa|orçamento|plano|investimento|mensalidade|quanto fica|cotação/i,
  agendamento: /agendar|marcar|reunião|call|quando|horário|dia|agenda|disponível/i,
  curiosidade: /como funciona|o que é|explica|me conta|quero saber|entender|conhecer/i,
  outros: /.^/
};

function detectIntention(message: string, emotion: string): Intention {
  const msg = (message || '').toLowerCase();

  if (emotion === 'frustrated' || emotion === 'skeptical') {
    if (INTENTION_PATTERNS.cliente_bravo.test(msg)) return 'cliente_bravo';
  }

  if (INTENTION_PATTERNS.orcamento.test(msg)) return 'orcamento';
  if (INTENTION_PATTERNS.agendamento.test(msg)) return 'agendamento';
  if (INTENTION_PATTERNS.curiosidade.test(msg)) return 'curiosidade';
  if (INTENTION_PATTERNS.primeiro_contato.test(msg)) return 'primeiro_contato';
  if (INTENTION_PATTERNS.cliente_bravo.test(msg)) return 'cliente_bravo';

  return 'outros';
}

// ============================================
// HUMANIZAÇÃO: MESSAGE PLAN + STAGE/EMOTION MODES + CHUNKS
// ============================================
type MessagePlanItem =
  | { type: 'typing'; action: 'start' | 'stop'; delayMs: number }
  | { type: 'text'; text: string; delayMs: number };

type MessagePlan = {
  items: MessagePlanItem[];
  bubbles: string[];
  meta: {
    intention: Intention;
    emotion: string;
    stage: string;
    mode: ResponseMode;
  };
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizeWhitespace(text: string): string {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function splitIntoSentences(text: string): string[] {
  const t = normalizeWhitespace(text);
  if (!t) return [];
  const parts = t.split(/(?<=[.!?])\s+/).map(p => p.trim()).filter(Boolean);
  return parts.length ? parts : [t];
}

function stripTooManyEmojis(text: string, maxEmojis = 1): string {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const matches = text.match(emojiRegex) || [];
  if (matches.length <= maxEmojis) return text;

  let removeCount = matches.length - maxEmojis;
  return text.replace(emojiRegex, (m) => {
    if (removeCount <= 0) return m;
    removeCount--;
    return '';
  }).replace(/\s{2,}/g, ' ').trim();
}

function ensureQuestionAtEnd(text: string, fallbackQuestion: string): string {
  const t = (text || '').trim();
  if (!t) return fallbackQuestion;
  if (t.includes('?')) return t;
  return `${t}\n\n${fallbackQuestion}`;
}

function normalizeStage(stage: string): 'cold' | 'warm' | 'hot' | 'unknown' {
  const s = String(stage || '').toLowerCase();
  if (s.includes('cold')) return 'cold';
  if (s.includes('warm')) return 'warm';
  if (s.includes('hot')) return 'hot';
  return 'unknown';
}

function emotionDelayMultiplier(emotion: string, cfg: any): number {
  const e = String(emotion || '').toLowerCase();
  if (e === 'anxious') return cfg?.anxiousMultiplier ?? 0.6;
  if (e === 'skeptical') return cfg?.skepticalMultiplier ?? 1.15;
  if (e === 'frustrated') return cfg?.frustratedMultiplier ?? 1.0;
  if (e === 'excited') return cfg?.excitedMultiplier ?? 0.9;
  return 1.0;
}

function calcDelayMs(
  text: string,
  cfg: { base: number; perChar: number; cap: number },
  multiplier = 1.0
): number {
  const t = (text || '').trim();
  if (!t) return Math.round(cfg.base * multiplier);

  const raw = cfg.base + t.length * cfg.perChar;
  const clamped = clamp(raw, cfg.base, cfg.cap);
  return Math.round(clamped * multiplier);
}

function pickModeV2(intention: Intention, emotion: string, stage: string): ResponseMode {
  const st = normalizeStage(stage);
  const e = String(emotion || '').toLowerCase();

  if (intention === 'primeiro_contato') return 'FIRST_CONTACT';
  if (intention === 'cliente_bravo') return 'BRAVO';
  if (intention === 'orcamento') return 'BUDGET';

  if (st === 'hot') return 'HOT_CTA';
  if (e === 'skeptical') return 'SKEPTICAL';
  if (e === 'anxious' || intention === 'agendamento') return 'SINGLE';

  return 'TWO_BUBBLES';
}

function buildBubblesFromAIText(aiText: string, mode: ResponseMode, hz: HumanizerConfig): string[] {
  const cleaned = normalizeWhitespace(aiText);
  if (!cleaned) return ['Perfeito! Me conta rapidinho: qual seu objetivo hoje? 😊'];

  // Templates por intenção/mode
  if (mode === 'FIRST_CONTACT') return hz.intentModes.primeiro_contato.templates.slice(0, 2);
  if (mode === 'BRAVO') return hz.intentModes.cliente_bravo.templates.slice(0, 2);
  if (mode === 'BUDGET') return hz.intentModes.orcamento.templates.slice(0, 2);

  if (mode === 'SKEPTICAL') {
    return [
      'Totalmente justo desconfiar.',
      'Se você quiser, eu te mando um exemplo real rapidinho — quer ver?'
    ];
  }

  if (mode === 'HOT_CTA') {
    return [
      'Fechado! 🚀',
      'Bora marcar 15 min pra eu te mostrar o caminho? Hoje ou amanhã?'
    ];
  }

  const sentences = splitIntoSentences(cleaned);

  if (mode === 'SINGLE') {
    const one = sentences.slice(0, 2).join(' ');
    return [stripTooManyEmojis(one, hz.maxEmojiPerBubble)];
  }

  const first = sentences.slice(0, 2).join(' ');
  const rest = sentences.slice(2).join(' ').trim();

  let b1 = stripTooManyEmojis(first, hz.maxEmojiPerBubble);
  let b2 = stripTooManyEmojis(rest || '', hz.maxEmojiPerBubble);

  if (!b2) b2 = 'Me conta um pouco do seu cenário?';

  b2 = ensureQuestionAtEnd(b2, 'Qual é sua meta principal hoje?');

  return [b1, b2].filter(Boolean);
}

function enforceBubbleRules(
  bubbles: string[],
  cfg: { maxBubbles: number; maxSentencesPerBubble: number; maxEmojiPerBubble: number }
): string[] {
  let b = (bubbles || []).map(normalizeWhitespace).filter(Boolean);

  if (b.length > cfg.maxBubbles) b = b.slice(0, cfg.maxBubbles);

  b = b.map((bubble) => {
    const sentences = splitIntoSentences(bubble);
    const short = sentences.slice(0, cfg.maxSentencesPerBubble).join(' ');
    return stripTooManyEmojis(short, cfg.maxEmojiPerBubble);
  });

  return b;
}

function applyStageAndEmotionTweaks(bubbles: string[], stage: string, emotion: string): string[] {
  const st = normalizeStage(stage);
  const e = String(emotion || '').toLowerCase();
  const b = [...bubbles];

  if (e === 'anxious') {
    const last = b[b.length - 1] || '';
    b[b.length - 1] = ensureQuestionAtEnd(
      last.replace(/\n+/g, ' ').trim(),
      'Me diz em 1 frase o que você precisa agora?'
    );
  }

  if (e === 'skeptical') {
    if (b[0]) b[0] = `${b[0]}\n\nSem promessas mágicas — a gente costuma mostrar exemplo real antes.`;
    const last = b[b.length - 1] || '';
    b[b.length - 1] = ensureQuestionAtEnd(last, 'Quer que eu te mande um exemplo rápido?');
  }

  if (st === 'hot') {
    const last = b[b.length - 1] || '';
    b[b.length - 1] = ensureQuestionAtEnd(
      last,
      'Bora marcar 15 min pra eu te mostrar o caminho? Hoje ou amanhã?'
    );
  }

  if (st === 'cold') {
    const last = b[b.length - 1] || '';
    b[b.length - 1] = ensureQuestionAtEnd(last, 'Me conta rapidinho seu cenário?');
  }

  return b;
}

function buildMessagePlanV2(
  bubbles: string[],
  meta: MessagePlan['meta'],
  delayCfg: { base: number; perChar: number; cap: number },
  delayMultiplier: number
): MessagePlan {
  const items: MessagePlanItem[] = [];

  for (let i = 0; i < bubbles.length; i++) {
    const text = bubbles[i];
    const delayMs = calcDelayMs(text, delayCfg, delayMultiplier);

    items.push({ type: 'typing', action: 'start', delayMs: i === 0 ? 0 : 250 });
    items.push({ type: 'text', text, delayMs });
    items.push({ type: 'typing', action: 'stop', delayMs: 0 });
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
  config: any;

  constructor(config: any) {
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

      // Humanizer config V3 (default) — depois substitui pelo Supabase runtime
      humanizer: mergeHumanizerConfig(DEFAULT_HUMANIZER_CONFIG, config?.humanizer || {}),
    };

    logger.agent('Response Agent initialized', {
      tone: this.config.tone,
      maxContext: this.config.maxContextMessages,
      humanizer: this.config.humanizer,
    });
  }

  async processMessage(phone: string, chatId: string, userMessage: string): Promise<any> {
    const timer = logger.startTimer('Response Agent - Process Message');

    try {
      // ✅ V3: carrega config do Supabase (cache TTL)
      // Isso permite o dashboard controlar o humanizer sem deploy
      try {
        const remoteHumanizer = await getHumanizerConfigFromDB_FIXED();
        this.config.humanizer = remoteHumanizer;
      } catch (e) {
        // fallback silencioso
      }

      // 0) Detectar emoção
      const emotionData = detectEmotion(userMessage);
      logger.agent('Emotion detected', emotionData);

      // 0.1) Detectar intenção
      const intention: Intention = this.config.enableIntentDetection
        ? detectIntention(userMessage, emotionData.emotion)
        : 'outros';

      logger.agent('Intention detected', { intention });

      // 1) Buscar ou criar conversa
      const conversation = await supabaseService.getOrCreateConversation(phone, chatId);

      // 2) Salvar mensagem do usuário
      await supabaseService.addMessage(conversation.id, {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
        metadata: {
          emotion: emotionData.emotion,
          intention,
        }
      } as any);

      // 3) Salvar evento de emoção
      try {
        const lead = await supabaseService.getLeadByPhone(phone);

        if (lead) {
          await emotionService.saveEmotionEvent({
            conversation_id: conversation.id,
            lead_id: lead.id,
            emotion: emotionData.emotion as any,
            message_content: userMessage,
            confidence: 0.8,
            metadata: {
              source: "response.agent",
              model: "heuristic",
            },
          });

          emotionService.updateLeadMetrics(lead.id).catch(err => {
            logger.error('Failed to update lead metrics', err, 'AGENT');
          });
        } else {
          const newLead = await supabaseService.createLead({
            phone,
            source: 'whatsapp',
            status: 'new'
          });

          if (newLead) {
            await emotionService.saveEmotionEvent({
              conversation_id: conversation.id,
              lead_id: newLead.id,
              emotion: emotionData.emotion as any,
              message_content: userMessage,
              confidence: 0.8,
              metadata: {
                source: "response.agent",
                model: "heuristic",
              },
            });
          }
        }
      } catch (error) {
        logger.error('Failed to save emotion', error, 'AGENT');
      }

      // 4) Atualizar status da conversa
      await supabaseService.updateConversationStatus(conversation.id, 'active');

      // 5) Verificar escalação
      const escalationCheck = this.checkEscalation(userMessage);
      if (escalationCheck.shouldEscalate) {
        await supabaseService.updateConversationStatus(conversation.id, 'waiting_response');

        const escalationText = this.getEscalationResponse(escalationCheck.reason || "Escalação");

        const lead = conversation.phone ? await supabaseService.getLeadByPhone(conversation.phone) : null;
        const stage = lead?.stage || 'unknown';

        const escalationPlan = this.createResponsePlan({
          aiText: escalationText,
          intention,
          emotion: emotionData.emotion,
          stage,
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
        };
      }

      // 6) Gerar resposta com IA
      const responseText = await this.generateResponse(conversation, userMessage, emotionData);

      // stage
      const lead = conversation.phone ? await supabaseService.getLeadByPhone(conversation.phone) : null;
      const stage = lead?.stage || 'unknown';

      // 6.1) Gerar plano (bolhas + typing + delays)
      const responsePlan = this.createResponsePlan({
        aiText: responseText,
        intention,
        emotion: emotionData.emotion,
        stage,
      });

      logger.agent('Response plan created', {
        bubbles: responsePlan.bubbles,
        meta: responsePlan.meta,
      });

      // 7) Salvar resposta principal
      const savedAssistantMessage = await supabaseService.addMessage(conversation.id, {
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        metadata: {
          emotion: emotionData.emotion,
          intention,
          stage,
          plan_mode: responsePlan.meta.mode,
          bubbles_count: responsePlan.bubbles.length,
        }
      } as any);

      // 7.1) Salvar chunks no DB (para dashboard/replay)
      if (this.config.humanizer.saveChunksToDB && savedAssistantMessage?.id && responsePlan?.items?.length) {
        try {
          const messageId = savedAssistantMessage.id;

          const rows: Array<{
            conversation_id: string;
            message_id: string;
            chunk_index: number;
            kind: string;
            action: string | null;
            content: string | null;
            delay_ms: number;
            emotion: string;
            intention: Intention;
            stage: string;
            mode: ResponseMode;
            created_at: string;
          }> = responsePlan.items
            .filter((item: any) => {
              if (item.type === 'typing') return !!this.config.humanizer.saveTypingChunks;
              return true;
            })
            .map((item: any, idx: number) => {
              if (item.type === 'typing') {
                return {
                  conversation_id: conversation.id,
                  message_id: messageId,
                  chunk_index: idx,
                  kind: 'typing',
                  action: item.action,
                  content: null as string | null,
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
                kind: 'text',
                action: null as string | null,
                content: item.text,
                delay_ms: item.delayMs,
                emotion: responsePlan.meta.emotion,
                intention: responsePlan.meta.intention,
                stage: responsePlan.meta.stage,
                mode: responsePlan.meta.mode,
                created_at: new Date().toISOString(),
              };
            });

          await supabaseService.request('POST', 'message_chunks', { body: rows } as any);
        } catch (err) {
          logger.error('Failed to save message chunks', err, 'AGENT');
        }
      } else if (this.config.humanizer.saveChunksToDB && !savedAssistantMessage?.id) {
        logger.error('Assistant message ID missing; cannot link chunks', undefined, 'AGENT');
      }

      timer();

      return {
        response: responseText,
        responsePlan,
        shouldEscalate: false,
        emotion: emotionData.emotion,
        intention,
        stage,
      };
    }
    catch (error) {
      logger.error('Error processing message', error, 'AGENT');
      throw error;
    }
  }

  async generateResponse(conversation: any, userMessage: string, emotionData: any): Promise<string> {
    const recentMessages = await supabaseService.getRecentMessages(conversation.id, this.config.maxContextMessages);

    const aiMessages = recentMessages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    const systemPrompt = await this.buildSystemPrompt(conversation, emotionData, userMessage);

    const response = await aiService.chat(userMessage, systemPrompt, aiMessages);

    return normalizeWhitespace(response);
  }

  async buildSystemPrompt(conversation: any, emotionData: any, userMessage: string): Promise<string> {
    const lead = conversation.phone ? await supabaseService.getLeadByPhone(conversation.phone) : null;

    let prompt = await getPromptFromDB();

    prompt += `\n\n---\n## 🎭 CONTEXTO ATUAL DA CONVERSA\n`;
    prompt += `**Emoção detectada:** ${emotionData.emotion.toUpperCase()}\n`;
    prompt += `**Como responder:** ${emotionData.style}\n`;

    if (lead?.name) prompt += `\n**Cliente:** ${lead.name}`;
    if (lead?.stage) prompt += `\n**Stage no Funil:** ${lead.stage}`;
    if (lead?.health_score) prompt += `\n**Health Score:** ${lead.health_score}/100`;

    prompt += `\n\n---\n## ✅ REGRAS DE RESPOSTA (WHATSAPP)\n`;
    prompt += `- Responda curto e humano (1 a 4 frases)\n`;
    prompt += `- Evite textão e linguagem corporativa\n`;
    prompt += `- Faça no máximo 1 pergunta por resposta\n`;
    prompt += `- Emojis com moderação (0-1 por resposta)\n`;
    prompt += `- Não passe preços por mensagem. Peça contexto e ofereça call rápida\n`;
    prompt += `- Se a pessoa estiver brava: valide e resolva sem justificar demais\n`;

    if (this.config.businessInfo) {
      prompt += `\n\nInformações adicionais:\n${this.config.businessInfo}`;
    }

    const faqContent = await getRelevantFAQs(userMessage);
    if (faqContent) prompt += faqContent;

    return prompt;
  }

  createResponsePlan(params: { aiText: string; intention: Intention; emotion: string; stage: string }): MessagePlan {
    const { aiText, intention, emotion, stage } = params;

    const hz: HumanizerConfig = mergeHumanizerConfig(DEFAULT_HUMANIZER_CONFIG, this.config.humanizer);

    const mode = pickModeV2(intention, emotion, stage);

    let bubbles = buildBubblesFromAIText(aiText, mode, hz);
    bubbles = applyStageAndEmotionTweaks(bubbles, stage, emotion);

    const st = normalizeStage(stage);
    const stageCfg = (hz.stageBehavior as any)?.[st] || null;

    bubbles = enforceBubbleRules(bubbles, {
      maxBubbles: stageCfg?.maxBubbles ?? hz.maxBubbles,
      maxSentencesPerBubble: hz.maxSentencesPerBubble,
      maxEmojiPerBubble: hz.maxEmojiPerBubble,
    });

    if (!bubbles.some(b => b.includes('?'))) {
      bubbles[bubbles.length - 1] = ensureQuestionAtEnd(
        bubbles[bubbles.length - 1],
        'Me conta rapidinho seu cenário?'
      );
    }

    const multiplier = emotionDelayMultiplier(emotion, hz.delay);

    return buildMessagePlanV2(
      bubbles,
      { intention, emotion, stage, mode },
      hz.delay,
      multiplier
    );
  }

  checkEscalation(message: string): { shouldEscalate: boolean; reason?: string } {
    const lowerMessage = (message || '').toLowerCase();
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

  getEscalationResponse(_reason: string): string {
    return `Entendi! Vou te passar pro atendimento direto. Um momento que já te chamo. 👋`;
  }

  setSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt;
  }

  setBusinessInfo(info: string): void {
    this.config.businessInfo = info;
  }
}

export const responseAgent = new ResponseAgent({});
