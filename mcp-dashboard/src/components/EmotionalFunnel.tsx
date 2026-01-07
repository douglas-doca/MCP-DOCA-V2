import React, { useMemo, useState } from "react";
import { Target, TrendingUp, Info } from "lucide-react";
import GlassCard from "./GlassCard";
import { useEmotionalFunnel } from "../hooks/useEmotionData";

type StageItem = {
  stage: string;
  count: number;
  percentage: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeStageKey(raw: string) {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "_");
}

/**
 * Meta: define um estilo consistente por estágio
 * Você pode ajustar labels aqui com o “tom premium” que quiser.
 */
const STAGE_META: Record<
  string,
  {
    label: string;
    gradient: [string, string];
    stroke: string;
    glow: string;
  }
> = {
  cetico: {
    label: "CÉTICO",
    gradient: ["#6d28d9", "#a855f7"],
    stroke: "#a855f7",
    glow: "rgba(168, 85, 247, 0.35)",
  },
  frustrado: {
    label: "FRUSTRADO",
    gradient: ["#7c3aed", "#8b5cf6"],
    stroke: "#8b5cf6",
    glow: "rgba(139, 92, 246, 0.35)",
  },
  curioso: {
    label: "CURIOSO",
    gradient: ["#1d4ed8", "#3b82f6"],
    stroke: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.35)",
  },
  sensivel_preco: {
    label: "SENSÍVEL A PREÇO",
    gradient: ["#0e7490", "#06b6d4"],
    stroke: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.35)",
  },
  empolgado: {
    label: "EMPOLGADO",
    gradient: ["#047857", "#10b981"],
    stroke: "#10b981",
    glow: "rgba(16, 185, 129, 0.35)",
  },
  pronto: {
    label: "PRONTO",
    gradient: ["#065f46", "#34d399"],
    stroke: "#34d399",
    glow: "rgba(52, 211, 153, 0.35)",
  },

  // fallback para qualquer stage do banco (ex: "new")
  default: {
    label: "NOVO",
    gradient: ["#334155", "#64748b"],
    stroke: "#94a3b8",
    glow: "rgba(148, 163, 184, 0.25)",
  },
};

