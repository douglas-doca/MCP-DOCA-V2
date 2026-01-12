import { Router } from "express";
import { CalendarService } from "../services/calendar/calendar.service";

export function calendarRoutes() {
  const router = Router();
  const calendar = new CalendarService();

  router.get("/calendar/availability", async (req, res) => {
    try {
      const days = req.query.days ? Number(req.query.days) : undefined;
      const duration = req.query.duration ? Number(req.query.duration) : undefined;
      const timezone = req.query.timezone ? String(req.query.timezone) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const data = await calendar.getAvailability({ days, duration, timezone, limit });
      return res.json(data);
    } catch (err: any) {
      console.error("[Calendar availability] error:", err);
      return res.status(500).json({ error: err?.message || "Internal error" });
    }
  });

  router.post("/calendar/schedule", async (req, res) => {
    try {
      const {
        leadName,
        leadPhone,
        leadEmail,
        start,
        duration,
        timezone,
        conversationContext,
        owner,
      } = req.body || {};

      if (!leadPhone || !start) {
        return res.status(400).json({ error: "Campos obrigatórios: leadPhone, start" });
      }

      const data = await calendar.createEvent({
        leadName: leadName || leadPhone,
        leadPhone,
        leadEmail,
        start,
        duration,
        timezone,
        conversationContext,
        owner,
      });

      return res.json(data);
    } catch (err: any) {
      console.error("[Calendar schedule] error:", err);
      return res.status(500).json({ error: err?.message || "Internal error" });
    }
  });

  return router;
}
