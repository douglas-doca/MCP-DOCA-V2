import React, { useMemo, useState } from "react";
import {
  Search,
  Flame,
  ShieldCheck,
  AlertTriangle,
  Phone,
  ArrowRight,
  X,
  Send,
  Sparkles,
  Loader2,
  CheckCircle2,
  Brain,
  Zap,
  RefreshCw,
} from "lucide-react";

// Tipos
type Lead = {
  updated_at: string;
  id: string;
  phone: string;
  name: string | null;
  status?: "new" | "active" | "won" | "lost";
  stage?: string;
  urgency_level?: "low" | "normal" | "high" | "critical";
  health_score?: number;
  conversion_probability?: number;
  tags?: string[];
  last_message?: string;
  conversation_id?: string | null;
};

type Conversation = {
  id: string;
  lead_id: string;
  phone: string;
  name: string | null;
  status: "open" | "closed";
  updated_at: string;
  last_message?: string;
};

type Props = {
  leads: Lead[];
  conversations: Conversation[];
  onOpenConversation?: (lead: Lead) => void;
  onSendFollowUp?: (lead: Lead, message?: string) => void;
  onMarkAsWon?: (lead: Lead) => void;
};

// Sugestões de mensagem por estágio
const STAGE_SUGGESTIONS: Record<string, { title: string; suggestions: string[] }> = {
  "pronto": {
    title: "Lead PRONTO para fechar!",
    suggestions: [
      "Oi! Vi que você está quase fechando. Posso te ajudar a finalizar agora?",
      "E aí, pronto pra começar? Tenho um horário agora pra gente acertar os detalhes!",
      "Só falta um passo! Quer que eu te mande o link pra fechar?",
    ]
  },
  "empolgado": {
    title: "Lead EMPOLGADO - mantenha a energia!",
    suggestions: [
      "Que bom que curtiu! Quer ver um exemplo real funcionando?",
      "E aí, tudo certo? Quer que eu te explique os próximos passos?",
      "Massa! Vou te mandar um case de sucesso parecido com o seu cenário.",
    ]
  },
  "curioso": {
    title: "Lead CURIOSO - tire as dúvidas!",
    suggestions: [
      "Oi! Ficou alguma dúvida? Tô aqui pra te ajudar!",
      "E aí, o que achou? Posso explicar melhor alguma parte?",
      "Tem mais alguma coisa que você gostaria de saber?",
    ]
  },
  "sensível_preço": {
    title: "Lead SENSÍVEL A PREÇO - mostre valor!",
    suggestions: [
      "Oi! Consegui uma condição especial pra você. Quer saber mais?",
      "Entendo a preocupação com investimento. Posso te mostrar o ROI típico?",
      "Temos opções flexíveis de pagamento. Posso te explicar?",
    ]
  },
  "cético": {
    title: "Lead CÉTICO - prove com resultados!",
    suggestions: [
      "Oi! Entendo suas dúvidas. Posso te mostrar alguns cases de sucesso?",
      "Normal ter dúvidas! Quer ver depoimentos de clientes parecidos com você?",
      "Que tal uma demonstração prática? Assim você vê funcionando.",
    ]
  },
  "frustrado": {
    title: "Lead FRUSTRADO - seja empático!",
    suggestions: [
      "Oi! Vi que teve algumas dificuldades. Como posso te ajudar?",
      "Entendi seu ponto. Vamos resolver isso juntos?",
      "Desculpa pelo inconveniente. O que posso fazer pra melhorar sua experiência?",
    ]
  },
};

// Helpers
function initials(name: string | null, phone: string) {
  const base = (name || "").trim();
  if (!base) return phone.replace(/\D/g, "").slice(-2).padStart(2, "0");
  const parts = base.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return phone;
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = d.slice(0, 2);
  const p1 = d.slice(2, 7);
  const p2 = d.slice(7, 11);
  return `+55 (${ddd}) ${p1}-${p2}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "";
  const now = Date.now();
  const then = new Date(date).getTime();
  if (isNaN(then)) return "";
  
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin}min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} dias`;
  return `há ${Math.floor(diffDays / 7)} sem`;
}

