// src/components/ConversationBotToggle.tsx
import { useMemo, useState } from "react";

function resolveApiBaseUrl() {
  const envUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return `${window.location.origin}/api`;
  return "http://localhost:3002/api";
}

const API_BASE = resolveApiBaseUrl();
const API_PAUSE = `${API_BASE}/conversations/pause`;
const API_RESUME = `${API_BASE}/conversations/resume`;

function toChatId(phoneOrChatId: string) {
  const raw = String(phoneOrChatId || "").trim();
  if (!raw) return raw;
  if (raw.includes("@c.us") || raw.includes("@lid")) return raw;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  return `${digits}@c.us`;
}

async function postJson<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    const text = await res.text();
    throw new Error(`Endpoint retornou HTML. URL: ${url}. Ex: ${text.slice(0, 80)}...`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} em ${url}. ${text}`);
  }
  return (await res.json()) as T;
}

type Props = {
  /** pode ser phone puro, @c.us ou @lid */
  phoneOrChatId: string;
  /** id para estado local (ex: lead.id ou conversation.id) */
  itemKey: string;

  /** se quiser começar OFF visualmente */
  defaultPaused?: boolean;

  /** disable em demo */
  disabled?: boolean;

  /** opcional: estilo compacto */
  compact?: boolean;
};

export default function ConversationBotToggle({
  phoneOrChatId,
  itemKey,
  defaultPaused = false,
  disabled = false,
  compact = true,
}: Props) {
  const [paused, setPaused] = useState<boolean>(defaultPaused);
  const [loading, setLoading] = useState(false);

  const chatId = useMemo(() => toChatId(phoneOrChatId), [phoneOrChatId]);

  async function toggle() {
    if (!chatId || disabled) return;

    try {
      setLoading(true);
      if (!paused) {
        await postJson(API_PAUSE, { chatId, ttlMinutes: 24 * 60, by: "dashboard" });
        setPaused(true);
      } else {
        await postJson(API_RESUME, { chatId });
        setPaused(false);
      }
    } catch (e: any) {
      alert(e?.message || "Falha ao alternar bot");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      key={itemKey}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      disabled={disabled || loading || !chatId}
      className={[
        "rounded-full border transition-all font-semibold",
        compact ? "text-[10px] px-2 py-1" : "text-xs px-3 py-1.5",
        paused
          ? "bg-gray-500/10 text-gray-300 border-gray-500/20 hover:bg-white/5"
          : "bg-[#f57f17]/10 text-[#f57f17] border-[#f57f17]/20 hover:bg-[#f57f17]/15",
        disabled || loading || !chatId ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
      title={paused ? "Bot pausado (handoff)" : "Bot ativo"}
    >
      {loading ? "..." : paused ? "BOT OFF" : "BOT ON"}
    </button>
  );
}
