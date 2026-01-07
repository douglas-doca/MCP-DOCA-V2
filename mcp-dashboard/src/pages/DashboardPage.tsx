import {
  ArrowUpRight,
  MessageSquare,
  Users,
  Clock,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Conversation } from "../lib/supabase";
import GlassCard from "../components/GlassCard";
import { formatDate } from "../lib/date";

function StatCard({
  label,
  value,
  icon: Icon,
  accent = "orange",
}: {
  label: string;
  value: number;
  icon: any;
  accent?: "orange" | "green";
}) {
  const accentStyles =
    accent === "orange"
      ? {
          badge: "bg-[#f57f17]/10 border-[#f57f17]/20 text-[#f57f17]",
          dot: "bg-[#f57f17]",
          watermark: "text-[#f57f17]",
        }
      : {
          badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
          dot: "bg-emerald-400",
          watermark: "text-emerald-400",
        };

  return (
    <GlassCard className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-3xl font-semibold text-white mt-2">{value}</p>
        </div>

        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs ${accentStyles.badge}`}
        >
          <span className={`w-2 h-2 rounded-full ${accentStyles.dot}`} />
          live
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="text-xs text-slate-500">Últimas 24h</div>
        <div className="flex items-center gap-1 text-xs text-emerald-400">
          <ArrowUpRight className="w-4 h-4" />
          ativo
        </div>
      </div>

      {/* watermark icon */}
      <div className="absolute -right-6 -top-6 opacity-[0.08]">
        <Icon className={`w-24 h-24 ${accentStyles.watermark}`} />
      </div>
    </GlassCard>
  );
}

export default function DashboardPage({ stats, conversations }: any) {
  const statCards: Array<{
    label: string;
    value: number;
    icon: any;
    accent: "orange" | "green";
  }> = [
    {
      label: "Total Conversas",
      value: stats?.totalConversations || 0,
      icon: MessageSquare,
      accent: "orange",
    },
    {
      label: "Conversas Ativas",
      value: stats?.activeConversations || 0,
      icon: Clock,
      accent: "green",
    },
    {
      label: "Total Leads",
      value: stats?.totalLeads || 0,
      icon: Users,
      accent: "orange",
    },
    {
      label: "Leads Qualificados",
      value: stats?.qualifiedLeads || 0,
      icon: CheckCircle,
      accent: "green",
    },
  ];

  const chartData = [
    { name: "Seg", conversas: 12, leads: 4 },
    { name: "Ter", conversas: 19, leads: 7 },
    { name: "Qua", conversas: 15, leads: 5 },
    { name: "Qui", conversas: 25, leads: 9 },
    { name: "Sex", conversas: 22, leads: 8 },
    { name: "Sab", conversas: 8, leads: 2 },
    { name: "Dom", conversas: 5, leads: 1 },
  ];

  const emotionColors: Record<string, string> = {
    excited: "#22c55e",
    curious: "#f57f17",
    ready: "#38bdf8",
    neutral: "#94a3b8",
    anxious: "#fbbf24",
    skeptical: "#fb923c",
    frustrated: "#ef4444",
    price_sensitive: "#a855f7",
  };

  const emotionNames: Record<string, string> = {
    excited: "Empolgado",
    curious: "Curioso",
    ready: "Pronto",
    neutral: "Neutro",
    anxious: "Ansioso",
    skeptical: "Cético",
    frustrated: "Frustrado",
    price_sensitive: "Preço",
  };

  const emotionData =
    stats?.emotionStats
      ? Object.entries(stats.emotionStats).map(([key, value]) => ({
          name: emotionNames[key] || key,
          value: value as number,
          color: emotionColors[key] || "#94a3b8",
        }))
      : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Overview
          </p>
          <h1 className="text-2xl font-semibold text-white mt-1">
            Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Visão executiva e insights em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.06] transition">
            <RefreshCw className="w-4 h-4 text-slate-300" />
            Atualizar
          </button>
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#f57f17]/20 bg-[#f57f17]/10 px-4 py-2 text-sm text-[#f57f17]">
            <span className="w-2 h-2 rounded-full bg-[#f57f17]" />
            API ativa
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GlassCard
          title="Atividade Semanal"
          subtitle="Conversas e leads por dia"
          right={<span className="text-xs text-slate-400">7 dias</span>}
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 15, 25, 0.9)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    backdropFilter: "blur(10px)",
                  }}
                />
                <Bar
                  dataKey="conversas"
                  fill="#f57f17"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="leads"
                  fill="rgba(245,127,23,0.45)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard
          title="Emoções Detectadas"
          subtitle="Distribuição por emoção"
          right={<span className="text-xs text-slate-400">Funil</span>}
        >
          {emotionData.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center">
              <p className="text-slate-500">Sem dados ainda</p>
            </div>
          ) : (
            <>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={emotionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={78}
                      outerRadius={118}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {emotionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(10, 15, 25, 0.9)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "14px",
                        backdropFilter: "blur(10px)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap gap-3 justify-center mt-3">
                {emotionData.map((item, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-300 text-xs">{item.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </GlassCard>
      </div>

      {/* Recent */}
      <GlassCard
        title="Conversas Recentes"
        subtitle="Últimas atualizações"
        right={<span className="text-xs text-slate-400">Top 6</span>}
      >
        <div className="space-y-3">
          {conversations.slice(0, 6).map((conv: Conversation) => (
            <div
              key={conv.id}
              className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/[0.03]
              hover:bg-white/[0.05] hover:border-white/20 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#f57f17]/30 to-[#f57f17]/5 border border-[#f57f17]/20 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {conv.phone?.slice(-2) || "??"}
                  </span>
                </div>

                <div>
                  <p className="text-white font-medium leading-tight">
                    {conv.phone || "Desconhecido"}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {formatDate(conv.updated_at)}
                  </p>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  conv.status === "active"
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                    : "bg-white/[0.04] text-slate-300 border-white/10"
                }`}
              >
                {conv.status === "active" ? "Ativa" : conv.status}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
