// src/pages/ConversationsPage.tsx
import { useEffect, useMemo, useState } from "react";
import GlassCard from "../components/GlassCard";
import { isDemoMode, getDemoData } from "../mock";
import {
  Smile,
  Meh,
  Frown,
  AlertTriangle,
  Zap,
  DollarSign,
  HelpCircle,
  Target,
  ThermometerSun,
  Search,
  MessageSquare,
} from "lucide-react";

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
  paused_until?: string | null;
  chat_id?: string;
};

function normalizeConversation(raw: any): ApiConversation {
  const status = raw.status === "closed" ? "closed" : "open";
  return { ...raw, status };
}

type ApiMessage = {
  id: string;
  conversation_id: string;
  from: "lead" | "agent";
  text: string;
  created_at: string;
  emotion?: string; // emoção detectada na mensagem
};

function normalizeMessage(raw: any): ApiMessage {
  return {
    id: raw.id,
    conversation_id: raw.conversation_id,
    from: raw.role === "assistant" ? "agent" : raw.from === "agent" ? "agent" : "lead",
    text: raw.content || raw.text || "",
    created_at: raw.created_at || raw.timestamp || "",
    emotion: raw.emotion || raw.detected_emotion || null,
  };
}

type Props = {
  tenantId?: string | null;
  initialSelectedId?: string | null;
};

// API_CONVERSATIONS agora é dinâmica
const API_MESSAGES = "/api/messages?conversation_id=";

