import React, { useMemo, useState } from "react";
import { TrendingUp, Sparkles, AlertTriangle, Target, Zap } from "lucide-react";

import GlassCard from "../components/GlassCard";
import EmotionMap2D from "../components/EmotionMap2D";

// ✅ Demo mode (para pegar leads/conversas reais do demo)
import { isDemoMode, getDemoData } from "../mock";

// ✅ Hook atual (mantemos pra PROD/API quando você quiser)
import { useDashboardMetrics } from "../hooks/useEmotionData";

// ------------------------------------------------------
// Tipagem leve (não acoplar no supabase types)
// ------------------------------------------------------
type LeadLite = {
  id: string;
  phone: string;
  name?: string | null;
  stage?: string;
  urgency_level?: "low" | "normal" | "high" | "critical";
  health_score?: number;
  conversion_probability?: number;
  tags?: string[];
  last_message?: string;
  last_touch_at?: string;
};

// ------------------------------------------------------
// Helpers
// ------------------------------------------------------
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pickN<T>(arr: T[], n: number) {
  if (arr.length <= n) return arr;
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

// ✅ Plano do dia SEMPRE baseado em leads reais (ótimo pra demo)
function buildDemoPlanLeadIds(leads: LeadLite[]) {
  if (!Array.isArray(leads) || leads.length === 0) return [];

  const prontos = leads.filter(
    (l) => String(l.stage || "").toLowerCase() === "pronto"
  );

  const quentes = leads.filter((l) =>
    ["high", "critical"].includes(String(l.urgency_level || "").toLowerCase())
  );

  const emRisco = leads.filter((l) => {
    const health = Number(l.health_score ?? 50);
    const urg = String(l.urgency_level || "").toLowerCase();
    return health <= 45 && (urg === "high" || urg === "critical");
  });

  // ✅ prioridade: prontos, depois quentes, depois em risco
  const selected = [
    ...pickN(prontos, 4),
    ...pickN(quentes, 3),
    ...pickN(emRisco, 2),
  ];

  // remove duplicados
  const ids = Array.from(
    new Set(selected.map((l) => String(l.id)).filter(Boolean))
  );

  // fallback se não tiver o suficiente
  if (ids.length < 5) {
    const randoms = pickN(leads, 8).map((l) => String(l.id));
    return Array.from(new Set([...ids, ...randoms])).slice(0, 10);
  }

  return ids.slice(0, 10);
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

// ------------------------------------------------------
// Página
// ------------------------------------------------------
export default function FunnelPage(props: any) {
  const { data, loading, error } = useDashboardMetrics();

  // ✅ Leads vêm do App (prod) OU do demoData (demo)
  const demo = useMemo(() => (isDemoMode() ? getDemoData() : null), []);
  const demoMode = Boolean(demo);

  const leads: LeadLite[] = useMemo(() => {
    // 1) tenta via props (quando App passa leads reais)
    if (Array.isArray(props?.leads) && props.leads.length) {
      // normaliza campos possíveis
      return props.leads.map((l: any) => ({
        id: String(l.id),
        phone: String(l.phone || ""),
        name: l.name ?? null,
        stage: l.stage,
        urgency_level: l.urgency_level,
        health_score: l.health_score ?? l.score ?? 50,
        conversion_probability: l.conversion_probability,
        tags: Array.isArray(l.tags) ? l.tags : [],
        last_message: l.last_message ?? l.lastMessage,
        last_touch_at: l.last_touch_at ?? l.lastTouchAt ?? l.updated_at,
      })) as LeadLite[];
    }

    // 2) demo fallback
    if (demoMode && demo?.leads?.length) {
      const byPhoneLastMsg = new Map<string, string>();

      // tenta pegar última msg por telefone pra deixar o mapa mais vivo
      if (Array.isArray(demo.conversations)) {
        demo.conversations.forEach((c: any) => {
          if (c?.phone && c?.last_message)
            byPhoneLastMsg.set(c.phone, c.last_message);
        });
      }

      return (demo.leads || []).map((l: any) => ({
        id: String(l.id),
        phone: String(l.phone || ""),
        name: l.name ?? null,
        stage: l.stage,
        urgency_level: l.urgency_level,
        health_score: l.health_score ?? 50,
        conversion_probability: l.conversion_probability,
        tags: Array.isArray(l.tags) ? l.tags : [],
        last_message: byPhoneLastMsg.get(l.phone) || "",
        last_touch_at: l.updated_at,
      })) as LeadLite[];
    }

    return [];
  }, [props?.leads, demoMode, demo]);

  // ✅ Highlights (Plano do dia)
  const [highlightLeadIds, setHighlightLeadIds] = useState<string[]>([]);

  // ------------------------------
  // Métricas pro War Room
  // ------------------------------
  const totalLeads = leads.length;

  const readyLeads = useMemo(
    () => leads.filter((l) => String(l.stage || "").toLowerCase() === "pronto"),
    [leads]
  );

  const hotLeads = useMemo(
    () =>
      leads.filter((l) =>
        ["high", "critical"].includes(String(l.urgency_level || "").toLowerCase())
      ),
    [leads]
  );

  const riskLeads = useMemo(
    () =>
      leads.filter((l) => {
        const health = Number(l.health_score ?? 50);
        const urg = String(l.urgency_level || "").toLowerCase();
        return health <= 45 && (urg === "high" || urg === "critical");
      }),
    [leads]
  );

  const avgHealth = useMemo(() => {
    if (!leads.length) return 0;
    return Math.round(
      sum(leads.map((l) => Number(l.health_score ?? 50))) / leads.length
    );
  }, [leads]);

  const slaMin = useMemo(() => {
    // MVP: estima SLA baseado no tamanho do funil e % high urgency
    const hotRatio = leads.length ? hotLeads.length / leads.length : 0;
    const base = 140;
    const penalty = Math.round(hotRatio * 80);
    return clamp(base + penalty, 60, 260);
  }, [leads.length, hotLeads.length]);

  const predictedRevenue = useMemo(() => {
    // MVP: previsão fake com base nos prontos e probabilidade média
    const avgConv =
      leads.length
        ? sum(leads.map((l) => Number(l.conversion_probability ?? 0.35))) /
          leads.length
        : 0.35;

    const ticket = 1497; // mvp ticket
    const expected = Math.round(readyLeads.length * ticket * avgConv * 1.1);
    return expected;
  }, [leads, readyLeads.length]);

  // ------------------------------
  // Ações do War Room
  // ------------------------------
  const planIds = useMemo(() => buildDemoPlanLeadIds(leads), [leads]);

  const executePlan = () => {
    // ✅ sempre baseado nos leads reais existentes
    setHighlightLeadIds(planIds);
  };

  const clearHighlights = () => setHighlightLeadIds([]);

  // ------------------------------
  // UI texto
  // ------------------------------
  const titleCount = readyLeads.length || highlightLeadIds.length || 0;

  const subtitle =
    readyLeads.length > 0
      ? `Hoje você tem ${hotLeads.length} leads quentes e ${riskLeads.length} em risco. A IA gerou 3 tarefas para aumentar conversão agora.`
      : `A IA analisou intenção, urgência e health. Gere um plano para destacar oportunidades e riscos no mapa.`;

  // ------------------------------
  // Cards do plano (3 tasks)
  // ------------------------------
  const tasks = useMemo(() => {
    return [
      {
        id: "attack-ready",
        title: "Atacar leads prontos",
        desc: `Enviar follow-up para ${Math.min(readyLeads.length || 4, 6)} leads em estágio PRONTO com CTA de call.`,
        count: Math.min(readyLeads.length || 4, 6),
        action: () => {
          const ids = pickN(readyLeads.map((l) => l.id), 6);
          setHighlightLeadIds(ids);
        },
      },
      {
        id: "save-risk",
        title: "Salvar leads esfriando",
        desc: `Priorizar ${Math.min(riskLeads.length || 3, 5)} leads em risco (alta urgência + baixo health + tempo sem toque).`,
        count: Math.min(riskLeads.length || 3, 5),
        action: () => {
          const ids = pickN(riskLeads.map((l) => l.id), 5);
          setHighlightLeadIds(ids);
        },
      },
      {
        id: "price-objection",
        title: "Destravar objeção de preço",
        desc: `Responder ${Math.min(3, leads.length)} sensíveis a preço com oferta em 2 opções e ROI.`,
        count: Math.min(3, leads.length),
        action: () => {
          const sensiveis = leads.filter(
            (l) => String(l.stage || "").toLowerCase() === "sensível_preço"
          );
          const ids = pickN(
            (sensiveis.length ? sensiveis : leads).map((l) => l.id),
            6
          );
          setHighlightLeadIds(ids);
        },
      },
    ];
  }, [leads, readyLeads, riskLeads]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#f57f17]" />
            Funil & Emoções
          </h2>
          <p className="text-gray-500 text-sm">
            Modo War Room: decisão + execução. A IA te diz o que fazer agora.
            {demoMode ? " (DEMO)" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#f57f17]/10 border border-[#f57f17]/20 rounded-2xl px-4 py-2">
          <Sparkles className="w-4 h-4 text-[#f57f17]" />
          <span className="text-sm text-gray-300">
            Plano do dia + Mapa emocional
          </span>
        </div>
      </div>

      {/* War Room */}
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-start justify-between gap-6 flex-wrap">
          <div className="space-y-2">
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#f57f17]" />
              Plano do dia (IA)
            </div>

            <div className="text-3xl font-extrabold text-white">
              {titleCount} leads prontos{" "}
              <span className="text-gray-400 font-semibold text-xl">
                para fechar
              </span>
            </div>

            <p className="text-gray-500 text-sm max-w-[720px]">{subtitle}</p>

            <div className="flex items-center gap-3 flex-wrap pt-2">
              <button
                onClick={executePlan}
                className="h-11 px-5 rounded-2xl border border-[#f57f17]/30 bg-[#f57f17]/10 hover:bg-[#f57f17]/15 transition text-white font-semibold flex items-center gap-2"
              >
                <div className="h-6 w-6 rounded-xl bg-[#f57f17]/15 border border-[#f57f17]/25 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#f57f17]" />
                </div>
                Executar plano do dia
              </button>

              <span className="text-xs text-gray-600">
                Ao executar: destaca leads no mapa (fica até você limpar).
              </span>

              {highlightLeadIds.length > 0 && (
                <button
                  onClick={clearHighlights}
                  className="h-11 px-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-white font-semibold"
                >
                  Limpar destaque
                </button>
              )}
            </div>
          </div>

          {/* Right mini stats */}
          <div className="grid grid-cols-4 gap-3 min-w-[520px] max-w-full">
            <MiniStat title="Ativos" value={String(totalLeads)} sub="Leads no radar" />
            <MiniStat title="Quentes" value={String(hotLeads.length)} sub="Alta urgência" />
            <MiniStat title="Health" value={String(avgHealth)} sub="média 0–100" />
            <MiniStat title="SLA" value={`${slaMin} min`} sub="estimativa" />
          </div>
        </div>

        {/* Tasks + Prediction */}
        <div className="p-6 grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-white/10 bg-black/30 p-4 hover:bg-white/[0.04] transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <p className="text-white font-semibold">{t.title}</p>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
                    {t.count} leads
                  </span>
                </div>

                <p className="text-gray-400 text-sm mt-3 leading-relaxed">
                  {t.desc}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    onClick={t.action}
                    className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm font-semibold text-white"
                  >
                    Destacar no mapa
                  </button>

                  <span className="text-[11px] text-gray-600">
                    impacta risco/intenção
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
            <div className="p-5 border-b border-white/10">
              <p className="text-xs text-gray-500">Previsão (MVP)</p>
              <div className="mt-2 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-3xl font-extrabold text-white">
                    R$ {predictedRevenue.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    Receita esperada se executar o plano.
                  </p>
                </div>

                <button
                  onClick={executePlan}
                  className="h-10 px-4 rounded-2xl border border-[#f57f17]/30 bg-[#f57f17]/10 hover:bg-[#f57f17]/15 transition text-sm font-semibold text-white flex items-center gap-2"
                >
                  <Target className="w-4 h-4 text-[#f57f17]" />
                  +65% conversão em “prontos”
                </button>
              </div>
            </div>

            {riskLeads.length > 0 && (
              <div className="p-5 bg-[#f59e0b]/10 border-t border-[#f59e0b]/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-[#f59e0b]/15 border border-[#f59e0b]/25 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">
                      {riskLeads.length} leads esfriando
                    </p>
                    <p className="text-gray-300 text-sm mt-0.5">
                      Se não tocar agora, você perde. O plano já prioriza isso.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      <EmotionMap2D
        leads={leads as any}
        height={460}
        highlightLeadIds={highlightLeadIds}
        onClearHighlights={clearHighlights}
        onOpenConversation={(lead) => {
          // MVP: só feedback no console no demo
          console.log("Abrir conversa:", lead);
        }}
        onSendFollowUp={(lead) => {
          console.log("Enviar follow-up:", lead);
        }}
        onMarkAsWon={(lead) => {
          console.log("Marcar como ganho:", lead);
        }}
      />

      {/* Insights / Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard
          title="Insights rápidos"
          subtitle="Resumo do que está acontecendo agora"
        >
          {loading ? (
            <p className="text-gray-400">Carregando métricas...</p>
          ) : error ? (
            <p className="text-red-400">
              Erro ao carregar métricas: {String(error)}
            </p>
          ) : (
            <div className="space-y-4">
              <InsightItem
                title="Oportunidade imediata"
                value={
                  readyLeads.length > 0
                    ? `${readyLeads.length} leads em estágio PRONTO`
                    : "Sem leads prontos ainda"
                }
              />

              <InsightItem
                title="Urgência do funil"
                value={
                  hotLeads.length > 0
                    ? `${hotLeads.length} leads com alta urgência`
                    : "Sem urgências altas agora"
                }
              />

              <InsightItem
                title="Tendência"
                value={
                  avgHealth >= 70
                    ? "Funil saudável (alta chance de conversão)"
                    : avgHealth >= 45
                    ? "Funil médio (precisa de follow-up)"
                    : "Funil fraco (ajustar abordagem e oferta)"
                }
              />
            </div>
          )}
        </GlassCard>

        <GlassCard
          title="Ações recomendadas"
          subtitle="O que fazer para melhorar conversão"
        >
          <div className="space-y-3">
            <ActionItem
              title="1) Foco em leads prontos"
              desc="Crie uma fila automática de follow-up + agenda de call rápida."
            />
            <ActionItem
              title="2) Destravar céticos"
              desc="Responda com prova social + cases + oferta com risco reduzido."
            />
            <ActionItem
              title="3) Sensíveis a preço"
              desc="Ofereça 2 opções (parcela vs à vista) e destaque ROI imediato."
            />
            <ActionItem
              title="4) Frustrados"
              desc="Priorizar suporte humano ou mensagem empática antes de ofertar."
            />
          </div>
        </GlassCard>
      </div>

      {/* Debug demo */}
      {demoMode && (
        <div className="text-xs text-gray-600">
          DEMO: plano seleciona sempre leads reais. Ex:{" "}
          <span className="text-gray-400">
            {planIds.slice(0, 3).join(", ")}...
          </span>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------
// Subcomponents
// ------------------------------------------------------
function MiniStat({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-2xl font-extrabold text-white mt-1">{value}</p>
      <p className="text-[11px] text-gray-600 mt-1">{sub}</p>
    </div>
  );
}

function InsightItem({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black/40 px-4 py-3">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-white font-semibold mt-1">{value}</p>
    </div>
  );
}

function ActionItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black/40 px-4 py-3 hover:border-[#f57f17]/30 transition-all">
      <p className="text-white font-semibold">{title}</p>
      <p className="text-gray-500 text-sm mt-1">{desc}</p>
    </div>
  );
}
