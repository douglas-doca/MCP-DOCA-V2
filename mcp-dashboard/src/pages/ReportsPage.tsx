// src/pages/ReportsPage.tsx
import React, { useMemo, useRef, useState } from "react";
import {
  Download,
  Filter,
  CalendarDays,
  Sparkles,
  ArrowRight,
  FileText,
  Shield,
  TrendingUp,
} from "lucide-react";
import GlassCard from "../components/GlassCard";
import { useDashboardMetrics } from "../hooks/useEmotionData";
import { isDemoMode } from "../mock";
import { exportElementToPdf, exportElementToPdf as exportPdf } from "../lib/exportPdf";

type PeriodKey = "today" | "7d" | "30d" | "90d";

type Props = {
  onGoToFunnel?: () => void;
};

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
];

function formatPct(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  const sign = x > 0 ? "+" : "";
  return `${sign}${x.toFixed(0)}%`;
}

function safe(n: any, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function pillBase() {
  return "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl px-4 py-2 text-sm text-gray-200 hover:bg-white/[0.06] transition";
}

function btnBase() {
  return "inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08] transition";
}

function btnPrimary() {
  return "inline-flex items-center gap-2 rounded-2xl border border-[#f57f17]/35 bg-[#f57f17]/15 backdrop-blur-xl px-4 py-2 text-sm font-semibold text-white hover:bg-[#f57f17]/20 transition shadow-[0_0_0_1px_rgba(245,127,23,0.12)]";
}

export default function ReportsPage({ onGoToFunnel }: Props) {
  const { data, loading, error } = useDashboardMetrics();
  const demoMode = useMemo(() => isDemoMode(), []);

  const exportRef = useRef<HTMLDivElement | null>(null);

  // Filtros (no futuro isso vira query params)
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [channel, setChannel] = useState<"all" | "whatsapp" | "instagram">("all");
  const [leadStatus, setLeadStatus] = useState<
    "all" | "new" | "active" | "won" | "lost"
  >("all");

  // -------------------------------------------------------
  // Dados
  // -------------------------------------------------------
  const totalLeadsRaw = safe(data?.total_leads, 0);
  const avgHealthRaw = Math.round(safe(data?.avg_health_score, 0));
  const avgTempRaw = Math.round(safe(data?.avg_temperature, 0));
  const totalEventsRaw = safe(data?.total_emotion_events, 0);

  // Se PROD tá zerado, a UX fica feia.
  // Então no DEMO a gente preenche com fallback premium.
  // No PROD: se vier 0, mostramos ainda 0 (mas com sugestão).
  const totalLeads = demoMode ? Math.max(totalLeadsRaw, 35) : totalLeadsRaw;
  const avgHealth = demoMode ? Math.max(avgHealthRaw, 76) : avgHealthRaw;
  const avgTemp = demoMode ? Math.max(avgTempRaw, 68) : avgTempRaw;
  const totalEvents = demoMode ? Math.max(totalEventsRaw, 128) : totalEventsRaw;

  // Estimativa de conversão (até ter won/total real)
  const stageDist = data?.stage_distribution || {};
  const prontoGuess = safe((stageDist as any)?.pronto, demoMode ? 8 : 0);
  const conversionRate = totalLeads > 0 ? (prontoGuess / totalLeads) * 100 : 0;

  // Variações (mock de comparação)
  const deltaLeads = demoMode ? 18 : 0;
  const deltaConv = demoMode ? 9 : 0;
  const deltaHealth = demoMode ? 6 : 0;
  const deltaTemp = demoMode ? -2 : 0;
  const deltaEvents = demoMode ? 22 : 0;

  // -------------------------------------------------------
  // Ações
  // -------------------------------------------------------
  function handleInsightIA() {
    // Aqui pode virar modal depois
    const insights: string[] = [];

    if (conversionRate >= 20) {
      insights.push("Seu funil está forte: alta proporção em PRONTO.");
    } else if (conversionRate >= 10) {
      insights.push("Bom potencial: aumente follow-up nos leads quentes.");
    } else {
      insights.push("Baixa conversão: precisamos elevar intenção e remover fricção.");
    }

    if (avgHealth < 55) {
      insights.push("Health médio está baixo: há risco de esfriar.");
    } else if (avgHealth >= 75) {
      insights.push("Health alto: ótimo momento para atacar leads no topo.");
    }

    if (totalEvents < 30) {
      insights.push("Poucos eventos emocionais: falta volume para leitura do modelo.");
    }

    insights.push("Sugestão: execute o Plano do Dia no Funil para destacar leads críticos.");

    alert(insights.join("\n• ").replace(/^/, "• "));
  }

  async function handleExportPdf() {
    try {
      if (!exportRef.current) return;

await exportElementToPdf(exportRef.current, {
  filename: "Relatorio-DOCA.pdf",
  scale: 2,
  backgroundColor: "#0b0f19",
});
    } catch (e: any) {
      alert(e?.message || "Falha ao exportar PDF");
    }
  }

  // -------------------------------------------------------
  // UI Helpers
  // -------------------------------------------------------
  const emptyProd = !demoMode && !loading && !error && totalLeadsRaw === 0;

  return (
    <div className="space-y-6">
      {/* Header premium + filtros */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Relatórios</h2>
          <p className="text-gray-500 text-sm mt-1">
            Performance do funil, qualidade do atendimento e sinais de conversão.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period */}
          <div className={pillBase() + " flex items-center gap-2"}>
            <CalendarDays className="w-4 h-4 text-gray-400" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
              className="bg-transparent outline-none text-gray-200"
            >
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key} className="bg-[#0b0f19]">
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Channel */}
          <div className={pillBase() + " flex items-center gap-2"}>
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as any)}
              className="bg-transparent outline-none text-gray-200"
            >
              <option value="all" className="bg-[#0b0f19]">
                Todos os canais
              </option>
              <option value="whatsapp" className="bg-[#0b0f19]">
                WhatsApp
              </option>
              <option value="instagram" className="bg-[#0b0f19]">
                Instagram
              </option>
            </select>
          </div>

          {/* Lead status */}
          <div className={pillBase() + " flex items-center gap-2"}>
            <select
              value={leadStatus}
              onChange={(e) => setLeadStatus(e.target.value as any)}
              className="bg-transparent outline-none text-gray-200"
            >
              <option value="all" className="bg-[#0b0f19]">
                Todos os status
              </option>
              <option value="new" className="bg-[#0b0f19]">
                Novos
              </option>
              <option value="active" className="bg-[#0b0f19]">
                Ativos
              </option>
              <option value="won" className="bg-[#0b0f19]">
                Ganhos
              </option>
              <option value="lost" className="bg-[#0b0f19]">
                Perdidos
              </option>
            </select>
          </div>

          {/* Insight IA */}
          <button onClick={handleInsightIA} className={btnPrimary()}>
            <Sparkles className="w-4 h-4 text-[#f57f17]" />
            Insight IA
          </button>

          {/* Export */}
          <button onClick={handleExportPdf} className={btnBase()}>
            <Download className="w-4 h-4 text-gray-300" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Exportable section */}
      <div ref={exportRef} className="space-y-6">
        {/* KPI Cards */}
        <div>
          <div className="mb-4">
            <p className="text-white font-semibold">KPIs detalhados</p>
            <p className="text-gray-500 text-sm">
              Métricas do período (no passo 3 vira gráficos).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <GlassCard
              title="Leads gerados"
              subtitle="Total no período"
              right={<DeltaPill value={deltaLeads} />}
            >
              <KPIValue loading={loading} error={error} value={totalLeads} />
              <KPIHint>Volume total de leads com atividade recente.</KPIHint>
            </GlassCard>

            <GlassCard
              title="Conversões"
              subtitle="Estimativa (pronto / total)"
              right={<DeltaPill value={deltaConv} />}
            >
              <KPIValue
                loading={loading}
                error={error}
                value={totalLeads > 0 ? `${conversionRate.toFixed(1)}%` : "—"}
              />
              <KPIHint>
                No PROD vira taxa real (won/total) quando o backend expor.
              </KPIHint>
            </GlassCard>

            <GlassCard
              title="Health Score médio"
              subtitle="Qualidade geral do funil"
              right={<DeltaPill value={deltaHealth} />}
            >
              <KPIValue loading={loading} error={error} value={avgHealth} />
              <KPIHint>Score médio 0–100 (quanto maior, melhor).</KPIHint>
            </GlassCard>

            <GlassCard
              title="Temperatura média"
              subtitle="Propensão de conversão"
              right={<DeltaPill value={deltaTemp} />}
            >
              <KPIValue loading={loading} error={error} value={avgTemp} />
              <KPIHint>Temperatura média dos atendimentos ativos.</KPIHint>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
            <GlassCard
              title="Eventos emocionais"
              subtitle="Cobertura do modelo"
              right={<DeltaPill value={deltaEvents} />}
            >
              <KPIValue loading={loading} error={error} value={totalEvents} />
              <KPIHint>Mais eventos = leitura emocional mais precisa.</KPIHint>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-gray-300" />
                  <p className="text-gray-300 text-sm">
                    Esse número indica quantos sinais emocionais o motor leu no período.
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard
              title="SLA de resposta"
              subtitle="Média e pico"
              right={<span className="text-xs text-gray-500">Em breve</span>}
            >
              <KPIValue loading={false} error={null} value={"—"} />
              <KPIHint>Vai medir tempo médio e p90 por canal.</KPIHint>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-300" />
                  <p className="text-gray-300 text-sm">
                    Assim que o backend expor timestamps, isso vira o KPI mais valioso.
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Next step section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <GlassCard
            title="Resumo executivo"
            subtitle="O que importa agora"
            right={
              <span className="text-xs text-gray-500">
                {demoMode ? "DEMO" : "Realtime"}
              </span>
            }
          >
            <div className="space-y-3">
              <ExecutiveLine
                title="Conversão estimada"
                value={totalLeads > 0 ? `${conversionRate.toFixed(1)}%` : "—"}
                tone={conversionRate >= 15 ? "good" : conversionRate >= 8 ? "mid" : "bad"}
              />
              <ExecutiveLine
                title="Health médio"
                value={avgHealth ? `${avgHealth}/100` : "—"}
                tone={avgHealth >= 75 ? "good" : avgHealth >= 55 ? "mid" : "bad"}
              />
              <ExecutiveLine
                title="Eventos emocionais"
                value={String(totalEvents)}
                tone={totalEvents >= 80 ? "good" : totalEvents >= 35 ? "mid" : "bad"}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-white font-semibold text-sm">Próximo passo</p>
              <p className="text-gray-500 text-sm mt-1">
                Execute o plano do dia no Funil para impactar os leads com maior chance.
              </p>

              <button
                onClick={onGoToFunnel}
                disabled={!onGoToFunnel}
                className={cn(
                  "mt-4 h-10 px-4 rounded-2xl border transition-all flex items-center gap-2 text-sm font-semibold",
                  onGoToFunnel
                    ? "border-[#f57f17]/35 bg-[#f57f17]/15 text-white hover:bg-[#f57f17]/20"
                    : "border-white/10 bg-white/5 text-gray-500 cursor-not-allowed"
                )}
              >
                <ArrowRight className="w-4 h-4 text-[#f57f17]" />
                Ir para Funil
              </button>
            </div>
          </GlassCard>

          <GlassCard
            title="Ações recomendadas"
            subtitle="O que fazer para melhorar"
            right={<TrendingUp className="w-4 h-4 text-[#f57f17]" />}
            className="xl:col-span-2"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ActionCard
                title="1) Ataque leads prontos"
                desc="Use CTA direto + agendamento. A janela é curta."
                pill={`${prontoGuess || 0} leads`}
              />
              <ActionCard
                title="2) Nutrir céticos com prova"
                desc="Cases curtos + depoimentos + ROI em 15s."
                pill="Prova social"
              />
              <ActionCard
                title="3) Reduzir risco"
                desc="Oferta com risco reduzido (teste / garantia / onboarding assistido)."
                pill="Remover fricção"
              />
              <ActionCard
                title="4) Subir Health médio"
                desc="Automatize follow-up e evite deixar lead sem toque."
                pill="Aumentar health"
              />
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Estado */}
      {!loading && error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">
          Erro ao carregar métricas:{" "}
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* PROD vazio */}
      {emptyProd && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl px-6 py-5">
          <p className="text-white font-semibold">Sem dados ainda</p>
          <p className="text-gray-500 text-sm mt-1">
            No PROD essa tela vai preencher assim que o backend começar a registrar métricas
            (leads, eventos emocionais e score). Se quiser, eu já deixo essa UI com um
            estado “Primeiro Setup”.
          </p>
        </div>
      )}
    </div>
  );
}

