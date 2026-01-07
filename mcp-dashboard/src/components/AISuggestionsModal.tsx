import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  MessageSquare,
  Calendar,
  Zap,
  ArrowUpRight,
  Target,
  ShieldCheck,
} from "lucide-react";
import Modal from "./Modal";

type Suggestion = {
  id: string;
  title: string;
  reason: string;
  impact: "alto" | "médio" | "baixo";
  actionLabel: string;
  messageToCopy: string;
  icon: any;
  tone: "orange" | "cyan" | "green" | "red";
};

function pillImpact(impact: Suggestion["impact"]) {
  if (impact === "alto")
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (impact === "médio")
    return "border-[#f57f17]/25 bg-[#f57f17]/10 text-[#f57f17]";
  return "border-white/10 bg-white/5 text-gray-300";
}

function toneIcon(tone: Suggestion["tone"]) {
  return tone === "green"
    ? "text-emerald-400"
    : tone === "cyan"
    ? "text-cyan-400"
    : tone === "red"
    ? "text-red-400"
    : "text-[#f57f17]";
}

function toneBox(tone: Suggestion["tone"]) {
  return tone === "green"
    ? "border-emerald-500/30 bg-emerald-500/10"
    : tone === "cyan"
    ? "border-cyan-500/30 bg-cyan-500/10"
    : tone === "red"
    ? "border-red-500/30 bg-red-500/10"
    : "border-[#f57f17]/25 bg-[#f57f17]/10";
}

export default function AISuggestionsModal({
  open,
  onClose,
  onGoToAnalysis,
}: {
  open: boolean;
  onClose: () => void;
  onGoToAnalysis?: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const suggestions = useMemo<Suggestion[]>(
    () => [
      {
        id: "s1",
        title: "Fila de follow-up (Prontos → agendar)",
        reason:
          "Você tem leads com alta intenção. Se você chamar agora, aumenta muito a chance de agendar.",
        impact: "alto",
        actionLabel: "Copiar mensagem",
        messageToCopy:
          "Oi! Vi que você ficou com interesse — consigo te ajudar a agendar uma avaliação rápida. Qual melhor horário hoje ou amanhã?",
        icon: Calendar,
        tone: "green",
      },
      {
        id: "s2",
        title: "Responder objeção de preço com ROI e prova social",
        reason:
          "Quando preço aparece, a melhor rota é reduzir risco: mostrar resultado + comparação + garantia.",
        impact: "alto",
        actionLabel: "Copiar argumento",
        messageToCopy:
          "Entendo total sobre o preço. Pra ficar claro: o objetivo é gerar resultado e se pagar. Posso te mostrar cases e como funciona na prática — e aí você decide com segurança.",
        icon: ShieldCheck,
        tone: "orange",
      },
      {
        id: "s3",
        title: "Qualificação rápida (curioso → pronto)",
        reason:
          "Muita gente fica no “curioso” por falta de clareza. Faça 2 perguntas e já direciona pra oferta certa.",
        impact: "médio",
        actionLabel: "Copiar roteiro",
        messageToCopy:
          "Pra eu te orientar certinho: 1) qual seu objetivo principal agora? 2) você quer algo mais rápido (resultado em curto prazo) ou algo mais definitivo?",
        icon: Target,
        tone: "cyan",
      },
      {
        id: "s4",
        title: "Atalho: mandar áudio humano + CTA simples",
        reason:
          "Quando o lead está cético/frustrado, uma mensagem humana reduz resistência e acelera resposta.",
        impact: "médio",
        actionLabel: "Copiar texto",
        messageToCopy:
          "Vou ser bem direto e humano: eu entendi seu caso. Se você topar, eu te explico o melhor caminho em 2 minutos e te digo se vale a pena pra você. Pode ser?",
        icon: MessageSquare,
        tone: "red",
      },
    ],
    []
  );

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sugestões IA"
      subtitle="Ações prontas para aumentar conversão (copie e aplique em 1 clique)."
      maxWidthClass="max-w-4xl"
    >
      {/* header CTA row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl border border-[#f57f17]/25 bg-[#f57f17]/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#f57f17]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Sugestões geradas automaticamente
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Hoje isso é mock. Amanhã a IA vai puxar das conversas e do funil.
            </p>
          </div>
        </div>

        {onGoToAnalysis && (
          <button
            onClick={() => {
              onClose();
              onGoToAnalysis();
            }}
            className="h-11 px-5 rounded-2xl border border-[#f57f17]/20 bg-[#f57f17]/10 hover:bg-[#f57f17]/15 transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-[#f57f17]" />
            <span className="text-sm font-semibold text-[#f57f17]">
              Ir para Análise IA
            </span>
            <ArrowUpRight className="w-4 h-4 text-[#f57f17]" />
          </button>
        )}
      </div>

      {/* list */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="rounded-[26px] border border-white/10 bg-black/50 p-5 hover:bg-black/60 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={[
                    "h-11 w-11 rounded-2xl border flex items-center justify-center shrink-0",
                    toneBox(s.tone),
                  ].join(" ")}
                >
                  <s.icon className={["w-5 h-5", toneIcon(s.tone)].join(" ")} />
                </div>

                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{s.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{s.reason}</p>
                </div>
              </div>

              <span
                className={[
                  "shrink-0 text-[11px] font-semibold rounded-full border px-2.5 py-1",
                  pillImpact(s.impact),
                ].join(" ")}
              >
                Impacto {s.impact}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Mensagem pronta
              </p>
              <p className="text-sm text-gray-200 mt-2 leading-relaxed">
                {s.messageToCopy}
              </p>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => copy(s.messageToCopy, s.id)}
                  className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-semibold text-gray-200"
                >
                  {copiedId === s.id ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#f57f17]" />
                  )}
                  {copiedId === s.id ? "Copiado" : s.actionLabel}
                </button>

                <span className="text-xs text-gray-500">
                  Cole no WhatsApp e mande.
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* footer */}
      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-600">
          Próximo upgrade: a IA vai gerar sugestões por conversa, estágio do funil e
          objeções detectadas.
        </p>

        <button
          onClick={onClose}
          className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm font-semibold text-gray-200"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}
