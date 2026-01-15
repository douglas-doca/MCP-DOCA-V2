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

  // GET /api/settings?key=...&tenant_id=...
  app.get("/api/settings", async (req, res) => {
    const key = String(req.query.key || "").trim();
    const tenantId = req.query.tenant_id ? String(req.query.tenant_id).trim() : null;
    
    if (!key) return res.status(400).json({ error: "Missing key" });

    // Build query with tenant_id filter
    let query = `key=eq.${encodeURIComponent(key)}`;
    if (tenantId) {
      query += `&tenant_id=eq.${encodeURIComponent(tenantId)}`;
    } else {
      query += `&tenant_id=is.null`;
    }

    const row = await supabaseService.request<any>("GET", "settings", {
      query,
      single: true,
    });

    if (!row) {
      return res.status(200).json({ key, value: null });
    }

    const parsedValue = safeJsonParse(row.value, row.value);

    return res.status(200).json({
      key: row.key,
      value: parsedValue,
      tenant_id: row.tenant_id,
    });
  });

  // POST /api/settings  { key, value, tenant_id }
  app.post("/api/settings", async (req, res) => {
    const key = String(req.body?.key || "").trim();
    const value = req.body?.value;
    const tenantId = req.body?.tenant_id || null;

    if (!key) return res.status(400).json({ error: "Missing key" });

    const data = {
      key,
      value,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // UPSERT - precisa de constraint unique em (key, tenant_id)
    const result = await supabaseService.request<any[]>("POST", "settings", {
      query: "on_conflict=key,tenant_id",
      body: data,
    });

    if (!result) {
      return res.status(500).json({ error: "Failed to save setting" });
    }

    logger.info(`Settings saved: ${key} for tenant ${tenantId}`, undefined, "HTTP");
    return res.status(200).json({ success: true, key, tenant_id: tenantId });
  });

  // =========================================================
  // ✅ DASHBOARD DATA
  // =========================================================

  // GET /api/stats?tenant_id=...
  app.get("/api/stats", async (req, res) => {
    const tenantId = req.query.tenant_id ? String(req.query.tenant_id) : undefined;
    const stats = await supabaseService.getDashboardStats(tenantId);
    return res.status(200).json(stats);
  });

  // GET /api/conversations?limit=50&tenant_id=...
  app.get("/api/conversations", async (req, res) => {
    const limit = Number(req.query.limit || 50);
    const tenantId = req.query.tenant_id ? String(req.query.tenant_id) : undefined;
    const data = await supabaseService.getConversations(limit, tenantId);
    return res.status(200).json(data);
  });

  // GET /api/leads?limit=50&status=qualified&tenant_id=...
  app.get("/api/leads", async (req, res) => {
    const limit = Number(req.query.limit || 50);
    const status = req.query.status ? String(req.query.status) : undefined;
    const tenantId = req.query.tenant_id ? String(req.query.tenant_id) : undefined;
    const data = await supabaseService.getLeads(status, limit, tenantId);
    return res.status(200).json(data);
  });

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
