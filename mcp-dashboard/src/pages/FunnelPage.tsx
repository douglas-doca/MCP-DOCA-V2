import React, { useMemo, useState } from "react";
import { TrendingUp, Sparkles, AlertTriangle, Target, Zap, Phone, MessageSquare, Trophy, X, ChevronRight, Search, Lightbulb, DollarSign, Heart, Flame, Users } from "lucide-react";

import GlassCard from "../components/GlassCard";
import EmotionMap2D from "../components/EmotionMap2D";

import { isDemoMode, getDemoData } from "../mock";
import { useDashboardMetrics } from "../hooks/useEmotionData";

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

function buildDemoPlanLeadIds(leads: LeadLite[]) {
  if (!Array.isArray(leads) || leads.length === 0) return [];
  const prontos = leads.filter((l) => String(l.stage || "").toLowerCase() === "pronto");
  const quentes = leads.filter((l) => ["high", "critical"].includes(String(l.urgency_level || "").toLowerCase()));
  const emRisco = leads.filter((l) => {
    const health = Number(l.health_score ?? 50);
    const urg = String(l.urgency_level || "").toLowerCase();
    return health <= 45 && (urg === "high" || urg === "critical");
  });
  const selected = [...pickN(prontos, 4), ...pickN(quentes, 3), ...pickN(emRisco, 2)];
  const ids = Array.from(new Set(selected.map((l) => String(l.id)).filter(Boolean)));
  if (ids.length < 5) {
    const randoms = pickN(leads, 8).map((l) => String(l.id));
    return Array.from(new Set([...ids, ...randoms])).slice(0, 10);
  }
  return ids.slice(0, 10);
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

function fmtPhone(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 10) return phone;
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

// ✅ Estágios com ícones Lucide
const FUNNEL_STAGES = [
  { key: "curioso", label: "Curiosos", icon: Search, gradient: "from-blue-500 to-blue-600" },
  { key: "cético", label: "Céticos", icon: Lightbulb, gradient: "from-fuchsia-500 to-fuchsia-600" },
  { key: "sensível_preço", label: "Preço", icon: DollarSign, gradient: "from-cyan-500 to-cyan-600" },
  { key: "empolgado", label: "Empolgados", icon: Heart, gradient: "from-emerald-500 to-emerald-600" },
  { key: "pronto", label: "Prontos", icon: Flame, gradient: "from-orange-500 to-red-500" },
];

export default function FunnelPage(props: any) {
  const { data, loading, error } = useDashboardMetrics();
  const demo = useMemo(() => (isDemoMode() ? getDemoData() : null), []);
  const demoMode = Boolean(demo);
  const [showActionPanel, setShowActionPanel] = useState(false);

  const leads: LeadLite[] = useMemo(() => {
    if (Array.isArray(props?.leads) && props.leads.length) {
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
    if (demoMode && demo?.leads?.length) {
      const byPhoneLastMsg = new Map<string, string>();
      if (Array.isArray(demo.conversations)) {
        demo.conversations.forEach((c: any) => {
          if (c?.phone && c?.last_message) byPhoneLastMsg.set(c.phone, c.last_message);
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

  const [highlightLeadIds, setHighlightLeadIds] = useState<string[]>([]);

  const totalLeads = leads.length;
  const readyLeads = useMemo(() => leads.filter((l) => String(l.stage || "").toLowerCase() === "pronto"), [leads]);
  const hotLeads = useMemo(() => leads.filter((l) => ["high", "critical"].includes(String(l.urgency_level || "").toLowerCase())), [leads]);
  const riskLeads = useMemo(() => leads.filter((l) => {
    const health = Number(l.health_score ?? 50);
    const urg = String(l.urgency_level || "").toLowerCase();
    return health <= 45 && (urg === "high" || urg === "critical");
  }), [leads]);
  const avgHealth = useMemo(() => {
    if (!leads.length) return 0;
    return Math.round(sum(leads.map((l) => Number(l.health_score ?? 50))) / leads.length);
  }, [leads]);
  const slaMin = useMemo(() => {
    const hotRatio = leads.length ? hotLeads.length / leads.length : 0;
    return clamp(140 + Math.round(hotRatio * 80), 60, 260);
  }, [leads.length, hotLeads.length]);
  const predictedRevenue = useMemo(() => {
    const avgConv = leads.length ? sum(leads.map((l) => Number(l.conversion_probability ?? 0.35))) / leads.length : 0.35;
    return Math.round(readyLeads.length * 1497 * avgConv * 1.1);
  }, [leads, readyLeads.length]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      const stage = (l.stage || "curioso").toLowerCase();
      counts[stage] = (counts[stage] || 0) + 1;
    });
    return counts;
  }, [leads]);

  const highlightedLeads = useMemo(() => {
    if (highlightLeadIds.length === 0) return [];
    return leads.filter((l) => highlightLeadIds.includes(l.id));
  }, [leads, highlightLeadIds]);

  const planIds = useMemo(() => buildDemoPlanLeadIds(leads), [leads]);

  const executePlan = () => {
    setHighlightLeadIds(planIds);
    setShowActionPanel(true);
  };

  const clearHighlights = () => {
    setHighlightLeadIds([]);
    setShowActionPanel(false);
  };

  const filterByStage = (stageKey: string) => {
    const stageLeads = leads.filter((l) => (l.stage || "curioso").toLowerCase() === stageKey);
    setHighlightLeadIds(stageLeads.map((l) => l.id));
    setShowActionPanel(true);
  };

  const titleCount = readyLeads.length || highlightLeadIds.length || 0;
  const subtitle = readyLeads.length > 0
    ? `${hotLeads.length} leads quentes e ${riskLeads.length} em risco. Execute o plano para aumentar conversão.`
    : `A IA analisou intenção, urgência e health. Gere um plano para destacar oportunidades.`;

  const tasks = useMemo(() => [
    {
      id: "attack-ready",
      title: "Atacar leads prontos",
      desc: `Follow-up para ${Math.min(readyLeads.length || 4, 6)} leads PRONTO`,
      count: Math.min(readyLeads.length || 4, 6),
      action: () => { setHighlightLeadIds(pickN(readyLeads.map((l) => l.id), 6)); setShowActionPanel(true); },
    },
    {
      id: "save-risk",
      title: "Salvar esfriando",
      desc: `Priorizar ${Math.min(riskLeads.length || 3, 5)} leads em risco`,
      count: Math.min(riskLeads.length || 3, 5),
      action: () => { setHighlightLeadIds(pickN(riskLeads.map((l) => l.id), 5)); setShowActionPanel(true); },
    },
    {
      id: "price-objection",
      title: "Destravar preço",
      desc: `Responder ${Math.min(3, leads.length)} sensíveis a preço`,
      count: Math.min(3, leads.length),
      action: () => {
        const sensiveis = leads.filter((l) => String(l.stage || "").toLowerCase() === "sensível_preço");
        setHighlightLeadIds(pickN((sensiveis.length ? sensiveis : leads).map((l) => l.id), 6));
        setShowActionPanel(true);
      },
    },
  ], [leads, readyLeads, riskLeads]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#f57f17]" />
            Funil & Emoções
          </h2>
          <p className="text-gray-500 text-sm">War Room: decisão + execução{demoMode ? " (DEMO)" : ""}</p>
        </div>
      </div>

      {/* ============ WAR ROOM (PLANO DO DIA) ============ */}
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[#f57f17]/15 border border-[#f57f17]/25 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#f57f17]" />
                </div>
                <span className="text-xs text-gray-500 font-medium">PLANO DO DIA</span>
              </div>

              <div className="text-3xl font-extrabold text-white">
                {titleCount} leads prontos
              </div>

              <p className="text-gray-500 text-sm max-w-xl">{subtitle}</p>

              <div className="flex items-center gap-3 flex-wrap pt-1">
                <button onClick={executePlan} className="h-11 px-5 rounded-2xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] hover:opacity-90 transition text-white font-semibold flex items-center gap-2 shadow-lg shadow-[#f57f17]/20">
                  <Zap className="w-4 h-4" />
                  Executar plano
                </button>
                {highlightLeadIds.length > 0 && (
                  <button onClick={clearHighlights} className="h-11 px-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-white font-semibold">
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MiniStat title="Ativos" value={totalLeads} color="text-white" />
              <MiniStat title="Quentes" value={hotLeads.length} color="text-orange-400" />
              <MiniStat title="Health" value={avgHealth} color="text-emerald-400" />
              <MiniStat title="SLA" value={`${slaMin}m`} color="text-cyan-400" />
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {tasks.map((t) => (
            <button key={t.id} onClick={t.action} className="group text-left rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-[#f57f17]/30 hover:bg-[#f57f17]/5 transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-semibold group-hover:text-[#f57f17] transition">{t.title}</p>
                <span className="text-[11px] px-2 py-1 rounded-full bg-white/5 text-gray-400">{t.count}</span>
              </div>
              <p className="text-gray-500 text-sm">{t.desc}</p>
            </button>
          ))}
        </div>

        {/* Revenue prediction */}
        {predictedRevenue > 0 && (
          <div className="px-6 pb-6">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <Target className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-emerald-300 text-sm font-medium">Receita esperada</p>
                  <p className="text-2xl font-bold text-white">R$ {predictedRevenue.toLocaleString("pt-BR")}</p>
                </div>
              </div>
              {riskLeads.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-yellow-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{riskLeads.length} leads esfriando</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============ PAINEL DE AÇÃO ============ */}
      {showActionPanel && highlightedLeads.length > 0 && (
        <div className="rounded-[28px] border border-[#f57f17]/30 bg-gradient-to-br from-[#f57f17]/10 to-transparent backdrop-blur-xl overflow-hidden">
          <div className="p-4 border-b border-[#f57f17]/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#f57f17]/15 border border-[#f57f17]/25 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#f57f17]" />
              </div>
              <div>
                <h3 className="text-white font-bold">Leads Selecionados</h3>
                <p className="text-gray-400 text-xs">{highlightedLeads.length} para ação</p>
              </div>
            </div>
            <button onClick={() => setShowActionPanel(false)} className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="max-h-[280px] overflow-y-auto divide-y divide-white/5">
            {highlightedLeads.map((lead) => {
              const temp = lead.health_score || 50;
              return (
                <div key={lead.id} className="px-4 py-3 hover:bg-white/[0.02] transition flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={["h-10 w-10 rounded-xl border flex items-center justify-center text-sm font-bold flex-shrink-0",
                      temp >= 70 ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" :
                      temp >= 40 ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" :
                      "bg-red-500/20 border-red-500/40 text-red-300"
                    ].join(" ")}>
                      {temp}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{lead.name || fmtPhone(lead.phone)}</p>
                      <p className="text-gray-500 text-xs">{lead.stage || "curioso"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => props?.onOpenConversation?.(lead)} className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" /> Chat
                    </button>
                    <button onClick={() => props?.onSendFollowUp?.(lead)} className="h-8 px-3 rounded-lg border border-[#f57f17]/30 bg-[#f57f17]/10 hover:bg-[#f57f17]/20 text-xs text-white flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#f57f17]" /> FUP
                    </button>
                    <button onClick={() => props?.onMarkAsWon?.(lead)} className="h-8 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs text-white flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Won
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ MAPA EMOCIONAL ============ */}
      <EmotionMap2D
        leads={leads as any}
        height={460}
        highlightLeadIds={highlightLeadIds}
        onClearHighlights={clearHighlights}
        onOpenConversation={(lead) => props?.onOpenConversation?.(lead)}
        onSendFollowUp={(lead) => props?.onSendFollowUp?.(lead)}
        onMarkAsWon={(lead) => props?.onMarkAsWon?.(lead)}
      />

      {/* ============ PIPELINE VISUAL ============ */}
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold">Pipeline</h3>
            <p className="text-gray-500 text-sm">Distribuição por estágio emocional</p>
          </div>
          <div className="text-xs text-gray-500">
            <span className="text-white font-semibold">{totalLeads}</span> leads
          </div>
        </div>

        <div className="p-6">
          {/* Barras horizontais estilo progress */}
          <div className="space-y-4">
            {FUNNEL_STAGES.map((stage) => {
              const count = stageCounts[stage.key] || 0;
              const percent = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
              const Icon = stage.icon;

              return (
                <button
                  key={stage.key}
                  onClick={() => filterByStage(stage.key)}
                  className="w-full group"
                >
                  <div className="flex items-center gap-4">
                    {/* Ícone */}
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${stage.gradient} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    {/* Label e barra */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-gray-300 font-medium group-hover:text-white transition">{stage.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-white">{count}</span>
                          <span className="text-xs text-gray-600">{Math.round(percent)}%</span>
                        </div>
                      </div>

                      {/* Barra de progresso */}
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${stage.gradient} rounded-full transition-all duration-500 group-hover:opacity-80`}
                          style={{ width: `${Math.max(percent, 2)}%` }}
                        />
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-[#f57f17] group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============ INSIGHTS ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard title="Insights" subtitle="O que está acontecendo">
          <div className="space-y-3">
            <InsightItem label="Oportunidade" value={readyLeads.length > 0 ? `${readyLeads.length} leads prontos para fechar` : "Sem leads prontos"} good={readyLeads.length > 0} />
            <InsightItem label="Urgência" value={hotLeads.length > 0 ? `${hotLeads.length} leads com alta urgência` : "Sem urgências"} good={false} />
            <InsightItem label="Saúde" value={avgHealth >= 60 ? "Funil saudável" : avgHealth >= 40 ? "Funil médio" : "Funil precisa atenção"} good={avgHealth >= 60} />
          </div>
        </GlassCard>

        <GlassCard title="Ações Recomendadas" subtitle="Próximos passos">
          <div className="space-y-3">
            <ActionItem title="Foco em prontos" desc="Follow-up imediato com CTA de call" />
            <ActionItem title="Destravar céticos" desc="Prova social e cases de sucesso" />
            <ActionItem title="Sensíveis a preço" desc="Mostrar ROI e opções de pagamento" />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function MiniStat({ title, value, color }: { title: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{title}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function InsightItem({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-white/5 bg-black/20">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-sm font-medium ${good ? "text-emerald-400" : "text-gray-300"}`}>{value}</span>
    </div>
  );
}

function ActionItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="px-4 py-3 rounded-xl border border-white/5 bg-black/20 hover:border-[#f57f17]/20 transition">
      <p className="text-white font-medium text-sm">{title}</p>
      <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
    </div>
  );
}