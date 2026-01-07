export type Msg = {
  id: string;
  conversation_id: string;
  from: "lead" | "agent" | string;
  text: string;
  created_at: string;
};

export type Conv = {
  id: string;
  lead_id?: string;
  phone?: string;
  name?: string | null;
  status?: "open" | "closed" | string;
  updated_at?: string;
  created_at?: string;
  last_message?: string;
  current_emotion?: string;
  temperature?: number;
  tags?: string[];
};

export type Lead = {
  id: string;
  phone: string;
  name: string | null;
  health_score: number;
  stage: string;
  urgency_level: "low" | "normal" | "high" | "critical";
  conversion_probability: number;
  tags?: string[];
  updated_at?: string;
};

export type FollowUp = {
  id: string;
  title: string;
  goal: string;
  timing: string;
  text: string;
  tags: string[];
};

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildConversationSummary(messages: Msg[]) {
  const joined = messages
    .slice(-12)
    .map((m) => `${m.from === "lead" ? "Cliente" : "Agente"}: ${m.text}`)
    .join("\n");

  const text = joined.toLowerCase();
  const objections: string[] = [];

  if (text.includes("caro") || text.includes("preço") || text.includes("valor"))
    objections.push("Preço / orçamento");
  if (text.includes("não acredito") || text.includes("robô") || text.includes("funciona"))
    objections.push("Ceticismo / confiança");
  if (text.includes("integr") || text.includes("api") || text.includes("crm"))
    objections.push("Integração / técnico");
  if (text.includes("ninguém responde") || text.includes("demora") || text.includes("bagunça"))
    objections.push("Experiência / frustração");
  if (text.includes("urgente") || text.includes("hoje") || text.includes("agora"))
    objections.push("Urgência");

  const intent =
    text.includes("fechar") || text.includes("contrato") || text.includes("pagamento")
      ? "Fechamento / compra"
      : text.includes("call") || text.includes("reunião") || text.includes("agenda")
      ? "Agendamento"
      : text.includes("como funciona") || text.includes("dá pra") || text.includes("integr")
      ? "Dúvida / qualificação"
      : text.includes("caro") || text.includes("preço") || text.includes("valor")
      ? "Comparação de preço"
      : "Atendimento / triagem";

  const nextStep =
    intent === "Fechamento / compra"
      ? "Enviar proposta + link e confirmar dados"
      : intent === "Agendamento"
      ? "Sugerir 2 horários e enviar link"
      : intent === "Comparação de preço"
      ? "Ancorar ROI + oferecer 2 opções (mensal/anual)"
      : "Perguntas rápidas de qualificação + prova social";

  return {
    intent,
    objections: objections.length ? objections : ["—"],
    nextStep,
  };
}

