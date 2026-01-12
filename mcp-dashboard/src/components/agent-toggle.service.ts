// src/services/agent-toggle.service.ts
// ============================================
// MCP-DOCA-V2 - Global Agent ON/OFF toggle
// Persistência via Supabase (tabela "settings")
// Key: "agent_enabled"
// Value: { enabled: boolean, by?: string, updated_at?: string }
// ============================================

import { supabaseService } from "./supabase.service.js";
import { logger } from "../utils/logger.js";

const AGENT_ENABLED_KEY = "agent_enabled";

export type AgentToggleStatus = {
  enabled: boolean;
  updated_at: string | null;
  by?: string | null;
};

type AgentToggleValue = {
  enabled: boolean;
  by?: string;
  updated_at?: string;
};

async function getSettingRow(key: string): Promise<any | null> {
  try {
    const result = await supabaseService.request<any[]>("GET", "settings", {
      query: `key=eq.${key}`,
    });
    if (result && result[0]) return result[0];
    return null;
  } catch (err) {
    logger.error("agent-toggle: failed to read setting", { key, err });
    throw err;
  }
}

/**
 * Upsert e retorna { ok, updated_at } sem precisar fazer GET depois.
 * Observação: dependendo da sua implementação do supabaseService.request,
 * PATCH/POST pode retornar um array com o row inserido/atualizado.
 */
async function upsertSettingRow(
  key: string,
  value: any
): Promise<{ ok: boolean; updated_at: string | null }> {
  const now = new Date().toISOString();

  // tenta achar
  const existing = await supabaseService.request<any[]>("GET", "settings", {
    query: `key=eq.${key}`,
  });

  // atualiza
  if (existing && existing.length > 0) {
    const patched = await supabaseService.request<any>("PATCH", "settings", {
      query: `key=eq.${key}`,
      body: { value, updated_at: now },
    });

    // se o PATCH retornar row(s), tenta extrair updated_at
    const patchedUpdatedAt =
      (Array.isArray(patched) ? patched?.[0]?.updated_at : patched?.updated_at) || now;

    return { ok: !!patched, updated_at: patchedUpdatedAt || now };
  }

  // cria
  const created = await supabaseService.request<any>("POST", "settings", {
    body: {
      key,
      value,
      created_at: now,
      updated_at: now,
    },
  });

  const createdUpdatedAt =
    (Array.isArray(created) ? created?.[0]?.updated_at : created?.updated_at) || now;

  return { ok: !!created, updated_at: createdUpdatedAt || now };
}

/**
 * Retorna status do agente.
 * Default: enabled=true (se não existir chave no DB).
 */
export async function getAgentToggleStatus(): Promise<AgentToggleStatus> {
  const row = await getSettingRow(AGENT_ENABLED_KEY);

  const v: AgentToggleValue | undefined = row?.value;
  const enabledValue = v?.enabled;

  const enabled = typeof enabledValue === "boolean" ? enabledValue : true;

  return {
    enabled,
    updated_at: row?.updated_at || null,
    by: v?.by ?? null,
  };
}

/**
 * Seta status do agente (persistente).
 * by: opcional (ex: "dashboard", "system", nome do admin)
 */
export async function setAgentToggleStatus(
  enabled: boolean,
  by: string = "dashboard"
): Promise<AgentToggleStatus> {
  const now = new Date().toISOString();

  const value: AgentToggleValue = {
    enabled: !!enabled,
    by,
    updated_at: now,
  };

  const { ok, updated_at } = await upsertSettingRow(AGENT_ENABLED_KEY, value);

  if (!ok) {
    throw new Error("Failed to upsert agent_enabled setting");
  }

  logger.info("agent-toggle: updated", {
    key: AGENT_ENABLED_KEY,
    enabled: !!enabled,
    by,
    updated_at,
    tag: "AGENT_TOGGLE",
  });

  return {
    enabled: !!enabled,
    updated_at: updated_at || now,
    by,
  };
}

/**
 * Guard rápido para usar no pipeline do webhook.
 * Fail-safe: se der erro no Supabase, retorna enabled=false (não responde).
 */
export async function isAgentEnabledFailSafe(): Promise<boolean> {
  try {
    const st = await getAgentToggleStatus();
    return !!st.enabled;
  } catch (err) {
    logger.error("agent-toggle: status unavailable, fail-safe OFF", {
      err,
      tag: "AGENT_TOGGLE",
    });
    return false;
  }
}
