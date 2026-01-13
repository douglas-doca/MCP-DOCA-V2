import { useState, useEffect } from "react";
import { BarChart3, Download, Users, MessageSquare, Zap, TrendingUp, Building2, Loader2, RefreshCw } from "lucide-react";

type TenantMetrics = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  metrics: {
    conversations: number;
    leads: number;
    qualified_leads: number;
    conversion_rate: number;
    messages: number;
    assistant_messages: number;
    tokens_used: number;
    avg_messages_per_conversation: number;
  };
};

const API_BASE = "/api";

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<TenantMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      
      const res = await fetch(`${API_BASE}/tenants/metrics`);
      const data = await res.json();
      setMetrics(Array.isArray(data) ? data : [data]);
    } catch (err) {
      console.error("Error loading metrics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const exportCSV = () => {
    const headers = ["Cliente", "Slug", "Conversas", "Leads", "Qualificados", "Conversão %", "Mensagens", "Respostas IA", "Tokens"];
    const rows = metrics.map(m => [
      m.tenant_name,
      m.tenant_slug,
      m.metrics.conversations,
      m.metrics.leads,
      m.metrics.qualified_leads,
      m.metrics.conversion_rate,
      m.metrics.messages,
      m.metrics.assistant_messages,
      m.metrics.tokens_used,
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `metricas_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // Totais gerais
  const totals = metrics.reduce(
    (acc, m) => ({
      conversations: acc.conversations + m.metrics.conversations,
      leads: acc.leads + m.metrics.leads,
      qualified: acc.qualified + m.metrics.qualified_leads,
      messages: acc.messages + m.metrics.messages,
      tokens: acc.tokens + m.metrics.tokens_used,
    }),
    { conversations: 0, leads: 0, qualified: 0, messages: 0, tokens: 0 }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#f57f17] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#f57f17]" />
            Métricas por Cliente
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Consumo e performance de cada tenant
          </p>
        </div>
        
        <button
          onClick={() => loadMetrics(true)}
          disabled={refreshing}
          className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Totais Gerais */}
      <div className="rounded-2xl border border-[#f57f17]/30 bg-[#f57f17]/5 p-5">
        <h3 className="text-sm font-semibold text-[#f57f17] mb-4">TOTAIS GERAIS</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard label="Conversas" value={totals.conversations} icon={MessageSquare} color="text-blue-400" />
          <MetricCard label="Leads" value={totals.leads} icon={Users} color="text-emerald-400" />
          <MetricCard label="Qualificados" value={totals.qualified} icon={TrendingUp} color="text-amber-400" />
          <MetricCard label="Mensagens" value={totals.messages} icon={MessageSquare} color="text-cyan-400" />
          <MetricCard label="Tokens" value={totals.tokens.toLocaleString()} icon={Zap} color="text-purple-400" />
        </div>
      </div>

      {/* Por Cliente */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase">Por Cliente</h3>
        
        {metrics.map((m) => (
          <div key={m.tenant_id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-[#f57f17]/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#f57f17]" />
              </div>
              <div>
                <h4 className="font-semibold text-white">{m.tenant_name}</h4>
                <p className="text-xs text-gray-500">@{m.tenant_slug}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="text-center p-3 rounded-lg bg-white/5">
                <p className="text-lg font-bold text-white">{m.metrics.conversations}</p>
                <p className="text-xs text-gray-500">Conversas</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <p className="text-lg font-bold text-white">{m.metrics.leads}</p>
                <p className="text-xs text-gray-500">Leads</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <p className="text-lg font-bold text-emerald-400">{m.metrics.qualified_leads}</p>
                <p className="text-xs text-gray-500">Qualificados</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <p className="text-lg font-bold text-amber-400">{m.metrics.conversion_rate}%</p>
                <p className="text-xs text-gray-500">Conversão</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <p className="text-lg font-bold text-white">{m.metrics.messages}</p>
                <p className="text-xs text-gray-500">Mensagens</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <p className="text-lg font-bold text-cyan-400">{m.metrics.assistant_messages}</p>
                <p className="text-xs text-gray-500">Respostas IA</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <p className="text-lg font-bold text-purple-400">{m.metrics.tokens_used.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Tokens</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <p className="text-lg font-bold text-white">{m.metrics.avg_messages_per_conversation}</p>
                <p className="text-xs text-gray-500">Msgs/Conv</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
