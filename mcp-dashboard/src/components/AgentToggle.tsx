import { useEffect, useState } from "react";

type AgentStatus = {
  enabled: boolean;
  updated_at: string | null;
};

function resolveApiBase() {
  const envUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return `${window.location.origin}/api`;
  return "http://localhost:3002/api";
}

const API = resolveApiBase();

async function apiGetStatus(): Promise<AgentStatus> {
  const res = await fetch(`${API}/agent/status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiSetStatus(enabled: boolean): Promise<AgentStatus> {
  const res = await fetch(`${API}/agent/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AgentToggle() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGetStatus().then(setStatus).catch(() => setStatus({ enabled: false, updated_at: null }));
  }, []);

  const toggle = async () => {
    if (!status) return;
    setLoading(true);
    try {
      const next = await apiSetStatus(!status.enabled);
      setStatus(next);
    } finally {
      setLoading(false);
    }
  };

  const enabled = !!status?.enabled;

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={[
        "h-10 px-4 rounded-2xl border transition-all flex items-center gap-2 text-sm font-semibold",
        enabled
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-red-500/30 bg-red-500/10 text-red-200",
        loading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90",
      ].join(" ")}
      title="Liga/desliga o agente globalmente"
    >
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: enabled ? "#34d399" : "#ef4444" }} />
      Agente: {enabled ? "ON" : "OFF"}
    </button>
  );
}
