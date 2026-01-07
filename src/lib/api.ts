// src/lib/api.ts
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "/api";

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function getStats() {
  return api("/stats");
}

export async function getConversations(limit = 50): Promise<Conversation[]> {
  const data = await request<Conversation[]>(`/conversations?limit=${limit}`);

  return (data || []).map((c) => ({
    ...c,
    updated_at: c.updated_at || c.created_at || new Date().toISOString(),
  }));
}

export async function getLeads(limit = 50): Promise<Lead[]> {
  const data = await request<Lead[]>(`/leads?limit=${limit}`);

  return (data || []).map((l) => ({
    ...l,
    updated_at: l.updated_at || l.created_at || new Date().toISOString(),
  }));
}