function stageMeta(stage?: string) {
  const s = (stage || "curioso").toLowerCase();
  const map: Record<string, { label: string; bg: string; border: string; text: string; glow: string }> = {
    "cético": { label: "CÉTICO", bg: "bg-fuchsia-500/10", border: "border-fuchsia-400/25", text: "text-fuchsia-200", glow: "shadow-[0_0_0_1px_rgba(217,70,239,0.25)]" },
    "frustrado": { label: "FRUSTRADO", bg: "bg-orange-500/10", border: "border-orange-400/25", text: "text-orange-200", glow: "shadow-[0_0_0_1px_rgba(251,146,60,0.25)]" },
    "curioso": { label: "CURIOSO", bg: "bg-blue-500/10", border: "border-blue-400/25", text: "text-blue-200", glow: "shadow-[0_0_0_1px_rgba(96,165,250,0.25)]" },
    "sensível_preço": { label: "SENSÍVEL A PREÇO", bg: "bg-cyan-500/10", border: "border-cyan-400/25", text: "text-cyan-200", glow: "shadow-[0_0_0_1px_rgba(34,211,238,0.25)]" },
    "empolgado": { label: "EMPOLGADO", bg: "bg-emerald-500/10", border: "border-emerald-400/25", text: "text-emerald-200", glow: "shadow-[0_0_0_1px_rgba(52,211,153,0.25)]" },
    "pronto": { label: "PRONTO", bg: "bg-green-500/10", border: "border-green-400/25", text: "text-green-200", glow: "shadow-[0_0_0_1px_rgba(74,222,128,0.25)]" },
  };
  return map[s] || map["curioso"];
}

function urgencyMeta(urgency?: string) {
  const u = (urgency || "normal").toLowerCase();
  const map: Record<string, { label: string; dot: string; text: string; bg: string }> = {
    low: { label: "Baixa", dot: "bg-gray-400", text: "text-gray-300", bg: "bg-white/5" },
    normal: { label: "Normal", dot: "bg-sky-400", text: "text-sky-200", bg: "bg-sky-500/10" },
    high: { label: "Alta", dot: "bg-yellow-400", text: "text-yellow-200", bg: "bg-yellow-500/10" },
    critical: { label: "Crítica", dot: "bg-red-400", text: "text-red-200", bg: "bg-red-500/10" },
  };
  return map[u] || map.normal;
}

function statusMeta(status?: Lead["status"]) {
  const s = (status || "active") as NonNullable<Lead["status"]>;
  const map: Record<NonNullable<Lead["status"]>, { label: string; bg: string; text: string; dot: string }> = {
    new: { label: "Novo", bg: "bg-white/5", text: "text-gray-200", dot: "bg-sky-400" },
    active: { label: "Ativo", bg: "bg-emerald-500/10", text: "text-emerald-200", dot: "bg-emerald-400" },
    won: { label: "Ganho", bg: "bg-green-500/10", text: "text-green-200", dot: "bg-green-400" },
    lost: { label: "Perdido", bg: "bg-red-500/10", text: "text-red-200", dot: "bg-red-400" },
  };
  return map[s] || map.active;
}

function HealthBar({ value }: { value: number }) {
  const v = clamp(value, 0, 100);
  const good = v >= 70;
  const mid = v >= 45 && v < 70;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span>Health</span>
        <span className="text-gray-200 font-semibold">{v}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
        <div
          style={{ width: `${v}%` }}
          className={[
            "h-full transition-all rounded-full",
            good ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
            mid ? "bg-gradient-to-r from-yellow-500 to-yellow-400" :
            "bg-gradient-to-r from-red-500 to-red-400",
          ].join(" ")}
        />
      </div>
    </div>
  );
}

