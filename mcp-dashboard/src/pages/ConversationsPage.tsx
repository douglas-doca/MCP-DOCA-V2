// src/pages/ConversationsPage.tsx
import { useEffect, useMemo, useState } from "react";
import GlassCard from "../components/GlassCard";
import { isDemoMode, getDemoData } from "../mock";

type ApiConversation = {
  id: string;
  phone: string;
  name: string | null;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  current_emotion?: string;
  temperature?: number;
  lead_id: string;
  tags?: string[];
  last_message?: string;
};

type ApiMessage = {
  id: string;
  conversation_id: string;
  from: "lead" | "agent";
  text: string;
  created_at: string;
};

type Props = {
  /** ✅ quando vem preenchido, a tela abre selecionando e mostrando msgs dessa conversa */
  initialSelectedId?: string | null;
};

const API_CONVERSATIONS = "/api/conversations?limit=200";
const API_MESSAGES = "/api/messages?conversation_id=";

function formatPhone(raw: string) {
  const phone = (raw || "").replace("@c.us", "").replace(/\D/g, "");
  if (!phone) return raw;

  // BR
  if (phone.startsWith("55") && phone.length >= 12) {
    const ddd = phone.slice(2, 4);
    const part1 = phone.slice(4, 9);
    const part2 = phone.slice(9, 13);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  return `+${phone}`;
}

export function formatDate(input?: string | number | Date | null) {
  if (input == null || input === "") return "—";

  // Date instance
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? "—" : input.toLocaleString("pt-BR");
  }

  // Timestamp number
  if (typeof input === "number") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
  }

  // String
  if (typeof input !== "string") return "—";

  const normalized = input
    .trim()
    .replace(" ", "T")
    .replace(/\+00:00$/, "Z")
    .replace(/(\.\d{3})\d+Z$/, "$1Z"); // se vier microssegundos

  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    const text = await res.text();
    throw new Error(
      `Endpoint retornou HTML (provável rota errada). URL: ${url}. Ex: ${text.slice(
        0,
        80
      )}...`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} em ${url}. ${text}`);
  }

  return (await res.json()) as T;
}

export default function ConversationsPage({ initialSelectedId }: Props) {
  const demo = useMemo(() => (isDemoMode() ? getDemoData() : null), []);
  const demoMode = Boolean(demo);

  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string | null>(null);

  // ---------------------------
  // Load conversations
  // ---------------------------
  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        // ✅ DEMO
        if (demoMode && demo) {
          const convs = [...demo.conversations].sort((a, b) =>
            a.updated_at > b.updated_at ? -1 : 1
          );
          if (!mounted) return;
          setConversations(convs as any);
          return;
        }

        // ✅ PROD
        const convs = await fetchJson<ApiConversation[]>(API_CONVERSATIONS);
        if (!mounted) return;
        setConversations(convs || []);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Erro ao carregar conversas");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [demoMode, demo]);

  // ---------------------------
  // ✅ Auto-select quando initialSelectedId vier do App (ex: clique em Leads)
  // ---------------------------
  useEffect(() => {
    if (!initialSelectedId) return;

    // só seta se a conversa existir na lista
    const exists = conversations.some((c) => c.id === initialSelectedId);
    if (!exists) return;

    setSelectedId(initialSelectedId);
  }, [initialSelectedId, conversations]);

  // ---------------------------
  // Filter conversations
  // ---------------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((c) => {
      const phone = (c.phone || "").toLowerCase();
      const name = (c.name || "").toLowerCase();
      const last = (c.last_message || "").toLowerCase();
      return phone.includes(q) || name.includes(q) || last.includes(q);
    });
  }, [query, conversations]);

  const selected = useMemo(() => {
    return conversations.find((c) => c.id === selectedId) || null;
  }, [conversations, selectedId]);

  // ---------------------------
  // Load messages for selected
  // ---------------------------
  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!selectedId) {
        setMessages([]);
        return;
      }

      try {
        setLoadingMessages(true);
        setErrorMessages(null);

        // ✅ DEMO
        if (demoMode && demo) {
          const msgs = demo.messages
            .filter((m) => m.conversation_id === selectedId)
            .sort((a, b) => (a.created_at > b.created_at ? 1 : -1)); // asc

          if (!mounted) return;
          setMessages(msgs as any);
          return;
        }

        // ✅ PROD
        const msgs = await fetchJson<ApiMessage[]>(
          `${API_MESSAGES}${encodeURIComponent(selectedId)}&limit=200`
        );

        if (!mounted) return;
        setMessages(
          (msgs || []).sort((a, b) => (a.created_at > b.created_at ? 1 : -1))
        );
      } catch (e: any) {
        if (!mounted) return;
        setErrorMessages(e?.message || "Erro ao carregar mensagens");
        setMessages([]);
      } finally {
        if (!mounted) return;
        setLoadingMessages(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [selectedId, demoMode, demo]);

  // ---------------------------
  // UI helpers: simulate "online"
  // ---------------------------
  const onlineMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of conversations) {
      const lastMin =
        Math.abs(Date.now() - new Date(c.updated_at).getTime()) / 60000;
      map[c.id] = lastMin < 25;
    }
    return map;
  }, [conversations]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Conversas</h2>
          <p className="text-gray-500 text-sm">
            Mensagens e atendimentos em tempo real
            {demoMode ? " (DEMO)" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        {/* LEFT: list */}
        <GlassCard title="Conversas" subtitle="Fila de atendimento">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="text-gray-500">🔎</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-black/30 border border-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-200 outline-none focus:border-[#f57f17]/30"
              />
            </div>

            {loading ? (
              <div className="text-gray-400 text-sm py-6">
                Carregando conversas...
              </div>
            ) : error ? (
              <div className="text-red-400 text-sm py-6">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="text-gray-400 text-sm py-6">
                Nenhuma conversa encontrada.
              </div>
            ) : (
              <div className="divide-y divide-gray-800/70">
                {filtered.map((c) => {
                  const isActive = selectedId === c.id;
                  const online = onlineMap[c.id];

                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={[
                        "w-full text-left px-4 py-4 transition-all",
                        isActive
                          ? "bg-[#f57f17]/10 border border-[#f57f17]/20 rounded-2xl"
                          : "hover:bg-white/5 rounded-2xl",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate">
                            {c.name ? c.name : c.phone}
                          </p>
                          <p className="text-gray-500 text-xs mt-1 truncate">
                            {formatDate(c.updated_at)}
                          </p>
                          {c.last_message ? (
                            <p className="text-gray-400 text-xs mt-2 line-clamp-2">
                              {c.last_message}
                            </p>
                          ) : (
                            <p className="text-gray-600 text-xs mt-2">
                              Sem mensagens ainda
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div
                            className={[
                              "h-2.5 w-2.5 rounded-full",
                              online ? "bg-emerald-400" : "bg-gray-600",
                            ].join(" ")}
                            title={online ? "Ativo" : "Inativo"}
                          />

                          <span
                            className={[
                              "text-[10px] px-2 py-1 rounded-full border",
                              c.status === "open"
                                ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/20"
                                : "bg-gray-500/10 text-gray-300 border-gray-500/20",
                            ].join(" ")}
                          >
                            {c.status === "open" ? "ABERTO" : "FECHADO"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </GlassCard>

        {/* RIGHT: messages */}
        <GlassCard
          title={selected ? selected.name || formatPhone(selected.phone) : "Chat"}
          subtitle={selected ? formatPhone(selected.phone) : "Selecione uma conversa"}
          right={
            selected ? (
              <span className="text-xs text-gray-400">
                {selected.status === "open" ? "Atendimento" : "Histórico"}
              </span>
            ) : (
              <span className="text-xs text-gray-500">—</span>
            )
          }
        >
          {!selected ? (
            <div className="h-[520px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-sm">Selecione uma conversa</p>
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="h-[520px] flex items-center justify-center text-gray-400">
              Carregando mensagens...
            </div>
          ) : errorMessages ? (
            <div className="h-[520px] flex items-center justify-center text-red-400">
              {errorMessages}
            </div>
          ) : messages.length === 0 ? (
            <div className="h-[520px] flex items-center justify-center text-gray-500">
              Sem mensagens nessa conversa.
            </div>
          ) : (
            <div className="h-[520px] overflow-y-auto pr-2 space-y-3">
              {messages.map((m) => {
                const isAgent = m.from === "agent";
                return (
                  <div
                    key={m.id}
                    className={[
                      "max-w-[85%] rounded-2xl px-4 py-3 border",
                      isAgent
                        ? "ml-auto bg-[#f57f17]/10 border-[#f57f17]/20 text-gray-100"
                        : "mr-auto bg-black/40 border-gray-800 text-gray-100",
                    ].join(" ")}
                  >
                    <p className="text-sm leading-relaxed">{m.text}</p>
                    <p className="text-[11px] text-gray-500 mt-2">
                      {formatDate(m.created_at)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
