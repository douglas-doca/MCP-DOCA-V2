// src/components/ReportPdfView.tsx
import React, { useMemo } from "react";
import { Sparkles, TrendingUp, ShieldCheck, Flame, Activity } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeNum(n: any, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function formatBRL(value: number) {
  try {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  } catch {
    return `R$ ${value}`;
  }
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

type Props = {
  periodLabel: string;
  channelLabel: string;
  statusLabel: string;

  // dados do /metrics
  data: any | null;

  // se demo mode, a gente coloca uma “variação bonita”
  demoMode?: boolean;
};

export default function ReportPdfView({
  periodLabel,
  channelLabel,
  statusLabel,
  data,
  demoMode,
}: Props) {
  const totalLeads = safeNum(data?.total_leads, 0);
  const avgHealth = Math.round(safeNum(data?.avg_health_score, 0));
  const avgTemp = Math.round(safeNum(data?.avg_temperature, 0));
  const totalEvents = safeNum(data?.total_emotion_events, 0);

  const stageDist = data?.stage_distribution || {};
  const prontoGuess = safeNum((stageDist as any)?.pronto, 0);
  const conversionRate = totalLeads > 0 ? (prontoGuess / totalLeads) * 100 : 0;

  // Receita prevista (MVP bonito)
  const revenueGuess = useMemo(() => {
    // heurística: leads * conv% * ticket médio (demo: 1297, prod: 997)
    const ticket = demoMode ? 1297 : 997;
    const conv = Math.max(0.05, conversionRate / 100);
    const est = totalLeads * conv * ticket;
    return Math.round(est);
  }, [totalLeads, conversionRate, demoMode]);

  const insight =
    avgHealth >= 70
      ? "O funil está saudável. Excelente momento para acelerar fechamento nos leads prontos."
      : avgHealth >= 45
      ? "O funil está ok, mas exige follow-up consistente. Priorize leads em risco."
      : "O funil está fragilizado. Ajuste a abordagem e aplique prova social + CTA direto.";

  const actions = [
    {
      title: "Atacar leads prontos",
      desc: "Enviar follow-up com CTA de call + urgência controlada.",
    },
    {
      title: "Destravar objeção de preço",
      desc: "Oferta em 2 opções + ROI imediato + case curto.",
    },
    {
      title: "Salvar leads esfriando",
      desc: "Reengajar com mensagem empática + prova social específica.",
    },
  ];

  return (
    <div
      className="w-[1120px] h-[700px] rounded-[28px] overflow-hidden border border-white/10 bg-black text-white"
      style={{
        position: "relative",
      }}
    >
      {/* background premium */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 left-[-160px] h-[520px] w-[520px] rounded-full bg-[#f57f17]/18 blur-3xl" />
        <div className="absolute top-24 right-[-220px] h-[560px] w-[560px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-260px] left-[16%] h-[620px] w-[620px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/60" />
      </div>

      <div className="relative p-10 h-full">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[#f57f17]" />
              </div>
              <div>
                <p className="text-[13px] text-gray-400">
                  DOCA AI • Relatório Executivo
                </p>
                <h1 className="text-3xl font-bold tracking-tight">
                  Performance do Funil
                </h1>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
              <Pill label={`Período: ${periodLabel}`} />
              <Pill label={`Canal: ${channelLabel}`} />
              <Pill label={`Status: ${statusLabel}`} />
              {demoMode && <Pill label="DEMO" tone="orange" />}
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-500">Gerado em</p>
            <p className="text-sm text-gray-200 font-semibold">
              {new Date().toLocaleString("pt-BR")}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-[#f57f17]/25 bg-[#f57f17]/10">
              <TrendingUp className="w-4 h-4 text-[#f57f17]" />
              <span className="text-xs text-gray-200 font-semibold">
                Insight IA incluído
              </span>
            </div>
          </div>
        </div>

        {/* KPIs row */}
        <div className="mt-8 grid grid-cols-4 gap-4">
          <KPI
            title="Leads gerados"
            value={totalLeads}
            icon={<Activity className="w-5 h-5 text-[#f57f17]" />}
            hint="Atividade recente"
          />
          <KPI
            title="Conversão (estim.)"
            value={totalLeads > 0 ? formatPct(conversionRate) : "—"}
            icon={<TrendingUp className="w-5 h-5 text-[#f57f17]" />}
            hint="Pronto / Total"
          />
          <KPI
            title="Health Score médio"
            value={avgHealth}
            icon={<ShieldCheck className="w-5 h-5 text-[#f57f17]" />}
            hint="0–100"
          />
          <KPI
            title="Temperatura média"
            value={avgTemp}
            icon={<Flame className="w-5 h-5 text-[#f57f17]" />}
            hint="Propensão"
          />
        </div>

        {/* Main grid */}
        <div className="mt-6 grid grid-cols-[1.4fr_1fr] gap-5">
          {/* Insight + Diagnóstico */}
          <div className="rounded-[26px] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
            <p className="text-sm font-semibold text-white">Resumo do período</p>
            <p className="text-sm text-gray-400 mt-1">
              Leitura rápida do estado do funil + prioridade.
            </p>

            <div className="mt-4 rounded-2xl border border-[#f57f17]/20 bg-[#f57f17]/10 p-4">
              <p className="text-xs text-[#f57f17] font-semibold">Insight IA</p>
              <p className="text-gray-100 font-semibold mt-1 leading-relaxed">
                {insight}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <MiniCard
                title="Eventos emocionais"
                value={totalEvents}
                desc="Cobertura do modelo"
              />
              <MiniCard
                title="Estágio dominante"
                value={topKey(stageDist) || "—"}
                desc="Maior volume"
              />
              <MiniCard
                title="Previsão (MVP)"
                value={formatBRL(revenueGuess)}
                desc="Receita estimada"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-gray-500">Nota</p>
              <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                Este relatório é um snapshot do funil baseado em sinais de intenção,
                urgência e health. Quanto mais eventos, mais precisa é a leitura.
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="rounded-[26px] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
            <p className="text-sm font-semibold text-white">Plano recomendado</p>
            <p className="text-sm text-gray-400 mt-1">
              3 ações para aumentar conversão imediatamente.
            </p>

            <div className="mt-4 space-y-3">
              {actions.map((a, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-semibold">
                        {idx + 1}) {a.title}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">{a.desc}</p>
                    </div>
                    <span className="text-[11px] font-semibold px-3 py-1 rounded-full border border-[#f57f17]/25 bg-[#f57f17]/10 text-[#f57f17]">
                      Prioridade
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-4">
              <p className="text-xs text-emerald-200 font-semibold">
                Próximo passo
              </p>
              <p className="text-sm text-gray-100 font-semibold mt-1">
                Execute o plano do dia no War Room para destacar no mapa os leads
                impactados e disparar follow-ups.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-10 right-10 flex items-center justify-between text-xs text-gray-500">
          <span>© {new Date().getFullYear()} DOCA AI • Relatório Executivo</span>
          <span>docaperformance.com.br</span>
        </div>
      </div>
    </div>
  );
}

function Pill({ label, tone }: { label: string; tone?: "orange" }) {
  return (
    <span
      className={cn(
        "px-3 py-1 rounded-full border text-[11px] font-semibold",
        tone === "orange"
          ? "border-[#f57f17]/25 bg-[#f57f17]/10 text-[#f57f17]"
          : "border-white/10 bg-white/[0.03] text-gray-300"
      )}
    >
      {label}
    </span>
  );
}

function KPI(props: {
  title: string;
  value: any;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{props.title}</p>
          {props.hint && <p className="text-xs text-gray-500 mt-1">{props.hint}</p>}
        </div>
        <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
          {props.icon}
        </div>
      </div>

      <div className="mt-5 text-4xl font-bold text-white">
        {props.value}
      </div>
    </div>
  );
}

function MiniCard(props: { title: string; value: any; desc?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs text-gray-500">{props.title}</p>
      <p className="text-xl font-bold text-white mt-1">{props.value}</p>
      {props.desc && <p className="text-xs text-gray-500 mt-1">{props.desc}</p>}
    </div>
  );
}

function topKey(obj: Record<string, any>) {
  try {
    const entries = Object.entries(obj || {});
    if (!entries.length) return "";
    entries.sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
    return entries[0]?.[0] || "";
  } catch {
    return "";
  }
}
