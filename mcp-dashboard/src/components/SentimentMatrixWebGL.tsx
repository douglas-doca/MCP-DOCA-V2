import React, { useMemo, useState } from "react";
import { Sparkles, Target, Info, Filter } from "lucide-react";
import GlassCard from "./GlassCard";
import { useSentimentMatrix } from "../hooks/useEmotionData";

type MatrixPoint = {
  id: string;
  name?: string;
  phone?: string;
  emotion: string;
  stage: string;
  sentiment: number; // -1..1
  intention: number; // 0..1
  health_score?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatName(p: MatrixPoint) {
  if (p.name) return p.name;
  if (p.phone) return p.phone.replace(/^55/, "+55 ");
  return p.id;
}

function emotionColor(emotion: string) {
  const e = (emotion || "").toLowerCase();
  if (e.includes("ready") || e.includes("pronto")) return "rgba(52,211,153,0.9)";
  if (e.includes("excited") || e.includes("empolgado"))
    return "rgba(16,185,129,0.9)";
  if (e.includes("curious") || e.includes("curioso"))
    return "rgba(59,130,246,0.9)";
  if (e.includes("price") || e.includes("preco"))
    return "rgba(6,182,212,0.9)";
  if (e.includes("frustrated") || e.includes("frustrado"))
    return "rgba(139,92,246,0.9)";
  if (e.includes("skeptical") || e.includes("cetico"))
    return "rgba(168,85,247,0.9)";
  return "rgba(148,163,184,0.85)";
}

function stageTag(stage: string) {
  const s = (stage || "").toLowerCase();
  if (s === "pronto" || s === "ready") return "PRONTO";
  if (s === "empolgado" || s === "excited") return "EMPOLGADO";
  if (s === "curioso" || s === "curious") return "CURIOSO";
  if (s.includes("preco") || s.includes("price")) return "PREÇO";
  if (s.includes("frustr")) return "FRUSTRADO";
  if (s.includes("cetic") || s.includes("skept")) return "CÉTICO";
  if (s === "new") return "NEW";
  return stage.toUpperCase();
}

export default function SentimentMatrixWebGL() {
  const { data, loading, error } = useSentimentMatrix();
  const [hovered, setHovered] = useState<MatrixPoint | null>(null);
  const [filterStage, setFilterStage] = useState<string>("all");

  const points = useMemo<MatrixPoint[]>(() => data?.data || [], [data]);

  const stages = useMemo(() => {
    const unique = Array.from(new Set(points.map((p) => p.stage).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [points]);

  const filteredPoints = useMemo(() => {
    if (filterStage === "all") return points;
    return points.filter((p) => p.stage === filterStage);
  }, [points, filterStage]);

  const total = filteredPoints.length;

  const avgHealth = useMemo(() => {
    if (!filteredPoints.length) return 0;
    const s = filteredPoints.reduce((acc, p) => acc + (p.health_score ?? 50), 0);
    return Math.round(s / filteredPoints.length);
  }, [filteredPoints]);

  // Canvas layout
  const PAD = 30; // padding for plot
  const W = 720; // virtual width
  const H = 420; // virtual height

  function toX(sentiment: number) {
    // sentiment -1..1 -> PAD..W-PAD
    const t = (clamp(sentiment, -1, 1) + 1) / 2;
    return PAD + t * (W - PAD * 2);
  }

  function toY(intention: number) {
    // intention 0..1 -> (H-PAD)..PAD (invert)
    const t = clamp(intention, 0, 1);
    return H - PAD - t * (H - PAD * 2);
  }

  function radiusFor(p: MatrixPoint) {
    const hs = clamp(p.health_score ?? 50, 0, 100);
    // 3..9
    return 3 + (hs / 100) * 6;
  }

  return (
    <GlassCard
      title="Matriz de Sentimento"
      subtitle="Sentimento (−1..1) × Intenção (0..1) por lead"
      right={
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Sparkles className="w-4 h-4 text-[#f57f17]" />
          <span>Realtime</span>
        </div>
      }
    >
      {loading ? (
        <div className="py-10 text-gray-400">Carregando matriz...</div>
      ) : error ? (
        <div className="py-10 text-red-400">Erro: {error}</div>
      ) : (
        <div className="space-y-4">
          {/* Top controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-[#f57f17]/15 border border-[#f57f17]/25 flex items-center justify-center">
                <Target className="w-5 h-5 text-[#f57f17]" />
              </div>

              <div className="leading-tight">
                <p className="text-xs text-gray-500">Leads no gráfico</p>
                <p className="text-xl font-bold text-white">
                  {total}{" "}
                  <span className="text-xs font-semibold text-gray-400 ml-2">
                    Health médio: {avgHealth}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <Info className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-400">
                  Pontos maiores = health score maior
                </p>
              </div>

              <div className="relative">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filterStage}
                    onChange={(e) => setFilterStage(e.target.value)}
                    className="bg-transparent text-sm text-gray-200 outline-none"
                  >
                    <option value="all">Todos os estágios</option>
                    {stages.map((s) => (
                      <option key={s} value={s}>
                        {stageTag(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="relative rounded-[22px] border border-white/10 bg-black/40 overflow-hidden">
            {/* Ambient */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-28 left-[-120px] h-[340px] w-[340px] rounded-full bg-blue-500/12 blur-3xl" />
              <div className="absolute -bottom-28 right-[-120px] h-[340px] w-[340px] rounded-full bg-emerald-500/12 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,127,23,0.06),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(139,92,246,0.10),transparent_55%)]" />
            </div>

            <div className="relative p-4">
              <div className="w-full overflow-hidden">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="w-full h-[420px]"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Grid */}
                  <g opacity={0.55}>
                    {/* vertical lines */}
                    {Array.from({ length: 9 }).map((_, i) => {
                      const x = PAD + (i / 8) * (W - PAD * 2);
                      return (
                        <line
                          key={`vx-${i}`}
                          x1={x}
                          x2={x}
                          y1={PAD}
                          y2={H - PAD}
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth={1}
                        />
                      );
                    })}
                    {/* horizontal lines */}
                    {Array.from({ length: 7 }).map((_, i) => {
                      const y = PAD + (i / 6) * (H - PAD * 2);
                      return (
                        <line
                          key={`hy-${i}`}
                          x1={PAD}
                          x2={W - PAD}
                          y1={y}
                          y2={y}
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth={1}
                        />
                      );
                    })}
                  </g>

                  {/* Axes */}
                  <line
                    x1={PAD}
                    x2={W - PAD}
                    y1={H - PAD}
                    y2={H - PAD}
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={1.2}
                  />
                  <line
                    x1={PAD}
                    x2={PAD}
                    y1={PAD}
                    y2={H - PAD}
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={1.2}
                  />

                  {/* Labels */}
                  <text
                    x={PAD}
                    y={PAD - 10}
                    fill="rgba(255,255,255,0.55)"
                    fontSize={12}
                    fontWeight={700}
                  >
                    Intenção ↑
                  </text>
                  <text
                    x={W - PAD}
                    y={H - 8}
                    fill="rgba(255,255,255,0.55)"
                    fontSize={12}
                    fontWeight={700}
                    textAnchor="end"
                  >
                    Sentimento →
                  </text>

                  {/* Quadrant hints */}
                  <text
                    x={W - PAD - 6}
                    y={PAD + 12}
                    fill="rgba(52,211,153,0.55)"
                    fontSize={12}
                    fontWeight={800}
                    textAnchor="end"
                  >
                    Alta intenção + positivo
                  </text>
                  <text
                    x={PAD + 6}
                    y={PAD + 12}
                    fill="rgba(59,130,246,0.45)"
                    fontSize={12}
                    fontWeight={800}
                  >
                    Alta intenção + negativo
                  </text>

                  {/* Points */}
                  <defs>
                    <filter id="dotGlow" x="-80%" y="-80%" width="260%" height="260%">
                      <feDropShadow
                        dx="0"
                        dy="0"
                        stdDeviation="7"
                        floodColor="rgba(245,127,23,0.22)"
                      />
                    </filter>
                  </defs>

                  {filteredPoints.map((p) => {
                    const x = toX(p.sentiment);
                    const y = toY(p.intention);
                    const r = radiusFor(p);
                    const c = emotionColor(p.emotion);
                    const isHovered = hovered?.id === p.id;

                    return (
                      <g
                        key={p.id}
                        onMouseEnter={() => setHovered(p)}
                        onMouseLeave={() => setHovered(null)}
                        style={{ cursor: "pointer" }}
                      >
                        {/* outer soft ring */}
                        <circle
                          cx={x}
                          cy={y}
                          r={r + 6}
                          fill={c}
                          opacity={isHovered ? 0.12 : 0.06}
                        />

                        {/* core */}
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? r + 1.5 : r}
                          fill={c}
                          opacity={isHovered ? 0.95 : 0.78}
                          stroke="rgba(255,255,255,0.35)"
                          strokeWidth={isHovered ? 1.4 : 0.8}
                          filter={isHovered ? "url(#dotGlow)" : undefined}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Tooltip */}
              {hovered && (
                <div className="absolute top-4 right-4 w-[280px] rounded-2xl border border-white/10 bg-black/75 backdrop-blur-xl shadow-xl p-4">
                  <p className="text-white font-semibold text-sm">
                    {formatName(hovered)}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>Emotion</span>
                    <span className="text-gray-200 font-semibold">
                      {hovered.emotion}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>Stage</span>
                    <span className="text-gray-200 font-semibold">
                      {stageTag(hovered.stage)}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[11px] text-gray-500">Sentimento</p>
                      <p className="text-white font-bold">
                        {hovered.sentiment.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[11px] text-gray-500">Intenção</p>
                      <p className="text-white font-bold">
                        {hovered.intention.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[11px] text-gray-500">Health Score</p>
                    <p className="text-white font-bold">
                      {Math.round(hovered.health_score ?? 50)}
                    </p>
                  </div>

                  <div className="mt-3 text-[11px] text-gray-500 flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: emotionColor(hovered.emotion) }}
                    />
                    <span>Quanto maior o ponto, maior a qualidade</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom “premium hints” */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <p className="text-xs text-gray-500">Leitura</p>
              <p className="text-sm text-white font-semibold mt-1">
                Intenção alta + sentimento positivo = melhor alvo
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <p className="text-xs text-gray-500">Qualidade</p>
              <p className="text-sm text-white font-semibold mt-1">
                Health score controla tamanho e destaque
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <p className="text-xs text-gray-500">Ação</p>
              <p className="text-sm text-white font-semibold mt-1">
                Filtre por estágio e priorize follow-ups
              </p>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
