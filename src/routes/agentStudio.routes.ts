import { Router } from "express";
import { supabaseService } from "../services/supabase.service.js";
import { responseAgent } from "../services/response.agent.js";
import { DEFAULT_HUMANIZER_CONFIG } from "../config/agentHumanizer.default.js";

const router = Router();

// Helpers
async function getSetting(key: string) {
  const result: any = await supabaseService.request("GET", "settings", {
    query: `key=eq.${key}&limit=1`,
  });
  return result?.[0] ?? null;
}

async function upsertSetting(key: string, value: any) {
  // tenta buscar; se existe, patch; se não, post
  const existing = await getSetting(key);

  if (existing?.id) {
    const updated: any = await supabaseService.request("PATCH", "settings", {
      query: `id=eq.${existing.id}`,
      body: { value, updated_at: new Date().toISOString() },
    });
    return updated?.[0] ?? null;
  }

  const created: any = await supabaseService.request("POST", "settings", {
    body: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      key,
      value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  return created?.[0] ?? null;
}

// GET config
router.get("/humanizer-config", async (_req, res) => {
  try {
    const setting = await getSetting("agent_humanizer_config");
    const value = setting?.value ?? DEFAULT_HUMANIZER_CONFIG;

    return res.json({
      ok: true,
      key: "agent_humanizer_config",
      value,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "error" });
  }
});

// PUT config
router.put("/humanizer-config", async (req, res) => {
  try {
    const body = req.body;

    // validação leve (pra não explodir)
    if (!body || typeof body !== "object") {
      return res.status(400).json({ ok: false, error: "Invalid JSON body" });
    }

    const saved = await upsertSetting("agent_humanizer_config", body);

    return res.json({
      ok: true,
      saved: saved?.value ?? body,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "error" });
  }
});

// POST simulate
router.post("/simulate", async (req, res) => {
  try {
    const { message, stage, emotion, intention } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ ok: false, error: "message is required" });
    }

    // carrega config do Supabase (para simulação)
    const setting = await getSetting("agent_humanizer_config");
    const cfg = setting?.value ?? DEFAULT_HUMANIZER_CONFIG;

    // aplica config no responseAgent runtime (sem restart)
    responseAgent.config.humanizer = {
      ...responseAgent.config.humanizer,
      ...(cfg.humanizer || {}),
      delay: {
        ...responseAgent.config.humanizer.delay,
        ...(cfg.humanizer?.delay || {}),
      }
    };

    // simulação não chama IA: usa apenas templates/modos do agent (rápido e determinístico)
    // mas você pode mudar para chamar IA se quiser.
    const usedStage = stage || "cold";
    const usedEmotion = emotion || "neutral";
    const usedIntention = intention || "outros";

    // truque: usar o método do agent mas passando aiText = message
    // A "IA" aqui é só um placeholder - em simulação vamos gerar bolhas pela regra.
    const plan = responseAgent.createResponsePlan({
      aiText: message,
      intention: usedIntention,
      emotion: usedEmotion,
      stage: usedStage,
    });

    return res.json({
      ok: true,
      input: { message, stage: usedStage, emotion: usedEmotion, intention: usedIntention },
      plan,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "error" });
  }
});

export default router;
