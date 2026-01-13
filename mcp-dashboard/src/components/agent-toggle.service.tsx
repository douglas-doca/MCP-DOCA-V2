// src/components/agent-toggle.service.tsx
// Frontend-only: chama o backend via HTTP. NÃO importa supabase/logger aqui.

function resolveApiBaseUrl() {
  const envUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return `${window.location.origin}/api`;
  return "http://localhost:3002/api";
}

const API_BASE = resolveApiBaseUrl();

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...(init || {}),
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
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

export async function getAgentStatus() {
  return fetchJson<{ ok: boolean; enabled: boolean; updated_at?: string | null }>(
    `${API_BASE}/agent/status`
  );
}

export async function setAgentStatus(enabled: boolean) {
  return fetchJson<{ ok: boolean; enabled: boolean; updated_at?: string | null }>(
    `${API_BASE}/agent/status`,
    { method: "PUT", body: JSON.stringify({ enabled }) }
  );
}
