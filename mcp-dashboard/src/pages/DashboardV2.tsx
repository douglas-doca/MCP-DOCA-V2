import React, { useMemo } from "react";
import {
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  MessageSquare,
  Users,
  CheckCircle2,
  Clock,
  Activity,
  ShieldCheck,
  Zap,
  AlertTriangle,
  Database,
  Info,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

type DashboardStats = {
  conversations_total?: number;
  leads_total?: number;
  qualified_total?: number;
  avg_response_time_seconds?: number;
  emotions_distribution?: Record<string, number>;
  activity_last_7_days?: Array<{ name: string; value: number }>;
};

type Conversation = {
  id: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
  last_message?: string;
  current_emotion?: string;
};

type Lead = {
  id: string;
  status?: string;
  score?: number;
  stage?: string;
  urgency_level?: string;
  health_score?: number;
  conversion_probability?: number;
  tags?: string[];
  updated_at?: string;
};

export default function DashboardV2({
  demoMode,
  stats,
  conversations,
  leads,
  onOpenSuggestions,
  onOpenInsights,
  onActivateAI,
  onGoToAnalysis,
  onOpenEvents,
}: {
  demoMode: boolean;
  stats?: DashboardStats | null;
  conversations?: Conversation[];
  leads?: Lead[];
  onOpenSuggestions?: () => void;
  onOpenInsights?: () => void;
  onActivateAI?: () => void;
  onGoToAnalysis?: () => void;
  onOpenEvents?: () => void;
}) {
  const convs = conversations || [];
  const ls = leads || [];

  const hasRealData =
    !demoMode &&
    (Boolean(stats && Object.keys(stats).length > 0) ||
      convs.length > 0 ||
      ls.length > 0);

  // ✅ DEMO placeholder data (fica bonito no DEV)
  const demoKpis = useMemo(
    () => [
      {
        label: "Conversas",
        value: 87,
        delta: "+12%",
        icon: MessageSquare,
        tone: "orange" as const,
        hint: "Últimos 7 dias",
      },
      {
        label: "Leads",
        value: 34,
        delta: "+9%",
        icon: Users,
        tone: "cyan" as const,
        hint: "Entraram no pipeline",
      },
      {
        label: "Qualificados",
        value: 12,
        delta: "+4%",
        icon: CheckCircle2,
        tone: "green" as const,
        hint: "Alta intenção",
      },
      {
        label: "Tempo médio",
        value: "18s",
        delta: "-7%",
        icon: Clock,
        tone: "orange" as const,
        hint: "Resposta do agente",
      },
    ],
    []
  );

  const demoAreaData = useMemo(
    () => [
      { name: "Seg", value: 12 },
      { name: "Ter", value: 18 },
      { name: "Qua", value: 16 },
      { name: "Qui", value: 25 },
      { name: "Sex", value: 21 },
      { name: "Sáb", value: 14 },
      { name: "Dom", value: 9 },
    ],
    []
  );

  const demoBarData = useMemo(
    () => [
      { name: "Cético", value: 10 },
      { name: "Curioso", value: 17 },
      { name: "Preço", value: 12 },
      { name: "Empolgado", value: 9 },
      { name: "Pronto", value: 6 },
    ],
    []
  );

  const demoActivityFeed = useMemo(
    () => [
      {
        type: "lead",
        title: "Novo lead qualificado",
        desc: "Lead entrou com Health Score 78/100",
        time: "há 2 min",
        icon: Sparkles,
        tone: "orange" as const,
      },
      {
        type: "alert",
        title: "Objeção detectada",
        desc: "Preço/ROI apareceu em 3 conversas",
        time: "há 12 min",
        icon: AlertTriangle,
        tone: "red" as const,
      },
      {
        type: "system",
        title: "Sistema estável",
        desc: "Webhooks OK • Supabase conectado",
        time: "há 31 min",
        icon: ShieldCheck,
        tone: "green" as const,
      },
      {
        type: "perf",
        title: "Performance do agente",
        desc: "Tempo médio caiu de 22s → 18s",
        time: "hoje",
        icon: Zap,
        tone: "cyan" as const,
      },
    ],
    []
  );

  // ✅ REAL stats → fallback pra 0 quando não tiver dados
  const realKpis = useMemo(() => {
    const conversations_total = stats?.conversations_total ?? convs.length ?? 0;
    const leads_total = stats?.leads_total ?? ls.length ?? 0;

    const qualified_total =
      stats?.qualified_total ??
      ls.filter((l) => (l.status || "").toLowerCase() === "qualified").length ??
      0;

    const avgSec = stats?.avg_response_time_seconds ?? 0;
    const avgLabel = avgSec ? `${Math.round(avgSec)}s` : "—";

    return [
      {
        label: "Conversas",
        value: conversations_total,
        delta: "—",
        icon: MessageSquare,
        tone: "orange" as const,
        hint: "Total",
      },
      {
        label: "Leads",
        value: leads_total,
        delta: "—",
        icon: Users,
        tone: "cyan" as const,
        hint: "Total",
      },
      {
        label: "Qualificados",
        value: qualified_total,
        delta: "—",
        icon: CheckCircle2,
        tone: "green" as const,
        hint: "Status qualified",
      },
      {
        label: "Tempo médio",
        value: avgLabel,
        delta: "—",
        icon: Clock,
        tone: "orange" as const,
        hint: "Resposta do agente",
      },
    ];
  }, [stats, convs, ls]);

  const realAreaData = useMemo(() => {
    if (stats?.activity_last_7_days?.length) return stats.activity_last_7_days;

    if (!convs.length) {
      return [
        { name: "Seg", value: 0 },
        { name: "Ter", value: 0 },
        { name: "Qua", value: 0 },
        { name: "Qui", value: 0 },
        { name: "Sex", value: 0 },
        { name: "Sáb", value: 0 },
        { name: "Dom", value: 0 },
      ];
    }

    return [
      { name: "Seg", value: 0 },
      { name: "Ter", value: 0 },
      { name: "Qua", value: 0 },
      { name: "Qui", value: 0 },
      { name: "Sex", value: 0 },
      { name: "Sáb", value: 0 },
      { name: "Dom", value: convs.length },
    ];
  }, [stats, convs]);

  const realBarData = useMemo(() => {
    const dist = stats?.emotions_distribution;

    if (dist && Object.keys(dist).length) {
      const order = [
        "skeptical",
        "curious",
        "price_sensitive",
        "excited",
        "ready",
        "neutral",
      ];
      const labels: Record<string, string> = {
        skeptical: "Cético",
        curious: "Curioso",
        price_sensitive: "Preço",
        excited: "Empolgado",
        ready: "Pronto",
        neutral: "Neutro",
      };

      return order
        .filter((k) => dist[k] != null)
        .map((k) => ({
          name: labels[k] || k,
          value: Number(dist[k] || 0),
        }));
    }

    if (!convs.length) {
      return [
        { name: "Cético", value: 0 },
        { name: "Curioso", value: 0 },
        { name: "Preço", value: 0 },
        { name: "Empolgado", value: 0 },
        { name: "Pronto", value: 0 },
      ];
    }

    const map: Record<string, number> = {};
    convs.forEach((c) => {
      const e = (c.current_emotion || "neutral").toLowerCase();
      map[e] = (map[e] || 0) + 1;
    });

    const labels: Record<string, string> = {
      skeptical: "Cético",
      curious: "Curioso",
      price_sensitive: "Preço",
      excited: "Empolgado",
      ready: "Pronto",
      neutral: "Neutro",
    };

    const keys = Object.keys(map).slice(0, 6);
    return keys.map((k) => ({
      name: labels[k] || k,
      value: map[k],
    }));
  }, [stats, convs]);

  const realActivityFeed = useMemo(() => {
    if (!hasRealData) return [];

    const events: Array<{
      title: string;
      desc: string;
      time: string;
      icon: any;
      tone: "orange" | "green" | "cyan" | "red";
    }> = [];

    if (convs.length) {
      events.push({
        title: "Conversas carregadas",
        desc: `${convs.length} conversas no sistema`,
        time: "agora",
        icon: MessageSquare,
        tone: "orange",
      });
    }

    if (ls.length) {
      events.push({
        title: "Leads carregados",
        desc: `${ls.length} leads no sistema`,
        time: "agora",
        icon: Users,
        tone: "cyan",
      });
    }

    events.push({
      title: "Modo produção",
      desc: "Sem mock • exibindo apenas dados reais",
      time: "agora",
      icon: Database,
      tone: "green",
    });

    return events.slice(0, 4);
  }, [hasRealData, convs.length, ls.length]);

  // ✅ Seleciona datasets conforme demo/real
  const kpis = demoMode ? demoKpis : realKpis;
  const areaData = demoMode ? demoAreaData : realAreaData;
  const barData = demoMode ? demoBarData : realBarData;
  const activityFeed = demoMode ? demoActivityFeed : realActivityFeed;

  // ✅ No REAL: se não tem dado, não mostra mock; mostra empty state
  if (!demoMode && !hasRealData) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-10 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300">
            <Database className="w-4 h-4 text-[#f57f17]" />
            Produção • Dados reais
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-white mt-4">
            Ainda não há dados para exibir
          </h2>

          <p className="text-gray-400 mt-2">
            Este painel não usa mock no MCP. Assim que chegarem conversas/leads
            via webhook e forem persistidas no banco, os números e gráficos
            aparecem aqui.
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <EmptyHint
              title="1) Envie mensagens"
              desc="Use o WhatsApp conectado para criar conversas reais."
              icon={MessageSquare}
            />
            <EmptyHint
              title="2) Verifique o Webhook"
              desc="Confira se o endpoint /api está respondendo e salvando."
              icon={ShieldCheck}
            />
            <EmptyHint
              title="3) Atualize"
              desc="Assim que houver dados, este painel se preenche automaticamente."
              icon={Activity}
            />
          </div>

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <button
              onClick={onGoToAnalysis}
              className="h-11 px-5 rounded-2xl border border-[#f57f17]/20 bg-[#f57f17]/10 hover:bg-[#f57f17]/15 transition-all flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-[#f57f17]" />
              <span className="text-sm font-semibold text-[#f57f17]">
                Ir para Análise IA
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#f57f17]" />
            </button>

            <span className="text-xs text-gray-500">
              *Quando você começar a receber conversas, esse dashboard vira “vivo”.*
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top summary row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Hero / Overview */}
        <div className="xl:col-span-8 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] relative overflow-hidden">
          {/* Glow */}
          <div className="pointer-events-none absolute -top-20 -right-40 h-[320px] w-[320px] rounded-full bg-[#f57f17]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-[-120px] h-[320px] w-[320px] rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#f57f17]/20 bg-[#f57f17]/10 px-3 py-1.5 text-xs font-semibold text-[#f57f17]">
                <Activity className="w-4 h-4" />
                {demoMode ? "Demo • Painel fictício" : "Realtime • Operação viva"}
              </p>

              <h2 className="text-3xl font-bold tracking-tight text-white mt-4">
                Visão Executiva do Funil
              </h2>
              <p className="text-gray-400 mt-2 max-w-2xl">
                Tudo o que importa em um painel: volume, qualidade, intenção e
                performance do agente — com insights prontos para ação.
              </p>

              <div className="mt-6 flex items-center gap-3 flex-wrap">
                <button
                  onClick={onOpenInsights}
                  className="h-11 px-5 rounded-2xl border border-[#f57f17]/20 bg-[#f57f17]/10 hover:bg-[#f57f17]/15 transition-all flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4 text-[#f57f17]" />
                  <span className="text-sm font-semibold text-[#f57f17]">
                    Ver insights
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-[#f57f17]" />
                </button>

                <button
                  onClick={onOpenSuggestions}
                  className="h-11 px-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-[#f57f17]" />
                  <span className="text-sm font-semibold text-gray-200">
                    Sugestões IA
                  </span>
                </button>

                {demoMode ? (
                  <span className="text-xs text-gray-500">
                    *Demo com dados fictícios para demonstração.*
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">
                    *Os dados vêm do backend (Supabase/Webhook).*
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MiniStat
                label="SLA"
                value={demoMode ? "99.8%" : "—"}
                tone="green"
                tooltip="SLA = % de mensagens respondidas dentro do tempo alvo (ex: 60s)."
              />
              <MiniStat
                label="Erros"
                value={demoMode ? "0" : "—"}
                tone="orange"
                tooltip="Erros = falhas do webhook/integrações (WhatsApp, DB, automações)."
              />
              <MiniStat
                label="Latência"
                value={demoMode ? "112ms" : "—"}
                tone="cyan"
                tooltip="Latência = tempo médio da API/webhook (resposta do backend)."
              />
            </div>
          </div>

          {/* Chart */}
          <div className="mt-7 h-[260px] rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-sm font-semibold text-gray-200 mb-3">
              Atividade (conversas/dia)
              <span className="text-xs text-gray-500 ml-2">• últimos 7 dias</span>
            </p>

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={areaData}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  stroke="#6b7280"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#6b7280" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0b0b0b",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    color: "#fff",
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#f57f17"
                  fill="rgba(245,127,23,0.18)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="xl:col-span-4 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Atividade</h3>
              <p className="text-sm text-gray-500 mt-1">
                {demoMode ? "Eventos fictícios do demo" : "Eventos do sistema"}
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300">
              Live
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {activityFeed.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <p className="text-sm font-semibold text-white">Sem eventos</p>
                <p className="text-sm text-gray-500 mt-1">
                  Assim que chegarem conversas/leads, o feed aparece aqui.
                </p>
              </div>
            ) : (
              activityFeed.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-black/40 p-4 hover:bg-black/50 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className={iconBox(item.tone)}>
                      <item.icon className={iconColor(item.tone)} />
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                      <p className="text-[11px] text-gray-600 mt-2">
                        {item.time}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={onOpenEvents}
              className="w-full h-11 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm font-semibold text-gray-200"
            >
              Ver todos os eventos
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {kpi.label}
                </p>
                <p className="text-4xl font-bold text-white mt-2">{kpi.value}</p>
                <p className="text-sm text-gray-500 mt-1">{kpi.hint}</p>
              </div>

              <div className={iconBox(kpi.tone)}>
                <kpi.icon className={iconColor(kpi.tone)} />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-gray-500">Variação</span>
              <span className={deltaPill(kpi.tone)}>
                <ArrowUpRight className="w-4 h-4" />
                {kpi.delta}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Emotion Distribution */}
        <div className="xl:col-span-7 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-bold text-white">
                Distribuição Emocional
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Onde está o volume e a intenção agora
              </p>
            </div>

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300">
              Últimos 7 dias
            </span>
          </div>

          <div className="mt-6 h-[300px] rounded-2xl border border-white/10 bg-black/40 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
              >
                <XAxis
                  dataKey="name"
                  stroke="#6b7280"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#6b7280" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0b0b0b",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    color: "#fff",
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <Bar dataKey="value" fill="#f57f17" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <InsightCard
              icon={Sparkles}
              title="Ação rápida"
              desc="Priorize os “Prontos” com follow-up imediato + call."
            />
            <InsightCard
              icon={AlertTriangle}
              title="Objeção"
              desc="Preço aparece com frequência → traga ROI e prova social."
            />
            <InsightCard
              icon={ShieldCheck}
              title="Sugerido"
              desc="Automatize tags e rotas por emoção/urgência."
            />
          </div>
        </div>

        {/* Recommendations */}
        <div className="xl:col-span-5 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Ações Recomendadas</h3>
              <p className="text-sm text-gray-500 mt-1">
                O que fazer agora para aumentar conversão
              </p>
            </div>
            <span className="rounded-full border border-[#f57f17]/20 bg-[#f57f17]/10 px-3 py-1.5 text-xs font-semibold text-[#f57f17]">
              DOCA IA
            </span>
          </div>

          <div className="mt-6 space-y-3">
            <ActionItem
              title="1) Atacar leads prontos ✅"
              desc="Fila de follow-up + agenda automática em menos de 5 min."
              tone="green"
            />
            <ActionItem
              title="2) Destravar céticos 😒"
              desc="Prova social + cases + garantia reduz risco."
              tone="orange"
            />
            <ActionItem
              title="3) Sensíveis a preço 💰"
              desc="2 opções (parcela vs à vista) + ROI imediato."
              tone="cyan"
            />
            <ActionItem
              title="4) Frustrados 😤"
              desc="Mensagem empática antes de ofertar. Humanizar."
              tone="red"
            />
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-5">
            <p className="text-sm font-semibold text-white">
              Próximo passo recomendado
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Conectar o módulo{" "}
              <span className="text-gray-200 font-semibold">Análise IA</span>{" "}
              para gerar relatórios automáticos e alertas.
            </p>

            <button
              onClick={onActivateAI}
              className="mt-4 w-full h-11 rounded-2xl border border-[#f57f17]/20 bg-[#f57f17]/10 hover:bg-[#f57f17]/15 transition-all text-sm font-semibold text-[#f57f17] flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Ativar Análise IA
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- UI helpers -------------------- */

function EmptyHint({
  title,
  desc,
  icon: Icon,
}: {
  title: string;
  desc: string;
  icon: any;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#f57f17]" />
        </div>
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>
      <p className="text-sm text-gray-500 mt-2">{desc}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  tooltip,
}: {
  label: string;
  value: string;
  tone: "orange" | "green" | "cyan";
  tooltip?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </p>
        {tooltip && (
          <span className="group relative">
            <Info className="w-3.5 h-3.5 text-gray-600" />
            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-56 -translate-x-1/2 rounded-xl border border-white/10 bg-black/90 px-3 py-2 text-[11px] text-gray-200 opacity-0 shadow-xl transition-all group-hover:opacity-100">
              {tooltip}
            </span>
          </span>
        )}
      </div>

      <p className="text-sm font-bold text-white mt-1">{value}</p>
      <div className={`mt-2 h-1.5 rounded-full ${miniBar(tone)}`} />
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 hover:bg-black/50 transition-all">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#f57f17]" />
        </div>
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>
      <p className="text-sm text-gray-500 mt-2">{desc}</p>
    </div>
  );
}

function ActionItem({
  title,
  desc,
  tone,
}: {
  title: string;
  desc: string;
  tone: "orange" | "green" | "cyan" | "red";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 hover:bg-black/50 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-white font-semibold">{title}</p>
          <p className="text-sm text-gray-500 mt-1">{desc}</p>
        </div>

        <div
          className={`h-10 w-10 rounded-2xl border flex items-center justify-center ${badgeBox(
            tone
          )}`}
        >
          {tone === "green" ? (
            <CheckCircle2 className={badgeIcon(tone)} />
          ) : tone === "red" ? (
            <AlertTriangle className={badgeIcon(tone)} />
          ) : tone === "cyan" ? (
            <Zap className={badgeIcon(tone)} />
          ) : (
            <TrendingUp className={badgeIcon(tone)} />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- styling utils -------------------- */

function iconBox(tone: string) {
  return [
    "h-12 w-12 rounded-2xl border bg-white/5 flex items-center justify-center",
    tone === "green"
      ? "border-green-500/30"
      : tone === "cyan"
      ? "border-cyan-500/30"
      : tone === "red"
      ? "border-red-500/30"
      : "border-[#f57f17]/25",
  ].join(" ");
}

function iconColor(tone: string) {
  return [
    "w-6 h-6",
    tone === "green"
      ? "text-green-400"
      : tone === "cyan"
      ? "text-cyan-400"
      : tone === "red"
      ? "text-red-400"
      : "text-[#f57f17]",
  ].join(" ");
}

function deltaPill(tone: string) {
  return [
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border",
    tone === "green"
      ? "border-green-500/30 bg-green-500/10 text-green-300"
      : tone === "cyan"
      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
      : "border-[#f57f17]/25 bg-[#f57f17]/10 text-[#f57f17]",
  ].join(" ");
}

function badgeBox(tone: string) {
  return [
    "bg-white/5",
    tone === "green"
      ? "border-green-500/30"
      : tone === "cyan"
      ? "border-cyan-500/30"
      : tone === "red"
      ? "border-red-500/30"
      : "border-[#f57f17]/25",
  ].join(" ");
}

function badgeIcon(tone: string) {
  return [
    "w-5 h-5",
    tone === "green"
      ? "text-green-400"
      : tone === "cyan"
      ? "text-cyan-400"
      : tone === "red"
      ? "text-red-400"
      : "text-[#f57f17]",
  ].join(" ");
}

function miniBar(tone: string) {
  return tone === "green"
    ? "bg-gradient-to-r from-green-500/70 to-green-500/10"
    : tone === "cyan"
    ? "bg-gradient-to-r from-cyan-500/70 to-cyan-500/10"
    : "bg-gradient-to-r from-[#f57f17]/70 to-[#f57f17]/10";
}
