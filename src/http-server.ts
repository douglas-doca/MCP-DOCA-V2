import express from "express";
import cors from "cors";
import helmet from "helmet";

import { logger } from "./utils/logger.js";
import { supabaseService } from "./services/supabase.js";

const PORT = Number(process.env.PORT || 3001);
const NODE_ENV = process.env.NODE_ENV || "production";

function safeJsonParse<T>(value: any, fallback: T): T {
  try {
    if (value == null) return fallback;
    if (typeof value === "string") return JSON.parse(value);
    return value as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const app = express();

  // ✅ Middleware base
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  // ✅ Logs básicos
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      logger.info(
        `${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`,
        undefined,
        "HTTP"
      );
    });
    next();
  });

  // ✅ Health
  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "mcp-backend",
      env: NODE_ENV,
      ts: new Date().toISOString(),
    });
  });

  // ✅ Sanity
  app.get("/", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "mcp-backend",
      message: "MCP Backend API is running",
    });
  });

  // =========================================================
  // ✅ SETTINGS (compatível com lib/api/settings.ts do dashboard)
  // =========================================================

  // GET /api/settings?key=...
  app.get("/api/settings", async (req, res) => {
    const key = String(req.query.key || "").trim();
    if (!key) return res.status(400).json({ error: "Missing key" });

    // Se você tem uma tabela "settings", vamos usar ela.
    // Caso não exista ainda, você pode criar depois.
    const row = await supabaseService.request<any>("GET", "settings", {
      query: `key=eq.${encodeURIComponent(key)}`,
      single: true,
    });

    if (!row) {
      // compatível com seu dashboard: retorna { key, value: null }
      return res.status(200).json({ key, value: null });
    }

    // row.value pode ser string JSON (se você salvou como string)
    // ou pode ser jsonb no supabase. Vamos suportar os 2.
    const parsedValue = safeJsonParse(row.value, row.value);

    return res.status(200).json({
      key: row.key,
      value: parsedValue,
    });
  });

  // POST /api/settings  { key, value }
  app.post("/api/settings", async (req, res) => {
    const key = String(req.body?.key || "").trim();
    const value = req.body?.value;

    if (!key) return res.status(400).json({ error: "Missing key" });

    // ✅ Decide como salvar:
    // - se for objeto/array -> salvar JSON string OU direto (jsonb).
    // Aqui eu recomendo salvar direto no Supabase como JSONB.
    const data = {
      key,
      value,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // ✅ UPSERT (precisa de constraint unique em settings.key)
    const result = await supabaseService.request<any[]>("POST", "settings", {
      query: "on_conflict=key",
      body: data,
    });

    if (!result) {
      return res.status(500).json({ error: "Failed to save setting" });
    }

    return res.status(200).json({ success: true, key });
  });

  // =========================================================
  // ✅ DASHBOARD DATA
  // =========================================================

  // GET /api/stats
  app.get("/api/stats", async (_req, res) => {
    const stats = await supabaseService.getDashboardStats();
    return res.status(200).json(stats);
  });

  // GET /api/conversations?limit=50
  app.get("/api/conversations", async (req, res) => {
    const limit = Number(req.query.limit || 50);
    const data = await supabaseService.getConversations(limit);
    return res.status(200).json(data);
  });

  // GET /api/leads?limit=50&status=qualified
  app.get("/api/leads", async (req, res) => {
    const limit = Number(req.query.limit || 50);
    const status = req.query.status ? String(req.query.status) : undefined;
    const data = await supabaseService.getLeads(status, limit);
    return res.status(200).json(data);
  });

  // ✅ Messages por conversa (pra você ligar depois no dashboard)
  // GET /api/messages?conversation_id=...&limit=50
  app.get("/api/messages", async (req, res) => {
    const conversationId = String(req.query.conversation_id || "");
    const limit = Number(req.query.limit || 50);

    if (!conversationId)
      return res.status(400).json({ error: "Missing conversation_id" });

    const data = await supabaseService.getMessagesByConversation(
      conversationId,
      limit
    );

    return res.status(200).json(data);
  });

  // =========================================================
  // ✅ Start
  // =========================================================

  await supabaseService.initialize();

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(
      `HTTP API running on http://0.0.0.0:${PORT}`,
      { port: PORT },
      "HTTP"
    );
  });
}

main().catch((err) => {
  logger.error("Failed to start HTTP server", err, "HTTP");
  process.exit(1);
});