export function generateFollowUps(opts: {
  lead?: Lead | null;
  conv?: Conv | null;
  messages: Msg[];
}): FollowUp[] {
  const lead = opts.lead;
  const conv = opts.conv;
  const summary = buildConversationSummary(opts.messages);

  const name = (lead?.name || conv?.name || "aí") as string;
  const stage = lead?.stage || (conv?.current_emotion ? conv?.current_emotion : "curioso");
  const urg = lead?.urgency_level || "normal";

  const baseOpeners = [
    `Oi ${name}!`,
    `Fala ${name}!`,
    `Oi, ${name} 😊`,
    `Olá ${name}! Tudo certo?`,
  ];

  const softCTA = [
    "Quer que eu te mande as opções por aqui?",
    "Posso te mostrar um caminho rápido pra isso agora?",
    "Se fizer sentido, te mando os próximos passos.",
    "Quer que eu te ajude a decidir hoje?",
  ];

  const priceFU: FollowUp[] = [
    {
      id: "fu-price-1",
      title: "Follow-up — Ancorar ROI",
      goal: "Converter objeção de preço em comparação de valor",
      timing: urg === "high" || urg === "critical" ? "Agora" : "Em 2–4h",
      text:
        `${pick(baseOpeners)} Vi que você está comparando preço. ` +
        `Pra ficar justo: com seu volume, normalmente a DOCA reduz tempo de resposta e aumenta conversão. ` +
        `Quantos leads/mês e quantos atendentes hoje? Eu simulo o ROI rapidinho.`,
      tags: ["preço", "roi", "qualificação"],
    },
    {
      id: "fu-price-2",
      title: "Follow-up — 2 opções (mensal vs anual)",
      goal: "Dar escolha e remover atrito de pagamento",
      timing: "Em 1 dia",
      text:
        `${pick(baseOpeners)} Pra facilitar, posso te mandar 2 opções: ` +
        `1) mensal (flexível) e 2) anual (com desconto). ` +
        `${pick(softCTA)}`,
      tags: ["preço", "oferta", "fechamento"],
    },
  ];

  const skepticalFU: FollowUp[] = [
    {
      id: "fu-skept-1",
      title: "Follow-up — Prova social + teste",
      goal: "Gerar confiança e reduzir risco percebido",
      timing: urg === "high" ? "Agora" : "Em 4–8h",
      text:
        `${pick(baseOpeners)} Totalmente justo ser pé no chão. ` +
        `Pra não ficar no “achismo”, eu te mostro 2 cases reais + fazemos um teste assistido. ` +
        `Qual seu maior medo: ficar robótico, errar info ou não converter?`,
      tags: ["cético", "prova_social", "teste"],
    },
    {
      id: "fu-skept-2",
      title: "Follow-up — Demonstração rápida",
      goal: "Mostrar na prática o tom humano",
      timing: "Em 1 dia",
      text:
        `${pick(baseOpeners)} Se você topar, eu faço uma demo em 10min com seu exemplo real ` +
        `(uma objeção comum do seu cliente) e você vê a resposta “humana” funcionando.`,
      tags: ["demo", "tom_de_voz", "confiança"],
    },
  ];

  const frustratedFU: FollowUp[] = [
    {
      id: "fu-frus-1",
      title: "Follow-up — Reparação + prioridade",
      goal: "Desarmar tensão e recuperar controle",
      timing: "Agora",
      text:
        `${pick(baseOpeners)} Você tem razão — isso não é experiência aceitável. ` +
        `Eu vou priorizar seu caso agora. Me diz em 1 frase o que você precisa resolver primeiro, ` +
        `e eu já te guio no passo a passo.`,
      tags: ["frustrado", "suporte", "prioridade"],
    },
    {
      id: "fu-frus-2",
      title: "Follow-up — Ação objetiva",
      goal: "Transformar emoção em ação clara",
      timing: "Em 2–4h",
      text:
        `${pick(baseOpeners)} Só pra eu não te fazer perder tempo: ` +
        `1) seu objetivo é captar leads? 2) responder rápido? 3) agendar? ` +
        `Com isso eu te mando a configuração ideal em 3 passos.`,
      tags: ["triagem", "setup", "resolver"],
    },
  ];

  const readyFU: FollowUp[] = [
    {
      id: "fu-ready-1",
      title: "Follow-up — Fechamento direto",
      goal: "Encaminhar pagamento/contrato com clareza",
      timing: "Agora",
      text:
        `${pick(baseOpeners)} Perfeito — pra fechar hoje, só preciso de 2 infos: ` +
        `1) plano (mensal/anual) e 2) CNPJ/razão social pra contrato. ` +
        `Te mando o link assim que me confirmar.`,
      tags: ["fechamento", "contrato", "pagamento"],
    },
    {
      id: "fu-ready-2",
      title: "Follow-up — Onboarding rápido",
      goal: "Diminuir atrito do pós-venda",
      timing: "Após pagamento",
      text:
        `${pick(baseOpeners)} Assim que confirmar, eu já te mando o checklist do onboarding (leva 15min) ` +
        `e em seguida a gente ativa a IA com seu tom de voz.`,
      tags: ["onboarding", "setup", "ativação"],
    },
  ];

  const curiousFU: FollowUp[] = [
    {
      id: "fu-cur-1",
      title: "Follow-up — Perguntas de qualificação",
      goal: "Entender contexto e encaixar a oferta",
      timing: urg === "high" ? "Agora" : "Em 2–6h",
      text:
        `${pick(baseOpeners)} Pra te orientar certo: ` +
        `1) qual seu tipo de negócio? 2) quantos leads/mês? 3) qual seu maior gargalo hoje? ` +
        `Com isso eu te digo exatamente se faz sentido e qual caminho mais rápido.`,
      tags: ["qualificação", "diagnóstico", "gargalo"],
    },
    {
      id: "fu-cur-2",
      title: "Follow-up — Agendamento",
      goal: "Mover para call e acelerar decisão",
      timing: "Em 1 dia",
      text:
        `${pick(baseOpeners)} Se preferir, a gente resolve em uma call curta. ` +
        `Você prefere 09:30 ou 10:00?`,
      tags: ["agenda", "call", "próximo_passo"],
    },
  ];

  const pool =
    stage === "sensível_preço" || stage === "price_sensitive"
      ? [...priceFU]
      : stage === "cético" || stage === "skeptical"
      ? [...skepticalFU]
      : stage === "frustrado" || stage === "frustrated"
      ? [...frustratedFU]
      : stage === "pronto" || stage === "ready"
      ? [...readyFU]
      : [...curiousFU];

  const extra: FollowUp = {
    id: "fu-context-1",
    title: "Follow-up — Amarrar próximo passo",
    goal: "Fechar loop e reduzir fricção",
    timing: "Em 4–12h",
    text:
      `${pick(baseOpeners)} Pelo que entendi, a intenção aqui é: **${summary.intent}**. ` +
      `O próximo passo que eu recomendo é: **${summary.nextStep}**. ` +
      `Quer que eu faça isso com você agora?`,
    tags: ["contexto", "next_step", "clareza"],
  };

  const out = [pool[0], pool[1] || pool[0], extra].slice(0, 3);

  return out.map((x, idx) => ({
    ...x,
    id: `${x.id}-${idx}-${Date.now()}`,
  }));
}