// ============ MODAL DE FOLLOW-UP ============
function FollowUpModal({ 
  lead, 
  onClose, 
  onSend 
}: { 
  lead: Lead; 
  onClose: () => void; 
  onSend: (message: string) => void;
}) {
  const stage = (lead.stage || "curioso").toLowerCase();
  const stageData = STAGE_SUGGESTIONS[stage] || STAGE_SUGGESTIONS["curioso"];
  
  const [message, setMessage] = useState(stageData.suggestions[0]);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 500));
    onSend(message);
    setSending(false);
    onClose();
  }

  async function handleGenerate() {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 800));
    // Gera uma variação da mensagem atual
    const variations = [
      `Oi ${lead.name?.split(" ")[0] || ""}! ${message}`,
      `${message} O que acha?`,
      `${message} Tô disponível agora se quiser conversar!`,
    ];
    setMessage(variations[Math.floor(Math.random() * variations.length)]);
    setGenerating(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#0a0a0a] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#f57f17]/10 border border-[#f57f17]/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-[#f57f17]" />
            </div>
            <div>
              <h3 className="text-white font-bold">Follow-up Inteligente</h3>
              <p className="text-xs text-gray-500">Para: {lead.name || fmtPhone(lead.phone)}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Stage Info */}
          <div className="rounded-xl bg-[#f57f17]/5 border border-[#f57f17]/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#f57f17]" />
              <span className="text-sm font-semibold text-[#f57f17]">{stageData.title}</span>
            </div>
            <p className="text-xs text-gray-400">
              Sugestões baseadas no estágio atual do lead
            </p>
          </div>

          {/* Suggestions */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Sugestões da IA</label>
            <div className="space-y-2">
              {stageData.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setMessage(s)}
                  className={`w-full text-left p-3 rounded-xl border transition text-sm ${
                    message === s
                      ? "border-[#f57f17]/50 bg-[#f57f17]/10 text-white"
                      : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">Mensagem personalizada</label>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="text-xs text-[#f57f17] hover:underline flex items-center gap-1"
              >
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Gerar variação
              </button>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="w-full p-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none resize-none focus:border-[#f57f17]/30"
              placeholder="Digite sua mensagem..."
            />
            <p className="text-xs text-gray-600 mt-1">{message.length} caracteres</p>
          </div>

          {/* Context */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs text-gray-500 mb-2">Contexto do lead</p>
            <div className="flex flex-wrap gap-2">
              <span className={`text-[10px] px-2 py-1 rounded-full ${stageMeta(lead.stage).bg} ${stageMeta(lead.stage).text} border ${stageMeta(lead.stage).border}`}>
                {stageMeta(lead.stage).label}
              </span>
              <span className={`text-[10px] px-2 py-1 rounded-full ${urgencyMeta(lead.urgency_level).bg} ${urgencyMeta(lead.urgency_level).text} border border-white/10`}>
                Urgência: {urgencyMeta(lead.urgency_level).label}
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
                Health: {lead.health_score ?? 50}
              </span>
            </div>
            {lead.last_message && (
              <div className="mt-3 p-3 rounded-lg bg-black/30 border border-white/5">
                <p className="text-[10px] text-gray-500 mb-1">Última msg do lead:</p>
                <p className="text-xs text-gray-400 line-clamp-2">{lead.last_message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="h-10 px-6 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar Follow-up
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============
export default function LeadsInbox({
  leads,
  conversations,
  onOpenConversation,
  onSendFollowUp,
  onMarkAsWon,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);

  // Enriquece leads com última mensagem
  const enriched = useMemo(() => {
    const convMap = new Map(conversations.map((c) => [c.lead_id, c]));
    return leads.map((l) => {
      const conv = convMap.get(l.id);
      return {
        ...l,
        last_message: l.last_message || conv?.last_message || null,
        conversation_id: l.conversation_id || conv?.id || null,
      };
    });
  }, [leads, conversations]);

  // Filtro + ordenação por temperatura
  const filtered = useMemo(() => {
    let arr = enriched;
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((l) => {
        const n = (l.name || "").toLowerCase();
        const p = (l.phone || "").toLowerCase();
        const m = (l.last_message || "").toLowerCase();
        return n.includes(q) || p.includes(q) || m.includes(q);
      });
    }
    return [...arr].sort((a, b) => {
      const tempA = (a.health_score ?? 50) + (a.conversion_probability ?? 0) * 50;
      const tempB = (b.health_score ?? 50) + (b.conversion_probability ?? 0) * 50;
      return tempB - tempA;
    });
  }, [enriched, query]);

  function handleFollowUpClick(lead: Lead) {
    setFollowUpLead(lead);
  }

  function handleSendMessage(message: string) {
    if (followUpLead && onSendFollowUp) {
      onSendFollowUp(followUpLead, message);
    }
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#f57f17]" />
            Leads Prioritários
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Ordenados por temperatura (health + conversão)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar lead..."
            className="bg-black/30 border border-white/10 rounded-2xl px-4 py-2 text-sm text-gray-200 outline-none focus:border-[#f57f17]/30 w-60"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr]">
        {/* Left list */}
        <div className="border-r border-white/10 max-h-[700px] overflow-y-auto">
          {filtered.map((l, index) => {
            const st = stageMeta(l.stage);
            const sm = statusMeta(l.status);
            const urg = urgencyMeta(l.urgency_level);
            const temp = clamp(Math.round((l.health_score ?? 50) + (l.conversion_probability ?? 0) * 50), 0, 100);
            const lastTime = timeAgo(l.updated_at);

            return (
              <button
                key={l.id}
                onClick={() => setSelected(l)}
                className={[
                  "w-full text-left p-4 border-b border-white/5 transition",
                  selected?.id === l.id
                    ? "bg-[#f57f17]/10 border-l-2 border-l-[#f57f17]"
                    : "hover:bg-white/5",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className={[
                      "h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-bold border",
                      temp >= 70 ? "bg-orange-500/20 border-orange-400/30 text-orange-200" :
                      temp >= 50 ? "bg-yellow-500/20 border-yellow-400/30 text-yellow-200" :
                      "bg-gray-500/20 border-gray-400/30 text-gray-300",
                    ].join(" ")}>
                      {initials(l.name, l.phone)}
                    </div>
                    {index < 3 && (
                      <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#f57f17] text-[10px] font-bold text-white flex items-center justify-center">
                        {index + 1}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-semibold truncate">
                            {l.name || fmtPhone(l.phone)}
                          </p>
                          <span className={[
                            "text-[10px] font-bold px-1.5 py-0.5 rounded",
                            temp >= 80 ? "bg-orange-500/30 text-orange-200" :
                            temp >= 60 ? "bg-yellow-500/30 text-yellow-200" :
                            temp >= 40 ? "bg-blue-500/30 text-blue-200" :
                            "bg-gray-500/30 text-gray-300"
                          ].join(" ")}>
                            {temp}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs truncate flex items-center gap-2">
                          <span>{l.name ? fmtPhone(l.phone) : "Contato sem nome"}</span>
                          {lastTime && <span className="text-gray-600">• {lastTime}</span>}
                        </p>
                      </div>

                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${sm.bg} border border-white/10`}>
                        <span className={`h-2 w-2 rounded-full ${sm.dot}`} />
                        <span className={`text-xs font-semibold ${sm.text}`}>{sm.label}</span>
                      </div>
                    </div>

                    <p className="text-gray-400 text-xs mt-2 line-clamp-2">
                      {l.last_message || "Sem mensagens ainda — lead recém-criado."}
                    </p>

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className={["text-[11px] font-bold px-2.5 py-1 rounded-full border", st.bg, st.border, st.text, st.glow].join(" ")}>
                        {st.label}
                      </span>
                      <span className={["text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/10", urg.bg, urg.text].join(" ")}>
                        <span className={`inline-block h-2 w-2 rounded-full mr-2 ${urg.dot}`} />
                        {urg.label}
                      </span>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-200">
                        {Math.round((l.conversion_probability || 0) * 100)}% conversão
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-6 text-gray-400 text-sm">Nenhum lead encontrado.</div>
          )}
        </div>

        {/* Right details */}
        <div className="p-6">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              Selecione um lead
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                  <h3 className="text-white font-bold text-2xl">{selected.name || "Contato sem nome"}</h3>
                  <p className="text-gray-400 mt-1 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {fmtPhone(selected.phone)}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-2 rounded-2xl border border-white/10 bg-white/5 text-gray-200 text-sm">
                    Score: <span className="text-white font-semibold">{selected.health_score ?? 50}</span>
                  </span>
                  <span className="px-3 py-2 rounded-2xl border border-white/10 bg-white/5 text-gray-200 text-sm flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#f57f17]" />
                    Temp: <span className="text-white font-semibold">{selected.health_score ?? 50}</span>
                  </span>
                  <span className="px-3 py-2 rounded-2xl border border-white/10 bg-white/5 text-gray-200 text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    {Math.round((selected.conversion_probability || 0) * 100)}%
                  </span>
                </div>
              </div>

              {/* Last message */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-gray-500 mb-2">Última mensagem</p>
                <p className="text-white leading-relaxed">
                  {selected.last_message || "Sem mensagens ainda — lead criado agora."}
                </p>
              </div>

              {/* Health + Ação */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <HealthBar value={selected.health_score ?? 50} />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs text-gray-500">Próxima ação sugerida</p>
                  <div className="mt-3 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-[#f57f17]/15 border border-[#f57f17]/25 flex items-center justify-center">
                      <ArrowRight className="w-5 h-5 text-[#f57f17]" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">Follow-up inteligente</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Priorize este lead com mensagem de valor + CTA. Estágio: {selected.stage}.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-300" />
                  Sinais detectados
                </p>
                <div className="flex flex-wrap gap-2">
                  {(selected.tags || []).length === 0 ? (
                    <span className="text-gray-500 text-sm">Sem tags ainda</span>
                  ) : (
                    selected.tags?.map((t) => (
                      <span key={t} className="text-xs text-gray-200 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => selected && onOpenConversation?.(selected)}
                  className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-white font-semibold"
                >
                  Abrir conversa
                </button>

                <button
                  onClick={() => handleFollowUpClick(selected)}
                  className="rounded-2xl border border-[#f57f17]/30 bg-[#f57f17]/10 hover:bg-[#f57f17]/15 transition px-4 py-3 text-white font-semibold flex items-center justify-center gap-2"
                >
                  <Brain className="w-4 h-4 text-[#f57f17]" />
                  Follow-up IA
                </button>

                <button
                  onClick={() => selected && onMarkAsWon?.(selected)}
                  className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 hover:bg-emerald-500/15 transition px-4 py-3 text-white font-semibold"
                >
                  Marcar como ganho
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Follow-up */}
      {followUpLead && (
        <FollowUpModal
          lead={followUpLead}
          onClose={() => setFollowUpLead(null)}
          onSend={handleSendMessage}
        />
      )}
    </div>
  );
}