import React, { useMemo, useRef, useState } from "react";
import {
  Download,
  CalendarDays,
  Sparkles,
  FileText,
  TrendingUp,
  Users,
  Target,
  Flame,
  X,
  CheckCircle2,
  AlertTriangle,
  Search,
  DollarSign,
  Heart,
  Lightbulb,
  Printer,
  Clock,
  BarChart3,
  PieChart,
} from "lucide-react";
import { isDemoMode, getDemoData } from "../mock";
import { exportElementToPdf } from "../lib/exportPdf";

type PeriodKey = "today" | "7d" | "30d" | "90d";

type Props = {
  leads?: any[];
  conversations?: any[];
  onGoToFunnel?: () => void;
};

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
];

export default function ReportsPage({ leads: propsLeads, conversations: propsConvs, onGoToFunnel }: Props) {
  const demoMode = isDemoMode();
  const demo = useMemo(() => (demoMode ? getDemoData() : null), [demoMode]);

  const leads = useMemo(() => {
    if (propsLeads && propsLeads.length > 0) return propsLeads;
    if (demoMode && demo?.leads) return demo.leads;
    return [];
  }, [propsLeads, demoMode, demo]);

  const conversations = useMemo(() => {
    if (propsConvs && propsConvs.length > 0) return propsConvs;
    if (demoMode && demo?.conversations) return demo.conversations;
    return [];
  }, [propsConvs, demoMode, demo]);

  const exportRef = useRef<HTMLDivElement | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [insightModal, setInsightModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ============ MÉTRICAS CALCULADAS ============

  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    const totalConvs = conversations.length;

    // Health médio
    const healthScores = leads.map(l => l.health_score ?? l.score ?? 50).filter(Boolean);
    const avgHealth = healthScores.length > 0 
      ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length) 
      : 0;

    // Conversão média
    const convProbs = leads.map(l => l.conversion_probability ?? 0.4);
    const avgConversion = convProbs.length > 0
      ? Math.round((convProbs.reduce((a, b) => a + b, 0) / convProbs.length) * 100)
      : 0;

    // Distribuição por estágio
    const stages: Record<string, number> = {};
    leads.forEach(l => {
      const st = l.stage || "curioso";
      stages[st] = (stages[st] || 0) + 1;
    });

    // Leads por urgência
    const urgencyHigh = leads.filter(l => l.urgency_level === "high" || l.urgency_level === "critical").length;
    const urgencyCritical = leads.filter(l => l.urgency_level === "critical").length;
    const urgencyNormal = leads.filter(l => l.urgency_level === "normal" || !l.urgency_level).length;
    const urgencyLow = leads.filter(l => l.urgency_level === "low").length;

    // Leads prontos
    const prontos = leads.filter(l => (l.stage || "").toLowerCase() === "pronto").length;
    const empolgados = leads.filter(l => (l.stage || "").toLowerCase() === "empolgado").length;
    const curiosos = leads.filter(l => (l.stage || "").toLowerCase() === "curioso").length;
    const ceticos = leads.filter(l => (l.stage || "").toLowerCase() === "cético").length;
    const preco = leads.filter(l => (l.stage || "").toLowerCase().includes("preço")).length;
    
    const conversionRate = totalLeads > 0 ? Math.round((prontos / totalLeads) * 100) : 0;

    // Status
    const statusNew = leads.filter(l => l.status === "new").length;
    const statusContacted = leads.filter(l => l.status === "contacted").length;
    const statusQualified = leads.filter(l => l.status === "qualified").length;
    const statusWon = leads.filter(l => l.status === "won").length;
    const statusLost = leads.filter(l => l.status === "lost").length;

    // Leads em risco
    const emRisco = leads.filter(l => 
      (l.health_score ?? 50) <= 40 && 
      (l.urgency_level === "high" || l.urgency_level === "critical")
    ).length;

    // Leads quentes (health >= 70)
    const quentes = leads.filter(l => (l.health_score ?? 50) >= 70).length;

    // Leads frios (health <= 30)
    const frios = leads.filter(l => (l.health_score ?? 50) <= 30).length;

    // Tags mais comuns
    const tagCounts: Record<string, number> = {};
    leads.forEach(l => {
      (l.tags || []).forEach((t: string) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    return {
      totalLeads,
      totalConvs,
      avgHealth,
      avgConversion,
      stages,
      urgencyHigh,
      urgencyCritical,
      urgencyNormal,
      urgencyLow,
      prontos,
      empolgados,
      curiosos,
      ceticos,
      preco,
      conversionRate,
      statusNew,
      statusContacted,
      statusQualified,
      statusWon,
      statusLost,
      emRisco,
      quentes,
      frios,
      topTags,
    };
  }, [leads, conversations]);

  // ============ INSIGHTS IA ============

  const insights = useMemo(() => {
    const list: { type: "success" | "warning" | "danger"; text: string }[] = [];

    if (metrics.conversionRate >= 20) {
      list.push({ type: "success", text: "Excelente! Seu funil está com alta conversão." });
    } else if (metrics.conversionRate >= 10) {
      list.push({ type: "warning", text: "Bom potencial. Aumente follow-ups nos leads quentes." });
    } else if (metrics.totalLeads > 0) {
      list.push({ type: "danger", text: "Conversão baixa. Foco em remover objeções e criar urgência." });
    }

    if (metrics.avgHealth >= 70) {
      list.push({ type: "success", text: "Health médio alto! Leads engajados." });
    } else if (metrics.avgHealth >= 50) {
      list.push({ type: "warning", text: "Health médio OK. Alguns leads podem esfriar." });
    } else if (metrics.totalLeads > 0) {
      list.push({ type: "danger", text: "Health médio baixo. Risco de perder leads." });
    }

    if (metrics.emRisco > 0) {
      list.push({ type: "danger", text: `${metrics.emRisco} lead(s) em risco crítico precisam de atenção.` });
    }

    if (metrics.urgencyHigh > 0) {
      list.push({ type: "warning", text: `${metrics.urgencyHigh} lead(s) com urgência alta aguardando ação.` });
    }

    if (metrics.prontos > 0) {
      list.push({ type: "success", text: `${metrics.prontos} lead(s) prontos para fechar!` });
    }

    if (metrics.frios > 0) {
      list.push({ type: "warning", text: `${metrics.frios} lead(s) frios precisam de reativação.` });
    }

    if (list.length === 0) {
      list.push({ type: "warning", text: "Sem dados suficientes para gerar insights." });
    }

    return list;
  }, [metrics]);

  // ============ STAGE DATA ============

  const stageData = useMemo(() => {
    const order = ["curioso", "cético", "sensível_preço", "empolgado", "pronto"];
    const labels: Record<string, string> = {
      curioso: "Curiosos",
      cético: "Céticos",
      sensível_preço: "Sensíveis a Preço",
      empolgado: "Empolgados",
      pronto: "Prontos",
    };
    const colors: Record<string, string> = {
      curioso: "bg-blue-500",
      cético: "bg-fuchsia-500",
      sensível_preço: "bg-cyan-500",
      empolgado: "bg-emerald-500",
      pronto: "bg-orange-500",
    };
    const icons: Record<string, any> = {
      curioso: Search,
      cético: Lightbulb,
      sensível_preço: DollarSign,
      empolgado: Heart,
      pronto: Flame,
    };

    const total = leads.length || 1;
    return order.map(key => ({
      key,
      label: labels[key] || key,
      count: metrics.stages[key] || 0,
      pct: Math.round(((metrics.stages[key] || 0) / total) * 100),
      color: colors[key] || "bg-gray-500",
      Icon: icons[key] || Users,
    }));
  }, [leads, metrics.stages]);

  // ============ EXPORT PDF ============

  async function handleExportPdf() {
    if (!exportRef.current) return;
    setExporting(true);
    
    try {
      const periodLabel = PERIODS.find(p => p.key === period)?.label || period;
      const date = new Date().toLocaleDateString("pt-BR");
      const time = new Date().toLocaleTimeString("pt-BR");
      
      await exportElementToPdf(exportRef.current, {
        filename: `Relatorio-DOCA-${periodLabel}-${date.replace(/\//g, "-")}.pdf`,
        scale: 2,
        backgroundColor: "#0a0a0a",
        orientation: "p",
      });
    } catch (e: any) {
      console.error("Erro ao exportar PDF:", e);
      alert("Erro ao exportar PDF: " + (e?.message || "Erro desconhecido"));
    } finally {
      setExporting(false);
    }
  }

  const periodLabel = PERIODS.find(p => p.key === period)?.label || period;
  const reportDate = new Date().toLocaleDateString("pt-BR");
  const reportTime = new Date().toLocaleTimeString("pt-BR");

  // ============ RENDER ============

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#f57f17]" />
            Relatórios
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Performance do funil, métricas e insights
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="h-10 px-3 rounded-xl border border-white/10 bg-white/5 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-400" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
              className="bg-transparent outline-none text-sm text-gray-200"
            >
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key} className="bg-black">
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setInsightModal(true)}
            className="h-10 px-4 rounded-xl border border-[#f57f17]/30 bg-[#f57f17]/10 hover:bg-[#f57f17]/20 text-sm font-semibold text-white flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-[#f57f17]" />
            Insights IA
          </button>

          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] hover:opacity-90 disabled:opacity-50 text-sm font-semibold text-white flex items-center gap-2"
          >
            {exporting ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Exportar PDF
              </>
            )}
          </button>

          <button
            onClick={onGoToFunnel}
            className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-200 flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Ir para Funil
          </button>
        </div>
      </div>

      {/* EXPORTABLE CONTENT */}
      <div ref={exportRef} className="space-y-6 bg-[#0a0a0a] p-6 rounded-[28px]">
        
        {/* Report Header (for PDF) */}
        <div className="border-b border-white/10 pb-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-[#f57f17]/20 border border-[#f57f17]/30 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-[#f57f17]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Relatório DOCA AI</h1>
                <p className="text-gray-500 text-sm">Central de Comando - Análise de Performance</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-semibold">Período: {periodLabel}</p>
              <p className="text-gray-500 text-sm">Gerado em {reportDate} às {reportTime}</p>
            </div>
          </div>
        </div>

        {/* Resumo Executivo */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-[#f57f17]" />
            Resumo Executivo
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Total de Leads" value={metrics.totalLeads} icon={Users} color="text-blue-400" />
            <KPICard label="Conversas" value={metrics.totalConvs} icon={FileText} color="text-purple-400" />
            <KPICard label="Health Médio" value={`${metrics.avgHealth}%`} icon={Heart} 
              color={metrics.avgHealth >= 70 ? "text-emerald-400" : metrics.avgHealth >= 50 ? "text-yellow-400" : "text-red-400"} />
            <KPICard label="Conversão Média" value={`${metrics.avgConversion}%`} icon={Target} color="text-cyan-400" />
          </div>
        </div>

        {/* Pipeline por Estágio */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#f57f17]" />
            Distribuição do Pipeline
          </h3>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="grid grid-cols-5 gap-4 mb-4">
              {stageData.map((st) => (
                <div key={st.key} className="text-center">
                  <div className={`h-10 w-10 mx-auto rounded-xl ${st.color}/20 flex items-center justify-center mb-2`}>
                    <st.Icon className={`w-5 h-5 ${st.color.replace("bg-", "text-")}`} />
                  </div>
                  <p className="text-2xl font-bold text-white">{st.count}</p>
                  <p className="text-xs text-gray-500">{st.label}</p>
                  <p className="text-xs text-gray-600">{st.pct}%</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {stageData.map((st) => (
                <div key={st.key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-24">{st.label}</span>
                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${st.color} rounded-full`} style={{ width: `${st.pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right">{st.count} ({st.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status e Urgência */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Status */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Status dos Leads</h3>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="space-y-3">
                <StatusRow label="Novos" value={metrics.statusNew} total={metrics.totalLeads} color="bg-blue-500" />
                <StatusRow label="Contatados" value={metrics.statusContacted} total={metrics.totalLeads} color="bg-yellow-500" />
                <StatusRow label="Qualificados" value={metrics.statusQualified} total={metrics.totalLeads} color="bg-purple-500" />
                <StatusRow label="Ganhos" value={metrics.statusWon} total={metrics.totalLeads} color="bg-emerald-500" />
                <StatusRow label="Perdidos" value={metrics.statusLost} total={metrics.totalLeads} color="bg-red-500" />
              </div>
            </div>
          </div>

          {/* Urgência */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Nível de Urgência</h3>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="space-y-3">
                <StatusRow label="Crítica" value={metrics.urgencyCritical} total={metrics.totalLeads} color="bg-red-500" />
                <StatusRow label="Alta" value={metrics.urgencyHigh - metrics.urgencyCritical} total={metrics.totalLeads} color="bg-orange-500" />
                <StatusRow label="Normal" value={metrics.urgencyNormal} total={metrics.totalLeads} color="bg-gray-500" />
                <StatusRow label="Baixa" value={metrics.urgencyLow} total={metrics.totalLeads} color="bg-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Health Distribution */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-4">Saúde dos Leads</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-center">
              <Flame className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-emerald-300">{metrics.quentes}</p>
              <p className="text-sm text-emerald-400">Leads Quentes</p>
              <p className="text-xs text-gray-500">Health ≥ 70</p>
            </div>
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 text-center">
              <Users className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-yellow-300">{metrics.totalLeads - metrics.quentes - metrics.frios}</p>
              <p className="text-sm text-yellow-400">Leads Mornos</p>
              <p className="text-xs text-gray-500">Health 31-69</p>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5 text-center">
              <AlertTriangle className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-blue-300">{metrics.frios}</p>
              <p className="text-sm text-blue-400">Leads Frios</p>
              <p className="text-xs text-gray-500">Health ≤ 30</p>
            </div>
          </div>
        </div>

        {/* Métricas de Conversão */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-4">Métricas de Conversão</h3>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <MetricBox label="Taxa de Conversão" value={`${metrics.conversionRate}%`} hint="Prontos / Total" 
                tone={metrics.conversionRate >= 15 ? "good" : metrics.conversionRate >= 8 ? "mid" : "bad"} />
              <MetricBox label="Leads Prontos" value={metrics.prontos} hint="Estágio final" tone="good" />
              <MetricBox label="Em Risco" value={metrics.emRisco} hint="Health baixo + Urgência alta" 
                tone={metrics.emRisco > 0 ? "bad" : "good"} />
              <MetricBox label="Aguardando Ação" value={metrics.urgencyHigh} hint="Urgência alta" 
                tone={metrics.urgencyHigh > 3 ? "bad" : metrics.urgencyHigh > 0 ? "mid" : "good"} />
            </div>
          </div>
        </div>

        {/* Tags mais comuns */}
        {metrics.topTags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Tags Mais Frequentes</h3>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap gap-2">
                {metrics.topTags.map(({ tag, count }) => (
                  <span key={tag} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
                    {tag} <span className="text-gray-500">({count})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Insights IA */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#f57f17]" />
            Insights da IA
          </h3>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            {insights.map((ins, i) => (
              <div key={i} className={`p-3 rounded-xl border ${
                ins.type === "success" ? "bg-emerald-500/10 border-emerald-500/20" :
                ins.type === "warning" ? "bg-yellow-500/10 border-yellow-500/20" :
                "bg-red-500/10 border-red-500/20"
              }`}>
                <p className={`text-sm flex items-center gap-2 ${
                  ins.type === "success" ? "text-emerald-300" :
                  ins.type === "warning" ? "text-yellow-300" : "text-red-300"
                }`}>
                  {ins.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {ins.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Ações Recomendadas */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Ações Recomendadas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ActionCard title="1. Atacar leads prontos" desc="CTA direto + agendamento. A janela é curta." 
              pill={`${metrics.prontos} leads`} priority={metrics.prontos > 0} />
            <ActionCard title="2. Follow-up urgentes" desc="Leads com urgência alta precisam de resposta rápida." 
              pill={`${metrics.urgencyHigh} leads`} priority={metrics.urgencyHigh > 0} />
            <ActionCard title="3. Recuperar em risco" desc="Health baixo + urgência alta = risco de perder." 
              pill={`${metrics.emRisco} leads`} priority={metrics.emRisco > 0} />
            <ActionCard title="4. Reativar leads frios" desc="Nutrição com conteúdo relevante para reaquecer." 
              pill={`${metrics.frios} leads`} priority={metrics.frios > 0} />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 pt-6 mt-6">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>DOCA AI - Central de Comando</span>
            <span>Relatório gerado automaticamente em {reportDate} às {reportTime}</span>
          </div>
        </div>
      </div>

      {/* Modal de Insights */}
      {insightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#f57f17]" />
                Insights IA
              </h3>
              <button onClick={() => setInsightModal(false)}
                className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              {insights.map((ins, i) => (
                <div key={i} className={`p-4 rounded-xl border ${
                  ins.type === "success" ? "bg-emerald-500/10 border-emerald-500/20" :
                  ins.type === "warning" ? "bg-yellow-500/10 border-yellow-500/20" :
                  "bg-red-500/10 border-red-500/20"
                }`}>
                  <p className={`text-sm flex items-center gap-2 ${
                    ins.type === "success" ? "text-emerald-300" :
                    ins.type === "warning" ? "text-yellow-300" : "text-red-300"
                  }`}>
                    {ins.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {ins.text}
                  </p>
                </div>
              ))}
            </div>
            <button onClick={() => setInsightModal(false)}
              className="mt-6 w-full h-11 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white">
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ COMPONENTS ============

function KPICard({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function StatusRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`h-3 w-3 rounded-full ${color}`} />
      <span className="text-sm text-gray-300 w-24">{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-20 text-right">{value} ({pct}%)</span>
    </div>
  );
}

function MetricBox({ label, value, hint, tone }: { label: string; value: any; hint: string; tone: "good" | "mid" | "bad" }) {
  const colors = { good: "text-emerald-400", mid: "text-yellow-400", bad: "text-red-400" };
  return (
    <div className="text-center">
      <p className={`text-3xl font-bold ${colors[tone]}`}>{value}</p>
      <p className="text-sm text-white mt-1">{label}</p>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function ActionCard({ title, desc, pill, priority }: { title: string; desc: string; pill: string; priority: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${priority ? "border-[#f57f17]/30 bg-[#f57f17]/5" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-semibold">{title}</p>
          <p className="text-gray-500 text-sm mt-1">{desc}</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold whitespace-nowrap ${
          priority ? "bg-[#f57f17]/20 border border-[#f57f17]/30 text-[#f57f17]" : "bg-white/5 border border-white/10 text-gray-400"
        }`}>
          {pill}
        </span>
      </div>
    </div>
  );
}