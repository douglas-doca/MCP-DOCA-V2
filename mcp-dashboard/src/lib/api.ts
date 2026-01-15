// src/lib/api.ts
// API client do Dashboard (HTTP server / webhook)
// ------------------------------------------------

export type Conversation = {
  id: string;
  chat_id: string;
  phone: string;
  lead_id?: string | null;
  status?: string;
  context?: any;
  created_at?: string;
  updated_at?: string;
  last_message_at?: string;
  tenant_id?: string;
  emotion_history?: any[];
  current_emotion?: string;
  emotion_score?: number;
  temperature?: number;
  last_message?: string;
};

export type Lead = {
  id: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  source?: string;
  score?: number;
  status?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  tenant_id?: string;
  emotion_profile?: any;
  health_score?: number;
  stage?: string;
  urgency_level?: string;
  conversion_probability?: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  role?: "user" | "assistant" | "system";
  content?: string;
  timestamp?: string;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  phone?: string;
  specialty?: string;
  active: boolean;
};

export type RawStats = {
  totalLeads: number;
  totalConversations: number;
  totalMessages: number;
  activeConversations: number;
  newLeads: number;
  qualifiedLeads: number;
  conversationsByStatus?: Record<string, number>;
  leadsByStatus?: Record<string, number>;
};

export type DashboardV2Stats = {
  conversations_total?: number;
  leads_total?: number;
  qualified_total?: number;
  avg_response_time_seconds?: number;
  emotions_distribution?: Record<string, number>;
  activity_last_7_days?: Array<{ name: string; value: number }>;
};

export type AgentStatus = {
  enabled: boolean;
  updated_at?: string | null;
  by?: string | null;
};

// ------------------------------------------------
// API URL resolver
// ------------------------------------------------

function resolveBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }

  return "http://localhost:3002/api";
}

const BASE_URL = resolveBaseUrl();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[API] ${res.status} ${url}`, text);
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ------------------------------------------------
// Normalizer: backend -> DashboardV2
// ------------------------------------------------

export function mapStatsToDashboardV2(stats: RawStats | any): DashboardV2Stats {
  if (!stats) return {};

  return {
    conversations_total: stats.totalConversations ?? 0,
    leads_total: stats.totalLeads ?? 0,
    qualified_total: stats.qualifiedLeads ?? 0,
    avg_response_time_seconds: stats.avgResponseTimeSeconds ?? 0,
    emotions_distribution: stats.emotionsDistribution ?? {},
    activity_last_7_days: stats.activityLast7Days ?? [],
  };
}

// ------------------------------------------------
// Endpoints
// ------------------------------------------------

// ✅ CORRIGIDO: Agora aceita tenantId para filtrar por cliente
export async function getStats(tenantId?: string): Promise<DashboardV2Stats> {
  let url = "/stats";
  if (tenantId) url += `?tenant_id=${tenantId}`;
  const raw = await request<RawStats>(url);
  return mapStatsToDashboardV2(raw);
}

export async function getTenants(): Promise<Tenant[]> {
  return request<Tenant[]>("/tenants");
}

export async function getConversations(limit = 50, tenantId?: string): Promise<Conversation[]> {
  let url = `/conversations?limit=${limit}`;
  if (tenantId) url += `&tenant_id=${tenantId}`;
  return request<Conversation[]>(url);
}

export async function getLeads(limit = 50, tenantId?: string): Promise<Lead[]> {
  let url = `/leads?limit=${limit}`;
  if (tenantId) url += `&tenant_id=${tenantId}`;
  return request<Lead[]>(url);
}

export async function getMessages(conversationId: string, limit = 50) {
  return request<Message[]>(
    `/messages?conversation_id=${conversationId}&limit=${limit}`
  );
}

// ------------------------------------------------
// Agent ON/OFF (global) endpoints
// ------------------------------------------------

export async function getAgentStatus(): Promise<AgentStatus> {
  return request<AgentStatus>("/agent/status", { method: "GET" });
}

export async function setAgentStatus(enabled: boolean): Promise<AgentStatus> {
  return request<AgentStatus>("/agent/status", {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

// ------------------------------------------------
// util: debug
// ------------------------------------------------
export function getApiBaseUrl() {
  return BASE_URL;
}