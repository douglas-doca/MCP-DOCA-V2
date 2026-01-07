import React, { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Sparkles,
  RefreshCw,
  Search,
  Copy,
  Wand2,
  Clock,
  AlertTriangle,
  BadgeCheck,
  MessageSquare,
} from "lucide-react";

import { isDemoMode, getDemoData } from "../mock";

type Conv = {
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

type Msg = {
  id: string;
  conversation_id: string;
  from: "lead" | "agent" | string;
  text: string;
  created_at: string;
};

type Lead = {
  id: string;
  phone: string;
  name: string | null;
  health_score: number;
  stage: string;
  urgency_level: "low" | "normal" | "high" | "critical";
  conversion_probability: number;
  tags?: string[];
  emotion_profile?: any;
  updated_at?: string;
};

type FollowUpStage =
  | "reativacao"
  | "valor"
  | "objecoes"
  | "fechamento"
  | "nutricao";

type FollowUp = {
  id: string;
  title: string;
  goal: string;
  timing: string;
  text: string;
  tags: string[];
  confidence?: number; // 0..1
  stage?: FollowUpStage;
};

function isoToTimeAgo(iso?: string) {
  if (!iso) return "-";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function emotionLabel(e?: string) {
  const m: Record<string, string> = {
    ready: "Pronto",
    excited: "Empolgado",
    curious: "Curioso",
    skeptical: "Cético",
    frustrated: "Frustrado",
    anxious: "Ansioso",
    price_sensitive: "Preço",
    neutral: "Neutro",
  };
  if (!e) return "—";
  return m[e] || e;
}

function urgencyBadge(u?: string) {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (u === "critical")
    return (
      <span className={`${base} border-red-500/20 bg-red-500/10 text-red-300`}>
        <AlertTriangle className="w-3.5 h-3.5" />
        Crítico
      </span>
    );
  if (u === "high")
    return (
      <span
        className={`${base} border-[#f57f17]/25 bg-[#f57f17]/10 text-[#f57f17]`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Alto
      </span>
    );
  if (u === "low")
    return (
      <span className={`${base} border-white/10 bg-white/5 text-gray-300`}>
        Baixo
      </span>
    );
  return (
    <span className={`${base} border-white/10 bg-white/5 text-gray-300`}>
      Normal
    </span>
  );
}

function stageLabel(stage?: string) {
  const m: Record<string, string> = {
    pronto: "Pronto",
    empolgado: "Empolgado",
    curioso: "Curioso",
    "sensível_preço": "Sensível a preço",
    cético: "Cético",
    frustrado: "Frustrado",
  };
  if (!stage) return "—";
  return m[stage] || stage;
}

function buildConversationSummary(messages: Msg[]) {
  const joined = messages
    .slice(-12)
    .map((m) => `${m.from === "lead" ? "Cliente" : "Agente"}: ${m.text}`)
    .join("\n");

  const text = joined.toLowerCase();
  const objections: string[] = [];
  if (text.includes("caro") || text.includes("preço") || text.includes("valor"))
    objections.push("Preço / orçamento");
  if (
    text.includes("não acredito") ||
    text.includes("robô") ||
    text.includes("funciona")
  )
    objections.push("Ceticismo / confiança");
  if (text.includes("integr") || text.includes("api") || text.includes("crm"))
    objections.push("Integração / técnico");
  if (
    text.includes("ninguém responde") ||
    text.includes("demora") ||
    text.includes("bagunça")
  )
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

function inferStageFromLeadOrEmotion(lead?: Lead | null, conv?: Conv | null): string {
  return (
    lead?.stage ||
    (conv?.current_emotion ? conv.current_emotion : "curioso") ||
    "curioso"
  );
}

function mapFollowUpStageFromEmotion(stage: string): FollowUpStage {
  const s = (stage || "").toLowerCase();

  if (s.includes("pronto") || s.includes("ready")) return "fechamento";
  if (s.includes("frustr") || s.includes("problem")) return "objecoes";
  if (s.includes("cético") || s.includes("skept")) return "objecoes";
  if (s.includes("preço") || s.includes("price")) return "valor";
  if (s.includes("curioso") || s.includes("curious")) return "valor";
  if (s.includes("empolgado") || s.includes("excited")) return "fechamento";

  return "reativacao";
}

function generateFollowUps(opts: {
  lead?: Lead | null;
  conv?: Conv | null;
  messages: Msg[];
}): FollowUp[] {
  const lead = opts.lead;
  const conv = opts.conv;
  const summary = buildConversationSummary(opts.messages);

  const name = (lead?.name || conv?.name || "aí") as string;
  const stage = inferStageFromLeadOrEmotion(lead, conv);
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
      stage: "valor",
      confidence: 0.86,
      title: "Valor — Ancorar ROI",
      goal: "Converter objeção de preço em comparação de valor",
      timing: urg === "high" || urg === "critical" ? "Hoje" : "Em 2–4h",
      text:
        `${pick(baseOpeners)} Vi que você está comparando preço. ` +
        `Pra ficar justo: com seu volume, normalmente a DOCA reduz tempo de resposta e aumenta conversão. ` +
        `Quantos leads/mês e quantos atendentes hoje? Eu simulo o ROI rapidinho.`,
      tags: ["preço", "roi", "qualificação"],
    },
    {
      id: "fu-price-2",
      stage: "valor",
      confidence: 0.80,
      title: "Valor — 2 opções (mensal vs anual)",
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
      stage: "objecoes",
      confidence: 0.86,
      title: "Objeções — Prova + teste assistido",
      goal: "Gerar confiança e reduzir risco percebido",
      timing: urg === "high" ? "Hoje" : "Em 4–8h",
      text:
        `${pick(baseOpeners)} Totalmente justo ser pé no chão. ` +
        `Pra não ficar no “achismo”, eu te mostro 2 cases reais + fazemos um teste assistido. ` +
        `Qual seu maior medo: ficar robótico, errar info ou não converter?`,
      tags: ["cético", "prova_social", "teste"],
    },
    {
      id: "fu-skept-2",
      stage: "objecoes",
      confidence: 0.78,
      title: "Objeções — Demo rápida",
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
      stage: "objecoes",
      confidence: 0.88,
      title: "Objeções — Reparação + prioridade",
      goal: "Desarmar tensão e recuperar controle",
      timing: "Hoje",
      text:
        `${pick(baseOpeners)} Você tem razão — isso não é experiência aceitável. ` +
        `Eu vou priorizar seu caso agora. Me diz em 1 frase o que você precisa resolver primeiro, ` +
        `e eu já te guio no passo a passo.`,
      tags: ["frustrado", "suporte", "prioridade"],
    },
    {
      id: "fu-frus-2",
      stage: "valor",
      confidence: 0.82,
      title: "Valor — Ação objetiva",
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
      stage: "fechamento",
      confidence: 0.90,
      title: "Fechamento — Direto ao ponto",
      goal: "Encaminhar contrato/pagamento com clareza",
      timing: "Hoje",
      text:
        `${pick(baseOpeners)} Perfeito — pra fechar hoje, só preciso de 2 infos: ` +
        `1) plano (mensal/anual) e 2) CNPJ/razão social pra contrato. ` +
        `Te mando o link assim que me confirmar.`,
      tags: ["fechamento", "contrato", "pagamento"],
    },
    {
      id: "fu-ready-2",
      stage: "fechamento",
      confidence: 0.80,
      title: "Fechamento — Onboarding rápido",
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
      stage: "valor",
      confidence: 0.86,
      title: "Valor — Qualificação rápida",
      goal: "Entender contexto e encaixar a oferta",
      timing: urg === "high" ? "Hoje" : "Em 2–6h",
      text:
        `${pick(baseOpeners)} Pra te orientar certo: ` +
        `1) qual seu tipo de negócio? 2) quantos leads/mês? 3) qual seu maior gargalo hoje? ` +
        `Com isso eu te digo exatamente se faz sentido e qual caminho mais rápido.`,
      tags: ["qualificação", "diagnóstico", "gargalo"],
    },
    {
      id: "fu-cur-2",
      stage: "fechamento",
      confidence: 0.72,
      title: "Fechamento — Agendamento",
      goal: "Mover para call e acelerar decisão",
      timing: "Em 1 dia",
      text:
        `${pick(baseOpeners)} Se preferir, a gente resolve em uma call curta. ` +
        `Você prefere 09:30 ou 10:00?`,
      tags: ["agenda", "call", "próximo_passo"],
    },
  ];

  const nurtureFU: FollowUp[] = [
    {
      id: "fu-nurt-1",
      stage: "nutricao",
      confidence: 0.72,
      title: "Nutrição — Conteúdo útil",
      goal: "Manter aquecido com leveza",
      timing: "Em 2 dias",
      text:
        `Fala aí! Vou te mandar um guia rápido com 3 práticas que aumentam conversão no WhatsApp ` +
        `(resposta em até 2min, perguntas certas e follow-ups). Quer que eu envie aqui?`,
      tags: ["conteúdo", "dicas", "nutrição"],
    },
    {
      id: "fu-nurt-2",
      stage: "reativacao",
      confidence: 0.78,
      title: "Reativação — Toque leve",
      goal: "Retomar contato e gerar resposta",
      timing: "Hoje",
      text:
        `Oi, aí 😊 Passando rapidinho pra saber se ficou alguma dúvida. ` +
        `Se fizer sentido, eu te mando os próximos passos em 1 minuto 😄`,
      tags: ["reativação", "leve"],
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
    stage: "valor",
    confidence: 0.86,
    title: "Valor — Amarrar próximo passo",
    goal: "Fechar loop e reduzir fricção",
    timing: "Em 4–12h",
    text:
      `${pick(baseOpeners)} Pelo que entendi, a intenção aqui é: **${summary.intent}**. ` +
      `O próximo passo que eu recomendo é: **${summary.nextStep}**. ` +
      `Quer que eu faça isso com você agora?`,
    tags: ["contexto", "next_step", "clareza"],
  };

  const outBase = [pool[0], pool[1] || pool[0], extra];

  // + uma nutrição leve pra completar o board
  const out = [...outBase, ...nurtureFU].slice(0, 5);

  // IDs únicos no refresh
  return out.map((x, idx) => ({
    ...x,
    id: `${x.id}-${idx}-${Date.now()}`,
    confidence: x.confidence ?? 0.78,
    stage: x.stage ?? mapFollowUpStageFromEmotion(stage),
  }));
}

// Meta do board (labels premium)
const STAGE_META: Record<
  FollowUpStage,
  { label: string; hint: string; badge: string }
> = {
  reativacao: {
    label: "Reativação",
    hint: "Retomar contato e gerar resposta",
    badge: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  },
  valor: {
    label: "Valor",
    hint: "Entregar clareza e prova",
    badge: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  },
  objecoes: {
    label: "Objeções",
    hint: "Responder dúvidas e reduzir atrito",
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },
  fechamento: {
    label: "Fechamento",
    hint: "Mover para decisão e CTA",
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  },
  nutricao: {
    label: "Nutrição",
    hint: "Manter aquecido com leveza",
    badge: "border-white/10 bg-white/5 text-gray-200",
  },
};

function confBadge(conf?: number) {
  const p = Math.round(clamp(conf ?? 0.78, 0, 1) * 100);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
      <BadgeCheck className="w-3.5 h-3.5" />
      {p}% conf.
    </span>
  );
}

export default function AIAnalysisPage() {
  const demoMode = isDemoMode();
  const demo = demoMode ? getDemoData() : null;

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [search, setSearch] = useState("");
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedLead = useMemo(() => {
    if (!selectedConv) return null;
    const byLead = selectedConv.lead_id
      ? leads.find((l) => l.id === selectedConv.lead_id)
      : null;
    if (byLead) return byLead;

    const phone = (selectedConv.phone || "").replace("@c.us", "");
    return leads.find((l) => l.phone === phone) || null;
  }, [selectedConv, leads]);

  async function loadConversations() {
    setLoading(true);

    try {
      if (demoMode && demo) {
        setConversations(demo.conversations || []);
        setLeads(demo.leads || []);

        const first = demo.conversations?.[0] || null;
        setSelectedConv(first);

        if (first) {
          const msgs = (demo.messages || []).filter(
            (m: any) => m.conversation_id === first.id
          );
          setMessages(msgs);
          setFollowups(generateFollowUps({ lead: null, conv: first, messages: msgs }));
        }

        setLoading(false);
        return;
      }

      // PROD: puxa do webhook server
      const convRes = await fetch(`/api/conversations?limit=80`);
      const convs = (await convRes.json()) as any[];

      const mapped: Conv[] = (convs || []).map((c) => ({
        id: c.id,
        lead_id: c.lead_id,
        phone: c.phone || c.chat_id || "",
        name: c.name || null,
        status: c.status,
        updated_at: c.updated_at,
        created_at: c.created_at,
        last_message: c.last_message,
        current_emotion: c.current_emotion,
        temperature: c.temperature,
        tags: c.tags || [],
      }));

      setConversations(mapped);

      // leads (opcional)
      try {
        const leadsRes = await fetch(`/api/leads?limit=200`);
        const ls = (await leadsRes.json()) as any[];
        const mappedLeads: Lead[] = (ls || []).map((l) => ({
          id: l.id,
          phone: (l.phone || "").replace("@c.us", ""),
          name: l.name || null,
          health_score: l.health_score ?? l.score ?? 50,
          stage: l.stage ?? "curioso",
          urgency_level: l.urgency_level ?? "normal",
          conversion_probability: l.conversion_probability ?? 0.4,
          tags: l.tags || [],
          updated_at: l.updated_at,
        }));
        setLeads(mappedLeads);
      } catch {
        setLeads([]);
      }

      const first = mapped?.[0] || null;
      setSelectedConv(first);
      if (first) {
        await loadMessages(first);
      }

      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  async function loadMessages(conv: Conv) {
    setSelectedConv(conv);
    setMessages([]);
    setFollowups([]);

    try {
      if (demoMode && demo) {
        const msgs = (demo.messages || []).filter((m: any) => m.conversation_id === conv.id);
        setMessages(msgs);
        setFollowups(generateFollowUps({ lead: selectedLead, conv, messages: msgs }));
        return;
      }

      const res = await fetch(
        `/api/messages?conversation_id=${encodeURIComponent(conv.id)}&limit=80`
      );
      const data = (await res.json()) as any[];

      const mapped: Msg[] = (data || []).map((m) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        from:
          m.role === "user"
            ? "lead"
            : m.role === "assistant"
            ? "agent"
            : (m.from || "lead"),
        text: m.content || m.text || "",
        created_at: m.timestamp || m.created_at || new Date().toISOString(),
      }));

      setMessages(mapped);
      setFollowups(generateFollowUps({ lead: selectedLead, conv, messages: mapped }));
    } catch (e) {
      console.error(e);
      setMessages([]);
      setFollowups(generateFollowUps({ lead: selectedLead, conv, messages: [] }));
    }
  }

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredConvs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((c) => {
      const a = (c.name || "").toLowerCase();
      const b = (c.phone || "").toLowerCase();
      const d = (c.last_message || "").toLowerCase();
      return a.includes(q) || b.includes(q) || d.includes(q);
    });
  }, [conversations, search]);

  const summary = useMemo(() => buildConversationSummary(messages), [messages]);

  const followupsByStage = useMemo(() => {
    const m = new Map<FollowUpStage, FollowUp[]>();
    (followups || []).forEach((fu) => {
      const st = (fu.stage || "reativacao") as FollowUpStage;
      if (!m.has(st)) m.set(st, []);
      m.get(st)!.push(fu);
    });

    // ordena por confidence desc
    for (const [k, v] of m.entries()) {
      m.set(
        k,
        [...v].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      );
    }

    return m;
  }, [followups]);

  const stages: FollowUpStage[] = useMemo(
    () => ["reativacao", "valor", "objecoes", "fechamento", "nutricao"],
    []
  );

  const primaryStage = useMemo(() => {
    if (!selectedConv) return "reativacao" as FollowUpStage;
    const st = inferStageFromLeadOrEmotion(selectedLead, selectedConv);
    return mapFollowUpStageFromEmotion(st);
  }, [selectedConv, selectedLead]);

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    }
  }

  const headerRight = (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#f57f17]/20 bg-[#f57f17]/10 px-3 py-1.5 text-xs font-semibold text-[#f57f17]">
      <Sparkles className="w-4 h-4" />
      Follow-ups IA (board)
    </span>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-[#f57f17]" />
            Análise IA
          </h2>
          <p className="text-sm text-gray-500">
            IA analisa conversas e sugere follow-ups ideais por estágio, emoção e urgência.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {headerRight}
          <button
            onClick={loadConversations}
            className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-semibold text-gray-200"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4 text-[#f57f17]" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: queue */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.06)] overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#f57f17]" />
              <p className="text-white font-semibold">Fila de conversas</p>
              <span className="text-xs text-gray-500">{filteredConvs.length}</span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, número, mensagem..."
                className="w-72 max-w-[70vw] h-10 rounded-2xl bg-black/30 border border-white/10 pl-10 pr-3 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </div>
          </div>

          <div className="max-h-[560px] overflow-auto">
            {loading ? (
              <div className="p-6 text-gray-400">Carregando conversas...</div>
            ) : filteredConvs.length === 0 ? (
              <div className="p-6 text-gray-400">Nenhuma conversa encontrada.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredConvs.map((c) => {
                  const active = selectedConv?.id === c.id;
                  const lead = c.lead_id ? leads.find((l) => l.id === c.lead_id) : null;

                  return (
                    <button
                      key={c.id}
                      onClick={() => loadMessages(c)}
                      className={[
                        "w-full text-left px-5 py-4 transition-all",
                        active ? "bg-[#f57f17]/10" : "hover:bg-white/5",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-semibold truncate">
                              {c.name || lead?.name || "Lead sem nome"}
                            </p>
                            <span className="text-[11px] text-gray-500 truncate">
                              {(c.phone || "").replace("@c.us", "")}
                            </span>
                          </div>

                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                            {c.last_message || "—"}
                          </p>

                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-gray-200">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              {isoToTimeAgo(c.updated_at || c.created_at)}
                            </span>

                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-gray-200">
                              {emotionLabel(c.current_emotion)}
                            </span>

                            {lead?.urgency_level ? urgencyBadge(lead.urgency_level) : null}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-gray-300">
                            {stageLabel(lead?.stage)}
                          </span>
                          {lead?.conversion_probability != null && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                              <BadgeCheck className="w-3.5 h-3.5" />
                              {Math.round(clamp(lead.conversion_probability, 0, 1) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: analysis */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.06)] overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-white font-semibold">Follow-ups sugeridos</p>
              <p className="text-sm text-gray-500 mt-1">
                Baseado na conversa selecionada, estágio e urgência (board).
              </p>
            </div>

            <button
              onClick={() =>
                setFollowups(
                  generateFollowUps({
                    lead: selectedLead,
                    conv: selectedConv,
                    messages,
                  })
                )
              }
              className="h-10 px-4 rounded-2xl border border-[#f57f17]/20 bg-[#f57f17]/10 hover:bg-[#f57f17]/15 transition-all flex items-center gap-2 text-sm font-semibold text-[#f57f17]"
              disabled={!selectedConv}
              title="Gerar novas sugestões"
            >
              <Wand2 className="w-4 h-4" />
              Gerar novas
            </button>
          </div>

          <div className="p-5 space-y-5">
            {!selectedConv ? (
              <div className="text-gray-400">
                Selecione uma conversa para ver análise e follow-ups.
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MiniCard title="Intenção" value={summary.intent} />
                  <MiniCard title="Objeções" value={summary.objections.slice(0, 2).join(" • ")} />
                  <MiniCard title="Próximo passo" value={summary.nextStep} />
                </div>

                {/* Messages preview */}
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-sm font-semibold text-white">Trecho da conversa</p>
                  <div className="mt-3 space-y-2 max-h-[160px] overflow-auto pr-1">
                    {(messages || []).slice(-8).map((m) => (
                      <div
                        key={m.id}
                        className={[
                          "text-sm rounded-2xl px-3 py-2 border",
                          m.from === "lead"
                            ? "bg-white/5 border-white/10 text-gray-200"
                            : "bg-[#f57f17]/10 border-[#f57f17]/20 text-white",
                        ].join(" ")}
                      >
                        <span className="text-[11px] text-gray-500 mr-2">
                          {m.from === "lead" ? "Cliente" : "Agente"}
                        </span>
                        {m.text}
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <p className="text-sm text-gray-500">Sem mensagens carregadas.</p>
                    )}
                  </div>
                </div>

                {/* ✅ Board: prateleiras por estágio */}
                <div className="space-y-4">
                  {stages.map((st) => {
                    const items = followupsByStage.get(st) || [];
                    const meta = STAGE_META[st];
                    const isPrimary = st === primaryStage;

                    return (
                      <div
                        key={st}
                        className={[
                          "rounded-2xl border bg-black/20 overflow-hidden transition-all",
                          isPrimary
                            ? "border-[#f57f17]/40 shadow-[0_0_0_1px_rgba(245,127,23,0.20)]"
                            : "border-white/10",
                        ].join(" ")}
                      >
                        {/* Header da linha */}
                        <div
                          className={[
                            "p-4 border-b flex items-start justify-between gap-3",
                            isPrimary ? "border-[#f57f17]/20" : "border-white/10",
                          ].join(" ")}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={[
                                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                  meta.badge,
                                ].join(" ")}
                              >
                                {meta.label}
                              </span>

                              {isPrimary && (
                                <span className="inline-flex items-center rounded-full border border-[#f57f17]/25 bg-[#f57f17]/10 px-2 py-0.5 text-[11px] font-semibold text-[#f57f17]">
                                  Recomendado
                                </span>
                              )}

                              <span className="text-[11px] text-gray-500">{items.length}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{meta.hint}</p>
                          </div>
                        </div>

                        {/* Cards horizontais */}
                        <div className="p-4">
                          {items.length === 0 ? (
                            <div className="text-xs text-gray-500 py-6 text-center">
                              Sem sugestões.
                            </div>
                          ) : (
                            <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              {items.map((fu) => (
                                <div
                                  key={fu.id}
                                  className={[
                                    "min-w-[340px] max-w-[340px] rounded-2xl border bg-black/30 p-4 hover:bg-black/40 transition-all",
                                    isPrimary ? "border-[#f57f17]/20" : "border-white/10",
                                  ].join(" ")}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-white font-semibold text-sm">
                                        {fu.title}
                                      </p>

                                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                        <span className="text-gray-400">Objetivo:</span>{" "}
                                        {fu.goal}
                                      </p>

                                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                                          <Clock className="w-3.5 h-3.5" />
                                          <span className="text-gray-300 font-semibold">
                                            {fu.timing}
                                          </span>
                                        </span>
                                        {confBadge(fu.confidence)}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-3">
                                    <p className="text-sm text-gray-200 whitespace-pre-wrap line-clamp-5">
                                      {fu.text}
                                    </p>
                                  </div>

                                  <div className="mt-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {fu.tags.slice(0, 2).map((t) => (
                                        <span
                                          key={t}
                                          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-gray-300"
                                        >
                                          {t}
                                        </span>
                                      ))}
                                      {fu.tags.length > 2 && (
                                        <span className="text-[11px] text-gray-500">
                                          +{fu.tags.length - 2}
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => copy(fu.text, fu.id)}
                                      className="h-9 px-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-xs font-semibold text-gray-200"
                                      title="Copiar mensagem"
                                    >
                                      <Copy className="w-4 h-4 text-[#f57f17]" />
                                      {copiedId === fu.id ? "Copiado" : "Copiar"}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hint */}
                <div className="text-xs text-gray-500">
                  *Agora está em modo heurístico (sem IA real). Depois trocamos o gerador por endpoint do backend (OpenAI) mantendo a UI.*
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-white font-semibold mt-1 line-clamp-2">{value}</p>
    </div>
  );
}
