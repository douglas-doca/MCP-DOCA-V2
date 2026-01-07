import React, { useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  Flame,
  ShieldCheck,
  Phone,
  ArrowRight,
  X,
  Sparkles,
} from "lucide-react";

type Lead = {
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

type Props = {
  leads: Lead[];
  height?: number;

  highlightLeadIds?: string[];
  onClearHighlights?: () => void;

  onOpenConversation?: (lead: Lead) => void;
  onSendFollowUp?: (lead: Lead) => void;
  onMarkAsWon?: (lead: Lead) => void;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtPhone(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 10) return phone;
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = d.slice(0, 2);
  const p1 = d.slice(2, 7);
  const p2 = d.slice(7, 11);
  return `+55 (${ddd}) ${p1}-${p2}`;
}

function initials(name: string | null | undefined, phone: string) {
  const base = (name || "").trim();
  if (!base) return phone.replace(/\D/g, "").slice(-2).padStart(2, "0");
  const parts = base.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgo(iso?: string) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return `${h}h`;
}

function urgencyToRisk(u?: string) {
  const x = (u || "normal").toLowerCase();
  if (x === "critical") return 0.95;
  if (x === "high") return 0.75;
  if (x === "low") return 0.25;
  return 0.45;
}

function computeRisk(lead: Lead) {
  const urgency = urgencyToRisk(lead.urgency_level);
  const health = clamp(lead.health_score ?? 50, 0, 100);
  const healthRisk = clamp((65 - health) / 65, 0, 1);

  const t = lead.last_touch_at
    ? new Date(lead.last_touch_at).getTime()
    : Date.now();
  const idleMin = clamp(Math.round(Math.abs(Date.now() - t) / 60000), 0, 240);
  const idleRisk = clamp(idleMin / 60, 0, 1);

  return clamp(0.55 * urgency + 0.25 * idleRisk + 0.2 * healthRisk, 0, 1);
}

function computeIntent(lead: Lead) {
  if (typeof lead.conversion_probability === "number") {
    return clamp(lead.conversion_probability, 0, 1);
  }
  const stage = (lead.stage || "").toLowerCase();
  if (stage === "pronto") return 0.9;
  if (stage === "empolgado") return 0.75;
  if (stage === "sensível_preço") return 0.55;
  if (stage === "cético") return 0.35;
  return 0.45;
}

function quadrantLabel(intent: number, risk: number) {
  const right = intent >= 0.55;
  const top = risk >= 0.55;

  if (right && !top)
    return { title: "FECHAR AGORA", hint: "Alta intenção • Baixo risco" };
  if (right && top)
    return { title: "SALVAR (URGENTE)", hint: "Alta intenção • Alto risco" };
  if (!right && top)
    return { title: "NUTRIR COM PROVA", hint: "Baixa intenção • Alto risco" };
  return { title: "AUTOMATIZAR", hint: "Baixa intenção • Baixo risco" };
}

function dotStyle(intent: number, risk: number) {
  const heat = clamp(intent * 0.6 + risk * 0.4, 0, 1);

  if (heat > 0.75)
    return "bg-[#f57f17] shadow-[0_0_0_12px_rgba(245,127,23,0.16)]";
  if (heat > 0.55)
    return "bg-emerald-400 shadow-[0_0_0_12px_rgba(52,211,153,0.16)]";
  if (heat > 0.35)
    return "bg-sky-400 shadow-[0_0_0_12px_rgba(56,189,248,0.16)]";
  return "bg-white/60 shadow-[0_0_0_12px_rgba(255,255,255,0.12)]";
}

// ✅ calcula posição do card em viewport (fixed), evitando bordas
function computeFixedPosition(args: {
  anchorX: number; // clientX
  anchorY: number; // clientY
  vw: number;
  vh: number;
  cardW: number;
  cardH: number;
  pad: number;
}) {
  const { anchorX, anchorY, vw, vh, cardW, cardH, pad } = args;

  const candidates = [
    { x: anchorX + 16, y: anchorY - cardH - 16 }, // acima direita
    { x: anchorX - cardW - 16, y: anchorY - cardH - 16 }, // acima esquerda
    { x: anchorX + 16, y: anchorY + 16 }, // abaixo direita
    { x: anchorX - cardW - 16, y: anchorY + 16 }, // abaixo esquerda
    { x: anchorX + 16, y: anchorY - cardH / 2 }, // direita
    { x: anchorX - cardW - 16, y: anchorY - cardH / 2 }, // esquerda
  ];

  for (const c of candidates) {
    const fitsX = c.x >= pad && c.x + cardW <= vw - pad;
    const fitsY = c.y >= pad && c.y + cardH <= vh - pad;
    if (fitsX && fitsY) return c;
  }

  return {
    x: clamp(anchorX - cardW / 2, pad, vw - cardW - pad),
    y: clamp(anchorY - cardH / 2, pad, vh - cardH - pad),
  };
}

export default function EmotionMap2D({
  leads,
  height = 420,
  highlightLeadIds = [],
  onClearHighlights,
  onOpenConversation,
  onSendFollowUp,
  onMarkAsWon,
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  const [selected, setSelected] = useState<Lead | null>(null);
  const [fixedPos, setFixedPos] = useState<{ x: number; y: number } | null>(
    null
  );

  const highlightSet = useMemo(
    () => new Set(highlightLeadIds),
    [highlightLeadIds]
  );

  const points = useMemo(() => {
    return leads.map((l) => {
      const intent = computeIntent(l);
      const risk = computeRisk(l);
      return { lead: l, intent, risk, x: intent, y: risk };
    });
  }, [leads]);

  function openCardForLead(lead: Lead, clientX: number, clientY: number) {
    setSelected(lead);

    const cardW = 380;
    const cardH = 380;
    const pad = 12;

    const pos = computeFixedPosition({
      anchorX: clientX,
      anchorY: clientY,
      vw: window.innerWidth,
      vh: window.innerHeight,
      cardW,
      cardH,
      pad,
    });

    setFixedPos(pos);
  }

  const closeCard = () => {
    setSelected(null);
    setFixedPos(null);
  };

  return (
    <div className="relative rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-white font-bold text-lg">DOCA Emotion Map</h3>
          <p className="text-gray-500 text-sm mt-1">
            Intenção × Risco — clique em um ponto para ações e sugestão IA.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-gray-200">
            {points.length} leads
          </span>

          <span className="px-3 py-1.5 rounded-full border border-[#f57f17]/20 bg-[#f57f17]/10 text-xs text-[#f57f17] font-semibold">
            Assinatura visual DOCA
          </span>

          {highlightLeadIds.length > 0 && (
            <>
              <span className="px-3 py-1.5 rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/15 text-xs text-white font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8b5cf6]" />
                Plano do dia: {highlightLeadIds.length} destacados
              </span>

              <button
                onClick={onClearHighlights}
                className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition text-xs text-gray-200 font-semibold"
              >
                Limpar destaque
              </button>
            </>
          )}
        </div>
      </div>

      {/* Map wrapper */}
      <div
        ref={mapRef}
        className="relative rounded-b-[28px] overflow-hidden"
        style={{ height }}
      >
        {/* Grid */}
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,127,23,0.10),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>

        {/* Quadrants */}
        <div className="pointer-events-none absolute inset-0 z-[2]">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
        </div>

        {/* Labels */}
        <div className="pointer-events-none absolute inset-0 p-6 z-[3]">
          <div className="absolute left-6 top-6 text-xs text-gray-400">
            <div className="font-semibold text-gray-200">SALVAR (URGENTE)</div>
            <div>Alta intenção • Alto risco</div>
          </div>

          <div className="absolute right-6 top-6 text-xs text-gray-400 text-right">
            <div className="font-semibold text-gray-200">FECHAR AGORA</div>
            <div>Alta intenção • Baixo risco</div>
          </div>

          <div className="absolute left-6 bottom-6 text-xs text-gray-400">
            <div className="font-semibold text-gray-200">NUTRIR COM PROVA</div>
            <div>Baixa intenção • Alto risco</div>
          </div>

          <div className="absolute right-6 bottom-6 text-xs text-gray-400 text-right">
            <div className="font-semibold text-gray-200">AUTOMATIZAR</div>
            <div>Baixa intenção • Baixo risco</div>
          </div>
        </div>

        {/* Axis */}
        <div className="pointer-events-none absolute inset-0 z-[4]">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 rotate-[-90deg] origin-left">
            RISCO ↑
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-gray-500">
            INTENÇÃO →
          </div>
        </div>

        {/* Dots */}
        <div className="absolute inset-0 z-[10]">
          {points.map((p) => {
            const leftPct = clamp(p.x, 0.04, 0.96) * 100;
            const topPct = clamp(1 - p.y, 0.04, 0.96) * 100;

            const isHighlighted = highlightSet.has(p.lead.id);

            const dotClass = isHighlighted
              ? "bg-[#8b5cf6] shadow-[0_0_0_16px_rgba(139,92,246,0.22)]"
              : dotStyle(p.intent, p.risk);

            return (
              <button
                key={p.lead.id}
                onClick={(e) => {
                  e.stopPropagation();
                  openCardForLead(p.lead, e.clientX, e.clientY);
                }}
                className={["absolute group", isHighlighted ? "z-[60]" : "z-[10]"].join(
                  " "
                )}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                title={p.lead.name || p.lead.phone}
              >
                <div className="relative">
                  {isHighlighted && (
                    <div className="absolute inset-[-22px] rounded-full bg-[#8b5cf6]/14 blur-2xl animate-pulse" />
                  )}

                  <div
                    className={[
                      "relative rounded-full border border-black/40 transition-all",
                      dotClass,
                      "group-hover:scale-[1.25]",
                      isHighlighted ? "h-6 w-6" : "h-4 w-4",
                      isHighlighted ? "ring-4 ring-[#8b5cf6]/60" : "",
                    ].join(" ")}
                  />

                  {isHighlighted && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-8 px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#8b5cf6]/35 bg-[#8b5cf6]/15 text-[#c4b5fd] whitespace-nowrap">
                      PLANO
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ✅ PORTAL: Overlay + Card fora do mapa (nunca corta) */}
      {selected && fixedPos
        ? ReactDOM.createPortal(
            <>
              {/* overlay global */}
              <button
                className="fixed inset-0 z-[9998] cursor-default"
                style={{ background: "transparent" }}
                onClick={closeCard}
                aria-label="Fechar"
              />

              <div
                className="fixed z-[9999] w-[380px] max-w-[calc(100vw-24px)] rounded-[24px] border border-white/10 bg-black/85 backdrop-blur-xl shadow-2xl animate-[fadeIn_140ms_ease-out]"
                style={{ left: fixedPos.x, top: fixedPos.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-white/10 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold text-sm">
                      {initials(selected.name, selected.phone)}
                    </div>

                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">
                        {selected.name || "Contato sem nome"}
                      </p>
                      <p className="text-gray-400 text-sm flex items-center gap-2 mt-0.5">
                        <Phone className="w-4 h-4" />
                        {fmtPhone(selected.phone)}
                      </p>

                      {highlightSet.has(selected.id) && (
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#8b5cf6]/35 bg-[#8b5cf6]/15 text-[#c4b5fd] text-xs font-semibold">
                          <Sparkles className="w-4 h-4 text-[#8b5cf6]" />
                          Afetado pelo plano do dia
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={closeCard}
                    className="h-9 w-9 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center"
                    title="Fechar"
                  >
                    <X className="w-4 h-4 text-gray-200" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {(() => {
                    const intent = computeIntent(selected);
                    const risk = computeRisk(selected);
                    const q = quadrantLabel(intent, risk);

                    return (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs text-gray-500">Quadrante</p>
                        <p className="text-white font-bold mt-1">{q.title}</p>
                        <p className="text-gray-400 text-sm mt-1">{q.hint}</p>

                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-black/30 text-gray-200">
                            {Math.round(intent * 100)}% intenção
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-black/30 text-gray-200">
                            {Math.round(risk * 100)}% risco
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-black/30 text-gray-200">
                            health {selected.health_score ?? 50}
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-black/30 text-gray-200">
                            last {timeAgo(selected.last_touch_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs text-gray-500 mb-2">Última mensagem</p>
                    <p className="text-white text-sm leading-relaxed">
                      {selected.last_message || "Sem mensagens ainda."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#f57f17]/20 bg-[#f57f17]/10 p-4">
                    <div className="flex items-center gap-2 text-[#f57f17]">
                      <Flame className="w-4 h-4" />
                      <p className="text-sm font-semibold">Sugestão IA</p>
                    </div>

                    <p className="text-gray-200 text-sm mt-2 leading-relaxed">
                      Mensagem curta com prova social + CTA direto. Ex:{" "}
                      <span className="text-white font-semibold">
                        “Consigo te colocar em funcionamento hoje. Quer que eu te
                        mande os planos?”
                      </span>
                    </p>

                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-300" />
                      Alta chance de resposta em 10–20 min
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => onOpenConversation?.(selected)}
                      className="h-10 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm font-semibold text-white"
                    >
                      Abrir
                    </button>

                    <button
                      onClick={() => onSendFollowUp?.(selected)}
                      className="h-10 rounded-2xl border border-[#f57f17]/30 bg-[#f57f17]/10 hover:bg-[#f57f17]/15 transition text-sm font-semibold text-white flex items-center justify-center gap-2"
                    >
                      <ArrowRight className="w-4 h-4 text-[#f57f17]" />
                      Follow-up
                    </button>

                    <button
                      onClick={() => onMarkAsWon?.(selected)}
                      className="h-10 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 hover:bg-emerald-500/15 transition text-sm font-semibold text-white"
                    >
                      Ganho
                    </button>
                  </div>

                  <div className="text-[11px] text-gray-500">
                    *MVP: intenção/risco por heurística (depois plugamos no motor real).
                  </div>
                </div>
              </div>

              <style>{`
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(6px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>
            </>,
            document.body
          )
        : null}
    </div>
  );
}
