// src/mock/demos/default/data.ts
import type {
  DemoConversation,
  DemoEmotionEvent,
  DemoLead,
  DemoMessage,
  DemoStats,
  DemoData,
} from "../../types";

/**
 * DEMO PREMIUM - DEFAULT (GENÉRICA DOCA)
 * 100 conversas + dataset realista
 *
 * Objetivo:
 * - parecer um SaaS premium de verdade
 * - ter cenários variados
 * - alimentar funil e matriz com consistência
 */

// -----------------------------
// helpers
// -----------------------------
function isoAgo(mins: number) {
  const d = new Date(Date.now() - mins * 60 * 1000);
  return d.toISOString();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pick<T>(arr: T[], seed: number) {
  return arr[seed % arr.length];
}

function phoneBR(seed: number) {
  const ddd = pick([11, 21, 31, 41, 51, 61, 71, 81, 85, 19, 27], seed);
  const base = (900000000 + (seed * 7919) % 99999999).toString();
  return `55${ddd}${base.slice(0, 9)}`;
}

// Emoções internas (dominant_emotion)
const EMOTIONS = [
  "ready",
  "excited",
  "curious",
  "neutral",
  "price_sensitive",
  "skeptical",
  "frustrated",
  "anxious",
] as const;

const EMOTION_TO_STAGE: Record<string, string> = {
  ready: "pronto",
  excited: "empolgado",
  curious: "curioso",
  neutral: "curioso",
  price_sensitive: "sensível_preço",
  skeptical: "cético",
  frustrated: "frustrado",
  anxious: "curioso",
};

const EMOTION_TO_URGENCY: Record<string, DemoLead["urgency_level"]> = {
  ready: "high",
  excited: "high",
  curious: "normal",
  neutral: "normal",
  price_sensitive: "normal",
  skeptical: "low",
  frustrated: "critical",
  anxious: "high",
};

const EMOTION_TO_HEALTH: Record<string, number> = {
  ready: 88,
  excited: 76,
  curious: 58,
  neutral: 50,
  price_sensitive: 62,
  skeptical: 36,
  frustrated: 24,
  anxious: 54,
};

const EMOTION_TO_CONV: Record<string, number> = {
  ready: 0.85,
  excited: 0.7,
  curious: 0.4,
  neutral: 0.35,
  price_sensitive: 0.5,
  skeptical: 0.2,
  frustrated: 0.15,
  anxious: 0.55,
};

// Nomes e segmentos (genérico)
const NAMES = [
  "Marcos Andrade",
  "Fernanda Lima",
  "Ricardo Souza",
  "Juliana Torres",
  "Bruno Oliveira",
  "Patrícia Mendes",
  "Thiago Rocha",
  "Carla Ribeiro",
  "Eduardo Pires",
  "Sérgio Lopes",
  "Paula Siqueira",
  "Camila Nunes",
  "Rafael Santos",
  "Beatriz Almeida",
  "Gustavo Martins",
  "Ana Clara",
  "João Pedro",
  "Larissa Costa",
  "Felipe Moraes",
  "Renata Silva",
  "Diego Ferreira",
  "Mônica Batista",
  "Letícia Melo",
  "Igor Ribeiro",
  "Vinícius Azevedo",
  "Daniela Barbosa",
  "Vitor Hugo",
  "Helena Campos",
  "Rodrigo Lima",
  "Nathalia Souza",
];

const SEGMENTS = [
  "clínica",
  "imobiliária",
  "ecommerce",
  "consultoria",
  "advocacia",
  "curso_online",
  "academia",
  "franquia",
  "restaurante",
  "estética",
  "contabilidade",
  "autoescola",
  "saas",
  "serviços",
];

const TAGS_BY_EMOTION: Record<string, string[]> = {
  ready: ["alto_ticket", "quente", "fechamento"],
  excited: ["agenda", "curioso", "demonstrou_interesse"],
  curious: ["dúvida", "comparando", "quer_entender"],
  neutral: ["lead_novo", "primeiro_contato"],
  price_sensitive: ["preço", "parcelamento", "ROI"],
  skeptical: ["cético", "prova_social", "confiança"],
  frustrated: ["reclamação", "frustrado", "urgente"],
  anxious: ["urgente", "ansioso", "pra_hoje"],
};

const OBJECTIONS = [
  "Tá, mas quanto custa?",
  "Funciona mesmo ou é só robô?",
  "Dá pra integrar com meu CRM?",
  "Tenho medo de ficar impessoal",
  "Quero parcelamento",
  "Preciso falar com um humano",
  "Quero ver cases",
  "Tenho pressa",
  "Minha equipe é pequena",
  "Já testei algo parecido e não deu certo",
];

const AGENT_STYLE = [
  "Perfeito. Vou te ajudar agora.",
  "Totalmente justo. Vamos comparar certinho.",
  "Entendo 100%. Posso te mostrar na prática.",
  "Boa. Me diz só 2 coisas e eu te retorno com um plano.",
  "Fechado. Vou te mandar em 1 minuto.",
];

const OUTCOMES: DemoLead["status"][] = ["active", "active", "active", "won", "lost"];
// pesa pra maioria active

// -----------------------------
// base dataset builder
// -----------------------------
const leads: DemoLead[] = [];
const conversations: DemoConversation[] = [];
const messages: DemoMessage[] = [];
const emotionEvents: DemoEmotionEvent[] = [];

function addMessages(conversationId: string, seed: number, emotion: string) {
  // cada conversa: 5 a 9 mensagens
  const count = 5 + (seed % 5);

  const name = leads.find((l) => `conv-${l.id.split("-")[1]}` === conversationId)?.name;

  // tempo “vivo”
  const baseAgo = 15 + (seed % 600); // 15 min a 10h atrás
  const spacing = 2 + (seed % 5);

  const objection = pick(OBJECTIONS, seed);
  const agentTone = pick(AGENT_STYLE, seed + 3);
  const segment = pick(SEGMENTS, seed + 7);

  // lead abre
  messages.push({
    id: `msg-${conversationId}-1`,
    conversation_id: conversationId,
    from: "lead",
    text:
      emotion === "ready"
        ? "Boa! Quero fechar hoje. Me manda valores e como funciona o onboarding?"
        : emotion === "frustrated"
        ? "Ninguém me responde. Tô desde ontem tentando. Isso tá uma bagunça."
        : emotion === "skeptical"
        ? "Já tentei automação antes e ficou robótico. Não acredito que funcione."
        : emotion === "price_sensitive"
        ? "Tá, mas quanto custa? Vi uma solução por metade do preço..."
        : emotion === "anxious"
        ? "Preciso disso HOJE senão perco os leads. Consegue me ajudar agora?"
        : emotion === "excited"
        ? "Gostei MUITO! Dá pra testar e marcar uma call?"
        : emotion === "neutral"
        ? "Oi, vi vocês no Instagram. Como funciona?"
        : `Oi! Tenho uma dúvida: ${objection}`,
    created_at: isoAgo(baseAgo + spacing * (count - 1)),
  });

  // agente responde
  messages.push({
    id: `msg-${conversationId}-2`,
    conversation_id: conversationId,
    from: "agent",
    text:
      emotion === "frustrated"
        ? "Você tá certo. Desculpa mesmo. Já vou te atender agora. Me diz: qual seu objetivo principal?"
        : emotion === "skeptical"
        ? "Totalmente justo. Posso te mostrar 2 cases e te dar um teste assistido pra ver na prática."
        : `${agentTone} Me diz: qual seu segmento (${segment}) e quantos leads/mês você recebe?`,
    created_at: isoAgo(baseAgo + spacing * (count - 2)),
  });

  // lead detalha
  messages.push({
    id: `msg-${conversationId}-3`,
    conversation_id: conversationId,
    from: "lead",
    text:
      emotion === "ready"
        ? "Tenho 3 atendentes e uns 1500 leads/mês. Preciso rodar ainda hoje."
        : emotion === "price_sensitive"
        ? "2 atendentes, uns 800 leads/mês. Se tiver parcelamento ajuda."
        : emotion === "curious"
        ? "Tenho 1 atendente e uns 400 leads/mês. Uso Pipedrive e WhatsApp."
        : emotion === "anxious"
        ? "Tenho tráfego rodando e tô perdendo lead. Preciso configurar agora."
        : "Tenho 1 atendente e por volta de 300 leads/mês.",
    created_at: isoAgo(baseAgo + spacing * (count - 3)),
  });

  // agente propõe
  messages.push({
    id: `msg-${conversationId}-4`,
    conversation_id: conversationId,
    from: "agent",
    text:
      emotion === "ready"
        ? "Perfeito. Te mando Pro + onboarding. Quer mensal ou anual com desconto? Posso liberar implantação hoje."
        : emotion === "price_sensitive"
        ? "Fechado. Te mando 2 opções: mensal e anual parcelado. Também mando simulação de ROI."
        : emotion === "curious"
        ? "Perfeito. Integra via webhook + API. O treinamento é guiado (FAQ + objeções + scripts). Quer que eu mande o passo a passo?"
        : emotion === "anxious"
        ? "Consigo sim. Em 3 passos: 1) conectar WhatsApp 2) ativar IA 3) ligar o funil. Me diz se você já tem número ativo no WhatsApp."
        : "Perfeito. Vou te mandar um plano em 1 minuto com próximos passos + estimativa de resultados.",
    created_at: isoAgo(baseAgo + spacing * (count - 4)),
  });

  // quinta e demais mensagens variam
  for (let i = 5; i <= count; i++) {
    const from = i % 2 === 1 ? "lead" : "agent";

    const t =
      from === "lead"
        ? emotion === "ready"
          ? i === count
            ? "Manda contrato e link de pagamento. Vamos."
            : "Beleza, pode ser anual."
          : emotion === "skeptical"
          ? "Tá, mas quero ver prova social e não quero ficar impessoal."
          : emotion === "frustrated"
          ? "Quero resolver rápido. Pode me ligar?"
          : emotion === "price_sensitive"
          ? "Se fizer sentido no ROI eu fecho."
          : emotion === "anxious"
          ? "Sim, o número já está ativo."
          : emotion === "excited"
          ? "Qual horário pra call?"
          : "Ok, manda detalhes."
        : emotion === "ready"
        ? "Fechado. Vou te mandar contrato + link e já deixo o onboarding pronto."
        : emotion === "frustrated"
        ? "Pode deixar. Vou te chamar no suporte humano agora e acompanhar até resolver."
        : emotion === "skeptical"
        ? "Combinado. Te mando 2 cases + vídeo curto e você testa 7 dias com suporte humano junto."
        : emotion === "price_sensitive"
        ? "Perfeito. Te mando comparativo + ROI e condições de parcelamento."
        : emotion === "anxious"
        ? "Top. Vamos conectar agora: me confirma seu e-mail pra envio do onboarding."
        : emotion === "excited"
        ? "09:30 ou 10:00 amanhã? Te mando o link."
        : "Fechado. Te mando agora.";

    messages.push({
      id: `msg-${conversationId}-${i}`,
      conversation_id: conversationId,
      from,
      text: t,
      created_at: isoAgo(baseAgo + spacing * (count - i)),
    });
  }

  // evento emocional (1 por conversa, + alguns extras)
  const lead = leads[seed];
  if (lead) {
    emotionEvents.push({
      id: `evt-${conversationId}`,
      lead_id: lead.id,
      conversation_id: conversationId,
      emotion,
      confidence: clamp(0.72 + (seed % 28) / 100, 0.72, 0.98),
      detected_at: isoAgo(baseAgo + 2),
      text_excerpt: objection,
    });

    // extra: conversas mais “quentes” ganham 2 eventos
    if (emotion === "ready" || emotion === "excited" || emotion === "frustrated") {
      emotionEvents.push({
        id: `evt-${conversationId}-2`,
        lead_id: lead.id,
        conversation_id: conversationId,
        emotion,
        confidence: clamp(0.78 + (seed % 18) / 100, 0.78, 0.99),
        detected_at: isoAgo(baseAgo + 1),
        text_excerpt:
          emotion === "ready"
            ? "quero fechar hoje"
            : emotion === "frustrated"
            ? "ninguém responde"
            : "gostei muito",
      });
    }
  }
}

// -----------------------------
// Build 100 leads + 100 conversations
// -----------------------------
for (let i = 1; i <= 100; i++) {
  const idx = i - 1;

  const emotion = pick([...EMOTIONS], idx * 7 + 3);
  const stage = EMOTION_TO_STAGE[emotion];
  const urgency_level = EMOTION_TO_URGENCY[emotion];
  const baseHealth = EMOTION_TO_HEALTH[emotion];
  const baseConv = EMOTION_TO_CONV[emotion];

  const outcome = pick(OUTCOMES, idx * 5 + 1);

  // Alguns leads fechados/perdidos: ajuste
  let status: DemoLead["status"] = outcome;
  let health_score = baseHealth + ((idx % 9) - 4);
  let conversion_probability = baseConv + ((idx % 7) - 3) * 0.02;

  if (status === "won") {
    health_score = clamp(health_score + 10, 75, 96);
    conversion_probability = clamp(conversion_probability + 0.2, 0.6, 0.95);
  }
  if (status === "lost") {
    health_score = clamp(health_score - 12, 10, 45);
    conversion_probability = clamp(conversion_probability - 0.2, 0.01, 0.3);
  }

  const name = idx % 11 === 0 ? null : pick(NAMES, idx * 3 + 2);
  const phone = phoneBR(idx + 11);

  const created_at = isoAgo(60 * 24 * (1 + (idx % 14)) + (idx % 120));
  const updated_at = isoAgo(5 + (idx % 350));

  const segment = pick(SEGMENTS, idx + 8);

  const lead: DemoLead = {
    id: `lead-${String(i).padStart(3, "0")}`,
    phone,
    name,
    email: name ? `${name.split(" ")[0].toLowerCase()}@empresa.com.br` : null,
    source: "whatsapp",
    score: clamp(Math.round(health_score + conversion_probability * 20), 0, 100),
    status,
    tags: Array.from(new Set([...TAGS_BY_EMOTION[emotion], segment])),
    custom_fields: {
      segmento: segment,
      cidade: pick(["SP", "RJ", "BH", "Curitiba", "Campinas", "Salvador", "Fortaleza"], idx),
      crm: idx % 3 === 0 ? "Pipedrive" : idx % 3 === 1 ? "HubSpot" : "Planilha",
    },
    created_at,
    updated_at,
    emotion_profile: { dominant_emotion: emotion },
    health_score: clamp(health_score, 0, 100),
    stage,
    urgency_level,
    conversion_probability: clamp(conversion_probability, 0, 1),
  };

  leads.push(lead);

  const convId = `conv-${String(i).padStart(3, "0")}`;

  const conv: DemoConversation = {
    id: convId,
    lead_id: lead.id,
    phone: `${phone}@c.us`,
    name,
    status: status === "won" || status === "lost" ? "closed" : "open",
    created_at,
    updated_at,
    current_emotion: emotion,
    temperature: clamp(lead.health_score, 0, 100),
    tags: lead.tags,
    last_message: "",
  };

  conversations.push(conv);

  addMessages(convId, idx, emotion);
}

// seta last_message coerente
for (const conv of conversations) {
  const last = [...messages]
    .filter((m) => m.conversation_id === conv.id)
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0];
  if (last) conv.last_message = last.text;
}

// -----------------------------
// Stats (consistente com o dataset)
// -----------------------------
function buildStats(): DemoStats {
  const total = leads.length;

  const avgHealth =
    leads.reduce((acc, l) => acc + (l.health_score || 0), 0) / (total || 1);

  const avgTemp =
    conversations.reduce((acc, c) => acc + (c.temperature || 0), 0) /
    (conversations.length || 1);

  const stage_distribution: Record<string, number> = {};
  const urgency_distribution: Record<string, number> = {};

  for (const l of leads) {
    const stage = l.stage || "curioso";
    stage_distribution[stage] = (stage_distribution[stage] || 0) + 1;

    const urg = l.urgency_level || "normal";
    urgency_distribution[urg] = (urgency_distribution[urg] || 0) + 1;
  }

  return {
    total_leads: total,
    avg_health_score: Math.round(avgHealth),
    avg_temperature: Math.round(avgTemp),
    stage_distribution,
    urgency_distribution,
    total_emotion_events: emotionEvents.length,
  };
}

export function getDemo(): DemoData {
  return {
    stats: buildStats(),
    leads,
    conversations,
    messages,
    emotionEvents,
  };
}
