import React, { useMemo, useState } from "react";
import {
  Search,
  Flame,
  ShieldCheck,
  AlertTriangle,
  Phone,
  ArrowRight,
} from "lucide-react";

// -------------------------------------
// Tipos leves (não acoplar)
// -------------------------------------
type Lead = {
  updated_at: string;
  id: string;
  phone: string;
  name: string | null;

  // ✅ status pode vir undefined do demo antigo
  status?: "new" | "active" | "won" | "lost";

  stage?: string;
  urgency_level?: "low" | "normal" | "high" | "critical";
  health_score?: number;
  conversion_probability?: number;
  tags?: string[];

  // enriquecido no join
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

// -------------------------------------
// Helpers UI
// -------------------------------------
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

function stageMeta(stage?: string) {
  const s = (stage || "curioso").toLowerCase();

  const map: Record<
    string,
    { label: string; bg: string; border: string; text: string; glow: string }
  > = {
    "cético": {
      label: "CÉTICO",
      bg: "bg-fuchsia-500/10",
      border: "border-fuchsia-400/25",
      text: "text-fuchsia-200",
      glow: "shadow-[0_0_0_1px_rgba(217,70,239,0.25)]",
    },
    "frustrado": {
      label: "FRUSTRADO",
      bg: "bg-orange-500/10",
      border: "border-orange-400/25",
      text: "text-orange-200",
      glow: "shadow-[0_0_0_1px_rgba(251,146,60,0.25)]",
    },
    "curioso": {
      label: "CURIOSO",
      bg: "bg-blue-500/10",
      border: "border-blue-400/25",
      text: "text-blue-200",
      glow: "shadow-[0_0_0_1px_rgba(96,165,250,0.25)]",
    },
    "sensível_preço": {
      label: "SENSÍVEL A PREÇO",
      bg: "bg-cyan-500/10",
      border: "border-cyan-400/25",
      text: "text-cyan-200",
      glow: "shadow-[0_0_0_1px_rgba(34,211,238,0.25)]",
    },
    "empolgado": {
      label: "EMPOLGADO",
      bg: "bg-emerald-500/10",
      border: "border-emerald-400/25",
      text: "text-emerald-200",
      glow: "shadow-[0_0_0_1px_rgba(52,211,153,0.25)]",
    },
    "pronto": {
      label: "PRONTO",
      bg: "bg-green-500/10",
      border: "border-green-400/25",
      text: "text-green-200",
      glow: "shadow-[0_0_0_1px_rgba(74,222,128,0.25)]",
    },
  };

  return map[s] || map["curioso"];
}

function urgencyMeta(urgency?: string) {
  const u = (urgency || "normal").toLowerCase();
  const map: Record<
    string,
    { label: string; dot: string; text: string; bg: string }
  > = {
    low: {
      label: "Baixa",
      dot: "bg-gray-400",
      text: "text-gray-300",
      bg: "bg-white/5",
    },
    normal: {
      label: "Normal",
      dot: "bg-sky-400",
      text: "text-sky-200",
      bg: "bg-sky-500/10",
    },
    high: {
      label: "Alta",
      dot: "bg-yellow-400",
      text: "text-yellow-200",
      bg: "bg-yellow-500/10",
    },
    critical: {
      label: "Crítica",
      dot: "bg-red-400",
      text: "text-red-200",
      bg: "bg-red-500/10",
    },
  };

  return map[u] || map.normal;
}

// ✅ BLINDADO: nunca retorna undefined
function statusMeta(status?: Lead["status"]) {
  const s = (status || "active") as NonNullable<Lead["status"]>;

  const map: Record<
    NonNullable<Lead["status"]>,
    { label: string; bg: string; text: string; dot: string }
  > = {
    new: {
      label: "Novo",
      bg: "bg-white/5",
      text: "text-gray-200",
      dot: "bg-sky-400",
    },
    active: {
      label: "Ativo",
      bg: "bg-emerald-500/10",
      text: "text-emerald-200",
      dot: "bg-emerald-400",
    },
    won: {
      label: "Ganho",
      bg: "bg-green-500/10",
      text: "text-green-200",
      dot: "bg-green-400",
    },
    lost: {
      label: "Perdido",
      bg: "bg-red-500/10",
      text: "text-red-200",
      dot: "bg-red-400",
    },
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
          className={[
            "h-full rounded-full",
            good
              ? "bg-emerald-400/80"
              : mid
              ? "bg-yellow-400/75"
              : "bg-red-400/75",
          ].join(" ")}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

// -------------------------------------
// Componente
// -------------------------------------
export default function LeadsInbox({
  leads: leadsProp,
  conversations: conversationsProp,
  onOpenConversation,
  onSendFollowUp,
  onMarkAsWon,
}: {
  leads?: Lead[];
  conversations?: Conversation[];
  onOpenConversation?: (lead: any) => void;
  onSendFollowUp?: (lead: any) => void;
  onMarkAsWon?: (lead: any) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ✅ sempre arrays
  const leads: Lead[] = useMemo(() => {
    return Array.isArray(leadsProp) ? leadsProp : [];
  }, [leadsProp]);

  const conversations: Conversation[] = useMemo(() => {
    return Array.isArray(conversationsProp) ? conversationsProp : [];
  }, [conversationsProp]);

  // join com conversations pra last_message e updated_at
  const enriched = useMemo(() => {
    const byLead = new Map<string, Conversation>();
    for (const c of conversations) byLead.set(c.lead_id, c);

    return leads.map((l) => {
      const conv = byLead.get(l.id);
      return {
        ...l,
        // ✅ defaults que impedem undefined
        status: l.status || "active",
        last_message: conv?.last_message || "",
        updated_at: conv?.updated_at || l.updated_at,
        conversation_id: conv?.id || null,
      };
    });
  }, [leads, conversations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;

    return enriched.filter((l) => {
      const name = (l.name || "").toLowerCase();
      const phone = (l.phone || "").toLowerCase();
      const stage = (l.stage || "").toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        stage.includes(q) ||
        (l.last_message || "").toLowerCase().includes(q)
      );
    });
  }, [enriched, query]);

  const selected = useMemo(() => {
    return filtered.find((l) => l.id === selectedId) || filtered[0] || null;
  }, [filtered, selectedId]);

  // counts
  const total = filtered.length;
  const readyCount = filtered.filter(
    (l) => (l.stage || "").toLowerCase() === "pronto"
  ).length;

  const hotCount = filtered.filter(
    (l) =>
      (l.urgency_level || "normal") === "high" ||
      (l.urgency_level || "normal") === "critical"
  ).length;

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-white font-bold text-lg">Leads</h3>
          <p className="text-gray-400 text-sm mt-1">
            Fila premium de leads (demo realista) — clique para ver detalhes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            Total: <span className="text-white font-semibold">{total}</span>
          </span>
          <span className="text-xs text-emerald-200 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20">
            Prontos:{" "}
            <span className="text-white font-semibold">{readyCount}</span>
          </span>
          <span className="text-xs text-yellow-200 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-400/20">
            Quentes:{" "}
            <span className="text-white font-semibold">{hotCount}</span>
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr]">
        {/* Left list */}
        <div className="border-r border-white/10">
          {/* Search */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, número, estágio..."
                className="w-full bg-transparent outline-none text-sm text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-[740px] overflow-auto">
            {filtered.map((l) => {
              const active = selected?.id === l.id;
              const st = stageMeta(l.stage);
              const urg = urgencyMeta(l.urgency_level);
              const sm = statusMeta(l.status);

              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className={[
                    "w-full text-left px-4 py-4 border-b border-white/5 transition-all",
                    active
                      ? "bg-[#f57f17]/10 border-l-4 border-l-[#f57f17]"
                      : "hover:bg-white/[0.03]",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold text-sm">
                      {initials(l.name, l.phone)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate">
                            {l.name || fmtPhone(l.phone)}
                          </p>
                          <p className="text-gray-500 text-xs truncate">
                            {l.name ? fmtPhone(l.phone) : "Contato sem nome"}
                          </p>
                        </div>

                        {/* status */}
                        <div
                          className={`flex items-center gap-2 px-3 py-1 rounded-full ${sm.bg} border border-white/10`}
                        >
                          <span className={`h-2 w-2 rounded-full ${sm.dot}`} />
                          <span className={`text-xs font-semibold ${sm.text}`}>
                            {sm.label}
                          </span>
                        </div>
                      </div>

                      {/* preview */}
                      <p className="text-gray-400 text-xs mt-2 line-clamp-2">
                        {l.last_message ||
                          "Sem mensagens ainda — lead recém-criado."}
                      </p>

                      {/* badges */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span
                          className={[
                            "text-[11px] font-bold px-2.5 py-1 rounded-full border",
                            st.bg,
                            st.border,
                            st.text,
                            st.glow,
                          ].join(" ")}
                        >
                          {st.label}
                        </span>

                        <span
                          className={[
                            "text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/10",
                            urg.bg,
                            urg.text,
                          ].join(" ")}
                        >
                          <span
                            className={`inline-block h-2 w-2 rounded-full mr-2 ${urg.dot}`}
                          />
                          {urg.label}
                        </span>

                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-200">
                          {Math.round((l.conversion_probability || 0) * 100)}%
                          conversão
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="p-6 text-gray-400 text-sm">
                Nenhum lead encontrado.
              </div>
            )}
          </div>
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
                  <h3 className="text-white font-bold text-2xl">
                    {selected.name || "Contato sem nome"}
                  </h3>
                  <p className="text-gray-400 mt-1 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {fmtPhone(selected.phone)}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-2 rounded-2xl border border-white/10 bg-white/5 text-gray-200 text-sm">
                    Score:{" "}
                    <span className="text-white font-semibold">
                      {selected.health_score ?? 50}
                    </span>
                  </span>

                  <span className="px-3 py-2 rounded-2xl border border-white/10 bg-white/5 text-gray-200 text-sm flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#f57f17]" />
                    Temp:{" "}
                    <span className="text-white font-semibold">
                      {selected.health_score ?? 50}
                    </span>
                  </span>

                  <span className="px-3 py-2 rounded-2xl border border-white/10 bg-white/5 text-gray-200 text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    {Math.round((selected.conversion_probability || 0) * 100)}%
                  </span>
                </div>
              </div>

              {/* last message */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-gray-500 mb-2">Última mensagem</p>
                <p className="text-white leading-relaxed">
                  {selected.last_message ||
                    "Sem mensagens ainda — lead criado agora."}
                </p>
              </div>

              {/* health */}
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
                      <p className="text-white font-semibold">
                        Follow-up inteligente
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        Priorize este lead com mensagem de valor + CTA (call ou
                        link). Ajuste pelo estágio {selected.stage}.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* flags */}
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
                      <span
                        key={t}
                        className="text-xs text-gray-200 px-3 py-1 rounded-full bg-white/5 border border-white/10"
                      >
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => selected && onOpenConversation?.(selected)}
                  className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-white font-semibold"
                >
                  Abrir conversa
                </button>

                <button
                  onClick={() => selected && onSendFollowUp?.(selected)}
                  className="rounded-2xl border border-[#f57f17]/30 bg-[#f57f17]/10 hover:bg-[#f57f17]/15 transition px-4 py-3 text-white font-semibold"
                >
                  Enviar follow-up
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
    </div>
  );
}