function KPIValue({
  loading,
  error,
  value,
}: {
  loading: boolean;
  error: string | null;
  value: any;
}) {
  if (loading) {
    return <div className="h-10 w-28 rounded-xl bg-white/5 animate-pulse" />;
  }
  if (error) {
    return <p className="text-2xl font-bold text-white">—</p>;
  }
  return <p className="text-4xl font-bold text-white">{value}</p>;
}

function KPIHint({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-500 text-sm mt-2">{children}</p>;
}

function DeltaPill({ value }: { value: number }) {
  const v = Number(value);
  const neutral = !Number.isFinite(v) || v === 0;

  const cls = neutral
    ? "border-white/10 bg-white/[0.03] text-gray-400"
    : v > 0
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
    : "border-red-400/20 bg-red-400/10 text-red-200";

  return (
    <span
      className={cn(
        "text-xs font-semibold px-3 py-1 rounded-full border backdrop-blur-xl",
        cls
      )}
      title="Comparação com período anterior (mock enquanto não há histórico)"
    >
      {neutral ? "—" : formatPct(v)}
    </span>
  );
}

function ExecutiveLine({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "good" | "mid" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-200"
      : tone === "mid"
      ? "text-yellow-200"
      : "text-red-200";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 flex items-center justify-between">
      <p className="text-gray-400 text-sm">{title}</p>
      <p className={cn("text-sm font-semibold", toneCls)}>{value}</p>
    </div>
  );
}

function ActionCard({
  title,
  desc,
  pill,
}: {
  title: string;
  desc: string;
  pill: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 hover:bg-black/35 transition-all p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-semibold">{title}</p>
          <p className="text-gray-500 text-sm mt-1">{desc}</p>
        </div>

        <span className="text-[11px] px-3 py-1 rounded-full border border-[#f57f17]/20 bg-[#f57f17]/10 text-[#f57f17] font-semibold">
          {pill}
        </span>
      </div>
    </div>
  );
}
