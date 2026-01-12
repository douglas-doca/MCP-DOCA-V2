import { supabase } from "./supabase";

export type AgentStatus = {
  enabled: boolean;
  updatedAt?: string;
  updatedBy?: string | null;
};

let cache: { value: AgentStatus; expiresAt: number } | null = null;

export async function getAgentStatus(): Promise<AgentStatus> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const { data, error } = await supabase
    .from("app_settings")
    .select("value, updated_at, updated_by")
    .eq("key", "agent_enabled")
    .single();

  if (error) throw error;

  const status: AgentStatus = {
    enabled: Boolean((data?.value as any)?.enabled ?? true),
    updatedAt: data?.updated_at,
    updatedBy: data?.updated_by,
  };

  cache = { value: status, expiresAt: now + 2000 };
  return status;
}

export async function setAgentStatus(enabled: boolean, updatedBy?: string): Promise<AgentStatus> {
  const { data, error } = await supabase
    .from("app_settings")
    .upsert(
      {
        key: "agent_enabled",
        value: { enabled },
        updated_by: updatedBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
    .select("value, updated_at, updated_by")
    .single();

  if (error) throw error;

  const status: AgentStatus = {
    enabled: Boolean((data?.value as any)?.enabled),
    updatedAt: data?.updated_at,
    updatedBy: data?.updated_by,
  };

  cache = { value: status, expiresAt: Date.now() + 2000 };
  return status;
}