export default function EmotionalFunnel() {
  const { data, loading, error } = useEmotionalFunnel();
  const [activeStage, setActiveStage] = useState<string | null>(null);

  const stages: StageItem[] = useMemo(() => {
    const raw = data?.funnel || [];

    // Ordenação “funil” (topo -> fundo)
    const order = [
      "cetico",
      "frustrado",
      "curioso",
      "sensivel_preco",
      "empolgado",
      "pronto",
    ];

    const normalized = raw.map((s) => {
      const key = normalizeStageKey(s.stage);
      const meta = STAGE_META[key] || STAGE_META.default;
      return {
        ...s,
        stage: s.stage,
        _key: key,
        _label: meta.label,
      } as any;
    });

    const hasKnown = normalized.some((x) => order.includes(x._key));
    if (!hasKnown) {
      // Se vier tudo "new", etc. mantém ordem por count
      return normalized
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .map(({ _key, _label, ...rest }) => rest);
    }

    return normalized
      .sort((a, b) => order.indexOf(a._key) - order.indexOf(b._key))
      .map(({ _key, _label, ...rest }) => rest);
  }, [data]);

  const total = useMemo(
    () => stages.reduce((acc, s) => acc + (s.count || 0), 0),
    [stages]
  );

  const readyCount = useMemo(() => {
    // tenta achar estágio "pronto"
    const found = stages.find((s) => normalizeStageKey(s.stage) === "pronto");
    if (found) return found.count || 0;
    // fallback: último
    return stages[stages.length - 1]?.count || 0;
  }, [stages]);

  // Conversão entre etapas (setinhas)
  const transitions = useMemo(() => {
    if (!stages.length) return [];
    const t: number[] = [];
    for (let i = 0; i < stages.length - 1; i++) {
      const a = stages[i]?.count || 0;
      const b = stages[i + 1]?.count || 0;
      t.push(a > 0 ? Math.round((b / a) * 100) : 0);
    }
    return t;
  }, [stages]);

  // --- FUNIL SVG (ALINHADO E RESPONSIVO)
  const W = 420;
  const H = 560;
  const centerX = W / 2;

  const topWidth = 300;
  const bottomWidth = 128;
  const stageHeight = 66;
  const gap = 34;

  function stageWidthAt(i: number) {
    if (stages.length <= 1) return topWidth;
    const t = i / (stages.length - 1);
    return topWidth - (topWidth - bottomWidth) * t;
  }

  function trapezoidPoints(i: number) {
    const yTop = 46 + i * (stageHeight + gap);
    const wTop = stageWidthAt(i);
    const wBottom =
      i < stages.length - 1 ? stageWidthAt(i + 1) : wTop * 0.94;

    const x1 = centerX - wTop / 2;
    const x2 = centerX + wTop / 2;
    const x3 = centerX + wBottom / 2;
    const x4 = centerX - wBottom / 2;
    const yBottom = yTop + stageHeight;

    return `${x1},${yTop} ${x2},${yTop} ${x3},${yBottom} ${x4},${yBottom}`;
  }

  function getMeta(stage: string) {
    const key = normalizeStageKey(stage);
    return STAGE_META[key] || STAGE_META.default;
  }

  return (
    <GlassCard
      title="Funil Emocional"
      subtitle="Distribuição de leads por estágio emocional"
      right={
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <TrendingUp className="w-4 h-4 text-[#f57f17]" />
          <span>Realtime</span>
        </div>
      }
    >
      {loading ? (
        <div className="py-10 text-gray-400">Carregando funil...</div>
      ) : error ? (
        <div className="py-10 text-red-400">Erro: {error}</div>
      ) : !stages.length ? (
        <div className="py-10 text-gray-400">Sem dados de funil.</div>
      ) : (
        <div className="space-y-4">
          {/* Header metrics */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-[#f57f17]/15 border border-[#f57f17]/25 flex items-center justify-center">
                <Target className="w-5 h-5 text-[#f57f17]" />
              </div>
              <div className="leading-tight">
                <p className="text-xs text-gray-500">Total no funil</p>
                <p className="text-2xl font-bold text-white">{total}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <Info className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-400">
                Percentuais nas setas = taxa de avanço
              </p>
            </div>
          </div>

          {/* Canvas */}
          <div className="relative rounded-[22px] border border-white/10 bg-black/40 overflow-hidden">
            {/* Ambient glows */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
              <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,127,23,0.08),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(59,130,246,0.10),transparent_55%)]" />
            </div>

            <div className="relative p-5">
              {/* O segredo do “fora de esquadro” era aqui:
                  - width 100%
                  - height fixo
                  - preserveAspectRatio central
              */}
              <div className="w-full flex items-center justify-center">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="w-full max-w-[520px] h-[560px]"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <filter
                      id="softShadow"
                      x="-30%"
                      y="-30%"
                      width="160%"
                      height="160%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="6"
                        stdDeviation="10"
                        floodColor="rgba(0,0,0,0.55)"
                      />
                    </filter>

                    <linearGradient
                      id="innerHighlight"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="rgba(255,255,255,0.14)"
                      />
                      <stop
                        offset="55%"
                        stopColor="rgba(255,255,255,0.04)"
                      />
                      <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
                    </linearGradient>
                  </defs>

                  {stages.map((s, i) => {
                    const meta = getMeta(s.stage);
                    const isActive = !activeStage || activeStage === s.stage;

                    const yTop = 46 + i * (stageHeight + gap);
                    const yCenter = yTop + stageHeight / 2;

                    return (
                      <g key={`${s.stage}-${i}`}>
                        <defs>
                          <linearGradient
                            id={`grad-${i}`}
                            x1="0"
                            x2="1"
                            y1="0"
                            y2="0"
                          >
                            <stop offset="0%" stopColor={meta.gradient[0]} />
                            <stop offset="100%" stopColor={meta.gradient[1]} />
                          </linearGradient>

                          <filter
                            id={`glow-${i}`}
                            x="-45%"
                            y="-55%"
                            width="190%"
                            height="210%"
                          >
                            <feDropShadow
                              dx="0"
                              dy="0"
                              stdDeviation="10"
                              floodColor={meta.glow}
                            />
                          </filter>
                        </defs>

                        <g
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => setActiveStage(s.stage)}
                          onMouseLeave={() => setActiveStage(null)}
                        >
                          <polygon
                            points={trapezoidPoints(i)}
                            fill={`url(#grad-${i})`}
                            opacity={isActive ? 0.92 : 0.42}
                            filter="url(#softShadow)"
                            stroke={meta.stroke}
                            strokeOpacity={isActive ? 0.6 : 0.22}
                            strokeWidth={2}
                          />

                          <polygon
                            points={trapezoidPoints(i)}
                            fill="url(#innerHighlight)"
                            opacity={isActive ? 0.75 : 0.35}
                          />

                          <polygon
                            points={trapezoidPoints(i)}
                            fill="transparent"
                            stroke={meta.stroke}
                            strokeOpacity={isActive ? 0.28 : 0}
                            strokeWidth={3}
                            filter={`url(#glow-${i})`}
                          />

                          {/* Label */}
                          <text
                            x={centerX}
                            y={yCenter - 10}
                            fill="rgba(255,255,255,0.98)"
                            fontSize={14}
                            fontWeight={900}
                            textAnchor="middle"
                            letterSpacing={0.6}
                          >
                            {meta.label}
                          </text>

                          {/* Count */}
                          <text
                            x={centerX}
                            y={yCenter + 12}
                            fill="rgba(255,255,255,0.90)"
                            fontSize={22}
                            fontWeight={900}
                            textAnchor="middle"
                          >
                            {s.count}
                          </text>

                          {/* Percentage */}
                          <text
                            x={centerX}
                            y={yCenter + 30}
                            fill="rgba(255,255,255,0.62)"
                            fontSize={11}
                            fontWeight={700}
                            textAnchor="middle"
                          >
                            {s.percentage}%
                          </text>
                        </g>

                        {/* Arrow + conversion */}
                        {i < stages.length - 1 && (
                          <g>
                            <line
                              x1={centerX}
                              x2={centerX}
                              y1={yTop + stageHeight}
                              y2={yTop + stageHeight + gap - 10}
                              stroke="rgba(255,255,255,0.20)"
                              strokeWidth={2}
                            />

                            <polygon
                              points={`${centerX},${
                                yTop + stageHeight + gap - 7
                              } ${centerX - 7},${
                                yTop + stageHeight + gap - 15
                              } ${centerX + 7},${
                                yTop + stageHeight + gap - 15
                              }`}
                              fill="rgba(255,255,255,0.22)"
                            />

                            {/* Badge */}
                            <g>
                              <rect
                                x={centerX + 18}
                                y={yTop + stageHeight + gap / 2 - 12}
                                width={60}
                                height={24}
                                rx={12}
                                fill="rgba(59, 130, 246, 0.14)"
                                stroke="rgba(59, 130, 246, 0.35)"
                                strokeWidth={1.2}
                              />
                              <text
                                x={centerX + 48}
                                y={yTop + stageHeight + gap / 2 + 4}
                                fill="rgba(147, 197, 253, 0.95)"
                                fontSize={12}
                                fontWeight={900}
                                textAnchor="middle"
                              >
                                {clamp(transitions[i], 0, 999)}%
                              </text>
                            </g>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Premium CTA */}
              <div className="mt-4 flex items-center justify-center">
                <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-5 py-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/20 border border-emerald-300/20 flex items-center justify-center">
                    <span className="text-emerald-200 font-black text-sm">
                      {readyCount}
                    </span>
                  </div>

                  <div className="leading-tight">
                    <p className="text-white font-extrabold text-sm tracking-wide">
                      LEADS PRONTOS PARA CONVERSÃO
                    </p>
                    <p className="text-[12px] text-emerald-200/80">
                      Prioridade máxima para seu time
                    </p>
                  </div>

                  <div className="ml-2 hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-[11px] font-semibold text-gray-200 tracking-wide">
                      IA: otimização contínua
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom insight cards (sem emoji) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <p className="text-xs text-gray-500">Leitura</p>
              <p className="text-sm text-white font-semibold mt-1">
                Setas indicam taxa de avanço entre etapas
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <p className="text-xs text-gray-500">Interação</p>
              <p className="text-sm text-white font-semibold mt-1">
                Passe o mouse para realçar um estágio
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <p className="text-xs text-gray-500">Ação</p>
              <p className="text-sm text-white font-semibold mt-1">
                Foque em “Pronto” para encurtar ciclo e fechar rápido
              </p>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
