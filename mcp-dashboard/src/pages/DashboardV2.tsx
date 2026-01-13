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
  Flame,
  Target,
  Phone,
  ChevronRight,
  Search,
  Lightbulb,
  DollarSign,
  Heart,
  ThermometerSun,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
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
  phone?: string;
  name?: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
  last_message?: string;
  current_emotion?: string;
};

type Lead = {
  id: string;
  name?: string;
  phone?: string;
  status?: string;
  score?: number;
  stage?: string;
  urgency_level?: string;
  health_score?: number;
  conversion_probability?: number;
  tags?: string[];
  updated_at?: string;
};

// ✅ Estágios do funil
const PIPELINE_STAGES = [
  { key: "curioso", label: "Curiosos", icon: Search, color: "bg-blue-500" },
  { key: "cético", label: "Céticos", icon: Lightbulb, color: "bg-fuchsia-500" },
  { key: "sensível_preço", label: "Preço", icon: DollarSign, color: "bg-cyan-500" },
  { key: "empolgado", label: "Empolgados", icon: Heart, color: "bg-emerald-500" },
  { key: "pronto", label: "Prontos", icon: Flame, color: "bg-orange-500" },
];

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

  const hasRealData = !demoMode && (convs.length > 0 || ls.length > 0);

  // ============ MÉTRICAS CALCULADAS ============
  const metrics = useMemo(() => {
    const totalConvs = stats?.conversations_total ?? convs.length;
    const totalLeads = stats?.leads_total ?? ls.length;
    
    // Leads por estágio
    const leadsProonto = ls.filter(l => (l.stage || "").toLowerCase() === "pronto");
    const leadsQuentes = ls.filter(l => ["high", "critical"].includes((l.urgency_level || "").toLowerCase()));
    const leadsEmRisco = ls.filter(l => {
      const health = l.health_score ?? 50;
      const urg = (l.urgency_level || "").toLowerCase();
      return health <= 45 && ["high", "critical"].includes(urg);
    });
    
    // Health médio
    const avgHealth = ls.length > 0 
      ? Math.round(ls.reduce((sum, l) => sum + (l.health_score ?? 50), 0) / ls.length)
      : 0;
    
    // Conversão média
    const avgConversion = ls.length > 0
      ? Math.round(ls.reduce((sum, l) => sum + (l.conversion_probability ?? 0.3) * 100, 0) / ls.length)
      : 0;
    
    // Tempo médio
    const avgTime = stats?.avg_response_time_seconds ?? 0;
    
    // Contagem por estágio
    const stageCounts: Record<string, number> = {};
    ls.forEach(l => {
      const stage = (l.stage || "curioso").toLowerCase();
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });

    return {
      totalConvs,
      totalLeads,
      leadsProonto,
      leadsQuentes,
      leadsEmRisco,
      avgHealth,
      avgConversion,
      avgTime,
      stageCounts,
    };
  }, [stats, convs, ls]);

  // ============ DADOS DO GRÁFICO ============
  const areaData = useMemo(() => {
    if (stats?.activity_last_7_days?.length) return stats.activity_last_7_days;
    
    // Fallback: gera dados dos últimos 7 dias baseado em updated_at
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const counts: Record<string, number> = {};
    days.forEach(d => counts[d] = 0);
    
    convs.forEach(c => {
      if (c.updated_at) {
        const date = new Date(c.updated_at);
        const dayName = days[date.getDay()];
        counts[dayName] = (counts[dayName] || 0) + 1;
      }
    });
    
    return days.map(name => ({ name, value: counts[name] || 0 }));
  }, [stats, convs]);

  // ============ ACTIVITY FEED REAL ============
  const activityFeed = useMemo(() => {
    const events: Array<{
      title: string;
      desc: string;
      time: string;
      icon: any;
      tone: "orange" | "green" | "cyan" | "red";
    }> = [];

    // Últimos leads
    const recentLeads = [...ls]
      .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
      .slice(0, 2);
    
    recentLeads.forEach(lead => {
      const health = lead.health_score ?? 50;
      events.push({
        title: lead.name || fmtPhone(lead.phone || ""),
        desc: `Health ${health} • ${lead.stage || "curioso"}`,
        time: timeAgo(lead.updated_at),
        icon: health >= 70 ? Flame : health >= 40 ? Users : AlertTriangle,
        tone: health >= 70 ? "orange" : health >= 40 ? "cyan" : "red",
      });
    });

    // Status do sistema
    if (convs.length > 0 || ls.length > 0) {
      events.push({
        title: "Sistema operacional",
        desc: `${convs.length} conversas • ${ls.length} leads`,
        time: "agora",
        icon: ShieldCheck,
        tone: "green",
      });
    }

    // Leads em risco
    if (metrics.leadsEmRisco.length > 0) {
      events.push({
        title: `${metrics.leadsEmRisco.length} leads esfriando`,
        desc: "Precisam de atenção urgente",
        time: "ação",
        icon: AlertTriangle,
        tone: "red",
      });
    }

    return events.slice(0, 4);
  }, [convs, ls, metrics]);

  // ============ DEMO DATA ============
  const demoAreaData = [
    { name: "Seg", value: 12 },
    { name: "Ter", value: 18 },
    { name: "Qua", value: 16 },
    { name: "Qui", value: 25 },
    { name: "Sex", value: 21 },
    { name: "Sáb", value: 14 },
    { name: "Dom", value: 9 },
  ];

  const demoActivityFeed = [
    { title: "Novo lead qualificado", desc: "Health Score 78/100", time: "há 2 min", icon: Sparkles, tone: "orange" as const },
    { title: "Objeção detectada", desc: "Preço em 3 conversas", time: "há 12 min", icon: AlertTriangle, tone: "red" as const },
    { title: "Sistema estável", desc: "Webhooks OK", time: "há 31 min", icon: ShieldCheck, tone: "green" as const },
    { title: "Performance", desc: "Tempo médio: 18s", time: "hoje", icon: Zap, tone: "cyan" as const },
  ];

  // Seleciona dados
  const chartData = demoMode ? demoAreaData : areaData;
  const feedData = demoMode ? demoActivityFeed : activityFeed;

  // ============ EMPTY STATE ============
  if (!demoMode && !hasRealData) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300">
            <Database className="w-4 h-4 text-[#f57f17]" />
            Produção
          </div>

          <h2 className="text-3xl font-bold text-white mt-4">Aguardando dados</h2>
          <p className="text-gray-400 mt-2">
            Assim que chegarem conversas via webhook, o dashboard será preenchido automaticamente.
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <EmptyCard icon={MessageSquare} title="1. Envie mensagens" desc="Use o WhatsApp conectado" />
            <EmptyCard icon={ShieldCheck} title="2. Verifique webhook" desc="Endpoint /api respondendo" />
            <EmptyCard icon={Activity} title="3. Aguarde" desc="Dados aparecem em segundos" />
          </div>

          <button onClick={onGoToAnalysis} className="mt-6 h-11 px-5 rounded-2xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-white font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Ir para Análise IA
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============ HERO + DESTAQUE LEADS QUENTES ============ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Hero */}
        <div className="xl:col-span-8 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-7 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-20 -right-40 h-[320px] w-[320px] rounded-full bg-[#f57f17]/20 blur-3xl" />

          <div className="flex items-start justify-between gap-4 flex-wrap relative">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#f57f17]/20 bg-[#f57f17]/10 px-3 py-1.5 text-xs font-semibold text-[#f57f17]">
                <Activity className="w-4 h-4" />
                {demoMode ? "Demo" : "Realtime"}
              </p>

              <h2 className="text-3xl font-bold text-white mt-4">Central de Comando</h2>
              <p className="text-gray-400 mt-2 max-w-xl">
                Visão executiva: volume, qualidade, intenção e performance em tempo real.
              </p>

              <div className="mt-5 flex items-center gap-3 flex-wrap">
                <button onClick={onOpenInsights} className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-white text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Ver Funil
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={onOpenSuggestions} className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#f57f17]" />
                  Sugestões IA
                </button>
              </div>
            </div>

            {/* Mini Stats */}
            <div className="grid grid-cols-3 gap-3">
              <MiniStatCard label="Health" value={demoMode ? "72" : String(metrics.avgHealth)} suffix="%" color="text-emerald-400" />
              <MiniStatCard label="Conversão" value={demoMode ? "34" : String(metrics.avgConversion)} suffix="%" color="text-cyan-400" />
              <MiniStatCard label="Tempo" value={demoMode ? "18" : metrics.avgTime > 0 ? String(Math.round(metrics.avgTime)) : "—"} suffix="s" color="text-orange-400" />
            </div>
          </div>

          {/* Chart */}
          <div className="mt-6 h-[200px] rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs text-gray-500 mb-2">Atividade • últimos 7 dias</p>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#6b7280" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="#6b7280" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0b0b0b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff" }}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <Area type="monotone" dataKey="value" stroke="#f57f17" fill="rgba(245,127,23,0.2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leads Quentes */}
        <div className="xl:col-span-4 rounded-[28px] border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent backdrop-blur-xl p-6 relative overflow-hidden">
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-orange-500/20 blur-3xl" />

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-bold">Leads Quentes</h3>
                <p className="text-xs text-gray-500">Prontos para fechar</p>
              </div>
            </div>
            <span className="text-3xl font-black text-orange-400">
              {demoMode ? "6" : metrics.leadsProonto.length}
            </span>
          </div>

          {/* Preview dos leads */}
          <div className="space-y-2 mb-4">
            {(demoMode ? [
              { name: "João Silva", health: 85 },
              { name: "Maria Santos", health: 78 },
              { name: "Pedro Costa", health: 72 },
            ] : metrics.leadsProonto.slice(0, 3).map(l => ({
              name: l.name || fmtPhone(l.phone || ""),
              health: l.health_score || 50
            }))).map((lead, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/20 border border-white/5">
                <span className="text-sm text-gray-300 truncate">{lead.name}</span>
                <span className="text-xs font-bold text-orange-400">{lead.health}</span>
              </div>
            ))}
          </div>

          <button onClick={onGoToAnalysis} className="w-full h-10 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition text-sm font-semibold text-white flex items-center justify-center gap-2">
            <Phone className="w-4 h-4" />
            Executar Follow-ups
          </button>

          {metrics.leadsEmRisco.length > 0 && !demoMode && (
            <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{metrics.leadsEmRisco.length} leads esfriando</span>
            </div>
          )}
        </div>
      </div>

      {/* ============ KPIs ============ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard 
          icon={MessageSquare} 
          label="Conversas" 
          value={demoMode ? "87" : String(metrics.totalConvs)} 
          delta={demoMode ? "+12%" : "—"} 
          color="orange" 
        />
        <KPICard 
          icon={Users} 
          label="Leads" 
          value={demoMode ? "34" : String(metrics.totalLeads)} 
          delta={demoMode ? "+9%" : "—"} 
          color="cyan" 
        />
        <KPICard 
          icon={Flame} 
          label="Quentes" 
          value={demoMode ? "12" : String(metrics.leadsQuentes.length)} 
          delta={demoMode ? "+4%" : "—"} 
          color="orange" 
        />
        <KPICard 
          icon={ThermometerSun} 
          label="Health Médio" 
          value={demoMode ? "68" : String(metrics.avgHealth)} 
          delta={demoMode ? "+5%" : "—"} 
          color="green" 
        />
      </div>

      {/* ============ PIPELINE MINI + ACTIVITY ============ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Mini Pipeline */}
        <div className="xl:col-span-7 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-bold">Pipeline Emocional</h3>
              <p className="text-xs text-gray-500 mt-1">Distribuição por estágio</p>
            </div>
            <button onClick={onOpenInsights} className="text-xs text-[#f57f17] hover:underline flex items-center gap-1">
              Ver completo <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {PIPELINE_STAGES.map(stage => {
              const count = demoMode 
                ? Math.floor(Math.random() * 15) + 2 
                : metrics.stageCounts[stage.key] || 0;
              const total = demoMode ? 50 : metrics.totalLeads || 1;
              const percent = Math.round((count / total) * 100);
              const Icon = stage.icon;

              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg ${stage.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300">{stage.label}</span>
                      <span className="text-sm font-bold text-white">{count}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${stage.color} rounded-full transition-all`} style={{ width: `${Math.max(percent, 3)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="xl:col-span-5 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-bold">Atividade</h3>
              <p className="text-xs text-gray-500 mt-1">Eventos recentes</p>
            </div>
            <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">LIVE</span>
          </div>

          <div className="space-y-3">
            {feedData.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Nenhum evento recente
              </div>
            ) : (
              feedData.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 px-3 py-3 rounded-xl bg-black/20 border border-white/5">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.tone === "green" ? "bg-emerald-500/20" :
                    item.tone === "red" ? "bg-red-500/20" :
                    item.tone === "cyan" ? "bg-cyan-500/20" : "bg-orange-500/20"
                  }`}>
                    <item.icon className={`w-4 h-4 ${
                      item.tone === "green" ? "text-emerald-400" :
                      item.tone === "red" ? "text-red-400" :
                      item.tone === "cyan" ? "text-cyan-400" : "text-orange-400"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">{item.time}</span>
                </div>
              ))
            )}
          </div>

          <button onClick={onOpenEvents} className="mt-4 w-full h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300">
            Ver todos os eventos
          </button>
        </div>
      </div>

      {/* ============ AÇÕES RECOMENDADAS ============ */}
      <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold">Ações Recomendadas</h3>
            <p className="text-xs text-gray-500 mt-1">O que fazer agora para aumentar conversão</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#f57f17]/10 border border-[#f57f17]/20 text-[#f57f17] text-xs font-bold">DOCA IA</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ActionCard 
            icon={Target} 
            title="Atacar prontos" 
            desc="Follow-up imediato com CTA de call" 
            color="green" 
          />
          <ActionCard 
            icon={Lightbulb} 
            title="Destravar céticos" 
            desc="Prova social e cases de sucesso" 
            color="orange" 
          />
          <ActionCard 
            icon={DollarSign} 
            title="Sensíveis a preço" 
            desc="2 opções: parcela vs à vista + ROI" 
            color="cyan" 
          />
          <ActionCard 
            icon={Heart} 
            title="Frustrados" 
            desc="Mensagem empática antes de ofertar" 
            color="red" 
          />
        </div>

        <div className="mt-5 p-4 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-white font-medium">Próximo passo</p>
            <p className="text-xs text-gray-500 mt-0.5">Conectar módulo Análise IA para relatórios automáticos</p>
          </div>
          <button onClick={onActivateAI} className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-white text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Ativar Análise IA
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ COMPONENTES AUXILIARES ============

function EmptyCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-[#f57f17]" />
      </div>
      <p className="text-sm text-white font-medium">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </div>
  );
}

function MiniStatCard({ label, value, suffix, color }: { label: string; value: string; suffix: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${color} mt-1`}>
        {value}<span className="text-sm opacity-60">{suffix}</span>
      </p>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, delta, color }: { icon: any; label: string; value: string; delta: string; color: "orange" | "cyan" | "green" }) {
  const colors = {
    orange: { bg: "bg-orange-500/10", border: "border-orange-500/20", icon: "text-orange-400", delta: "bg-orange-500/20 text-orange-300" },
    cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", icon: "text-cyan-400", delta: "bg-cyan-500/20 text-cyan-300" },
    green: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: "text-emerald-400", delta: "bg-emerald-500/20 text-emerald-300" },
  };
  const c = colors[color];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-500">Variação</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.delta}`}>{delta}</span>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, desc, color }: { icon: any; title: string; desc: string; color: "green" | "orange" | "cyan" | "red" }) {
  const colors = {
    green: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: "text-emerald-400" },
    orange: { bg: "bg-orange-500/10", border: "border-orange-500/20", icon: "text-orange-400" },
    cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", icon: "text-cyan-400" },
    red: { bg: "bg-red-500/10", border: "border-red-500/20", icon: "text-red-400" },
  };
  const c = colors[color];

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 hover:opacity-80 transition cursor-pointer`}>
      <div className={`h-9 w-9 rounded-lg ${c.bg} border ${c.border} flex items-center justify-center mb-3`}>
        <Icon className={`w-4 h-4 ${c.icon}`} />
      </div>
      <p className="text-sm text-white font-medium">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </div>
  );
}

// ============ HELPERS ============

function fmtPhone(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 10) return phone;
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function timeAgo(date: string | null | undefined): string {
  if (!date) return "—";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  return `há ${days}d`;
}