// Mapeamento de emoções para visual
const EMOTION_CONFIG: Record<string, { 
  label: string; 
  icon: any; 
  color: string; 
  bgColor: string;
  borderColor: string;
}> = {
  anxious: { 
    label: "Ansioso", 
    icon: AlertTriangle, 
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  skeptical: { 
    label: "Cético", 
    icon: HelpCircle, 
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  frustrated: { 
    label: "Frustrado", 
    icon: Frown, 
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  excited: { 
    label: "Empolgado", 
    icon: Zap, 
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  price_sensitive: { 
    label: "Sensível a Preço", 
    icon: DollarSign, 
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  ready: { 
    label: "Pronto", 
    icon: Target, 
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  curious: { 
    label: "Curioso", 
    icon: ThermometerSun, 
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
  },
  neutral: { 
    label: "Neutro", 
    icon: Meh, 
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
  },
};

function getEmotionConfig(emotion?: string) {
  if (!emotion) return null;
  const key = emotion.toLowerCase().replace(/\s+/g, "_");
  return EMOTION_CONFIG[key] || EMOTION_CONFIG.neutral;
}

function isValidConversation(c: ApiConversation): boolean {
  const phone = c.phone || "";
  if (phone.includes("broadcast")) return false;
  if (phone.startsWith("landing:") || phone.startsWith("web_sess")) return false;
  if (phone.includes("@lid")) {
    const numPart = phone.replace("@lid", "").replace(/\D/g, "");
    if (numPart.length > 14) return false;
  }
  return true;
}

function formatPhone(raw: string) {
  let phone = (raw || "")
    .replace("@c.us", "")
    .replace("@lid", "")
    .replace("@g.us", "")
    .replace(/\D/g, "");
  
  if (!phone) return raw;

  if (phone.startsWith("55") && phone.length >= 12) {
    const ddd = phone.slice(2, 4);
    const part1 = phone.slice(4, 9);
    const part2 = phone.slice(9, 13);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  if (phone.length >= 10) {
    return `+${phone}`;
  }
  
  return phone || raw;
}

export function formatDate(input?: string | number | Date | null) {
  if (input == null || input === "") return "—";

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? "—" : input.toLocaleString("pt-BR");
  }

  if (typeof input === "number") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
  }

  if (typeof input !== "string") return "—";

  const normalized = input
    .trim()
    .replace(" ", "T")
    .replace(/\+00:00$/, "Z")
    .replace(/(\.\d{3})\d+Z$/, "$1Z");

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
    throw new Error(`Endpoint retornou HTML. URL: ${url}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} em ${url}. ${text}`);
  }

  return (await res.json()) as T;
}

export default function ConversationsPage({ initialSelectedId, tenantId }: Props) {
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

  // Load conversations
  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        if (demoMode && demo) {
          const convs = [...demo.conversations].sort((a, b) =>
            a.updated_at > b.updated_at ? -1 : 1
          );
          if (!mounted) return;
          setConversations(convs as any);
          return;
        }

        const apiUrl = tenantId ? `/api/conversations?limit=200&tenant_id=${tenantId}` : "/api/conversations?limit=200";
        const raw = await fetchJson<any[]>(apiUrl);
        if (!mounted) return;
        setConversations((raw || []).map(normalizeConversation));
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Erro ao carregar conversas");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    run();
    return () => { mounted = false; };
  }, [demoMode, demo, tenantId]);

  // Auto-select
  useEffect(() => {
    if (!initialSelectedId) return;
    const exists = conversations.some((c) => c.id === initialSelectedId);
    if (exists) setSelectedId(initialSelectedId);
  }, [initialSelectedId, conversations]);

  // Load messages when selected changes
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    let mounted = true;

    async function run() {
      try {
        setLoadingMessages(true);
        setErrorMessages(null);

        if (demoMode && demo) {
          const msgs = (demo.messages || [])
            .filter((m: any) => m.conversation_id === selectedId)
            .sort((a: any, b: any) => (a.created_at > b.created_at ? 1 : -1));
          if (!mounted) return;
          setMessages(msgs.map(normalizeMessage));
          return;
        }

        const raw = await fetchJson<any[]>(`${API_MESSAGES}${selectedId}`);
        if (!mounted) return;
        setMessages((raw || []).map(normalizeMessage));
      } catch (e: any) {
        if (!mounted) return;
        setErrorMessages(e?.message || "Erro ao carregar mensagens");
      } finally {
        if (!mounted) return;
        setLoadingMessages(false);
      }
    }

    run();
    return () => { mounted = false; };
  }, [selectedId, demoMode, demo]);

  const filtered = useMemo(() => {
    const valid = conversations.filter(isValidConversation);
    if (!query.trim()) return valid;
    const q = query.toLowerCase();
    return valid.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const msg = (c.last_message || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || msg.includes(q);
    });
  }, [conversations, query]);

  const selected = selectedId
    ? conversations.find((c) => c.id === selectedId) || null
    : null;

  const onlineMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    const now = Date.now();
    conversations.forEach((c) => {
      const upd = new Date(c.updated_at).getTime();
      map[c.id] = now - upd < 5 * 60 * 1000;
    });
    return map;
  }, [conversations]);

  // Emoção da conversa selecionada
  const selectedEmotion = selected ? getEmotionConfig(selected.current_emotion) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#f57f17]" />
            Conversas
          </h2>
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
              <Search className="w-4 h-4 text-gray-500" />
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
              <div className="divide-y divide-gray-800/70 max-h-[600px] overflow-y-auto">
                {filtered.map((c) => {
                  const isActive = selectedId === c.id;
                  const online = onlineMap[c.id];
                  const emotionCfg = getEmotionConfig(c.current_emotion);

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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-semibold truncate">
                              {c.name || formatPhone(c.phone)}
                            </p>
                            {/* Badge de emoção na lista */}
                            {emotionCfg && (
                              <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${emotionCfg.bgColor} ${emotionCfg.color} border ${emotionCfg.borderColor}`}>
                                <emotionCfg.icon className="w-3 h-3" />
                                {emotionCfg.label}
                              </span>
                            )}
                          </div>
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

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
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

                          {(() => {
                            const isPaused = c.paused_until && new Date(c.paused_until) > new Date();
                            return (
                              <span
                                className={[
                                  "text-[10px] px-2 py-1 rounded-full border font-medium",
                                  isPaused
                                    ? "bg-red-500/20 text-red-300 border-red-500/30"
                                    : "bg-[#f57f17]/20 text-[#f57f17] border-[#f57f17]/30",
                                ].join(" ")}
                              >
                                {isPaused ? "BOT OFF" : "BOT ON"}
                              </span>
                            );
                          })()}
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
              <div className="flex items-center gap-3">
                {/* Emoção atual no header */}
                {selectedEmotion && (
                  <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${selectedEmotion.bgColor} ${selectedEmotion.color} border ${selectedEmotion.borderColor}`}>
                    <selectedEmotion.icon className="w-4 h-4" />
                    {selectedEmotion.label}
                  </span>
                )}
                
                <span className="text-xs text-gray-400">
                  {selected.status === "open" ? "Atendimento" : "Histórico"}
                </span>
                
                {(() => {
                  const isPaused = selected.paused_until && new Date(selected.paused_until) > new Date();
                  return (
                    <button
                      onClick={async () => {
                        try {
                          const endpoint = isPaused ? "/api/conversations/resume" : "/api/conversations/pause";
                          const chatId = selected.chat_id || `${selected.phone}@c.us`;
                          const body = isPaused 
                            ? { chatId }
                            : { chatId, ttlMinutes: 1440, by: "dashboard" };
                          
                          const res = await fetch(endpoint, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body),
                          });
                          
                          if (res.ok) {
                            setConversations((prev) =>
                              prev.map((c) =>
                                c.id === selected.id
                                  ? {
                                      ...c,
                                      paused_until: isPaused
                                        ? null
                                        : new Date(Date.now() + 1440 * 60 * 1000).toISOString(),
                                    }
                                  : c
                              )
                            );
                          }
                        } catch (e) {
                          console.error("Erro ao alternar pause:", e);
                        }
                      }}
                      className={[
                        "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                        isPaused
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30"
                          : "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30",
                      ].join(" ")}
                    >
                      {isPaused ? "Reativar Bot" : "Pausar Bot"}
                    </button>
                  );
                })()}
              </div>
            ) : (
              <span className="text-xs text-gray-500">—</span>
            )
          }
        >
          {!selected ? (
            <div className="h-[520px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-600" />
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
              {messages.map((m, idx) => {
                const isAgent = m.from === "agent";
                
                // Para mensagens do lead, usa emoção da mensagem ou da conversa
                const msgEmotion = !isAgent ? getEmotionConfig(m.emotion || selected?.current_emotion) : null;
                
                return (
                  <div
                    key={m.id}
                    className={[
                      "max-w-[85%] rounded-2xl px-4 py-3 border relative",
                      isAgent
                        ? "ml-auto bg-[#f57f17]/10 border-[#f57f17]/20 text-gray-100"
                        : `mr-auto bg-black/40 text-gray-100 ${msgEmotion ? msgEmotion.borderColor : "border-gray-800"}`,
                    ].join(" ")}
                  >
                    {/* Indicador de emoção no balão do lead */}
                    {!isAgent && msgEmotion && (
                      <div className={`absolute -top-2 -left-2 h-6 w-6 rounded-full ${msgEmotion.bgColor} border ${msgEmotion.borderColor} flex items-center justify-center`}>
                        <msgEmotion.icon className={`w-3 h-3 ${msgEmotion.color}`} />
                      </div>
                    )}
                    
                    <p className="text-sm leading-relaxed">{m.text}</p>
                    
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[11px] text-gray-500">
                        {formatDate(m.created_at)}
                      </p>
                      {/* Label de emoção pequeno */}
                      {!isAgent && msgEmotion && (
                        <span className={`text-[10px] ${msgEmotion.color}`}>
                          {msgEmotion.label}
                        </span>
                      )}
                    </div>
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