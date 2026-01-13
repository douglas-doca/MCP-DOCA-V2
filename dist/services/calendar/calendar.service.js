// src/services/calendar/calendar.service.ts
import { google } from "googleapis";
import crypto from "crypto";
import { DateTime } from "luxon";
import { getOAuthClient } from "./googleAuth.js";
import { buildCandidateSlots, filterBusySlots, formatSuggestionLabel } from "./availability.js";
function normalizeEmail(email) {
    const e = String(email || "")
        .trim()
        .toLowerCase();
    if (!e)
        return undefined;
    // validação simples (boa o suficiente p/ produção)
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    if (!ok)
        return undefined;
    return e;
}
export class CalendarService {
    calendar = google.calendar("v3");
    /**
     * Retorna sugestões de horários livres (2-3 slots)
     */
    async getAvailability(params) {
        const { days = 2, duration = 30, timezone = "America/Sao_Paulo", limit = 3, calendarId = "primary", } = params;
        const auth = getOAuthClient();
        const startWindow = DateTime.now().setZone(timezone).toISO();
        const endWindow = DateTime.now().setZone(timezone).plus({ days }).toISO();
        // 1) Busca Free/Busy
        const fb = await this.calendar.freebusy.query({
            auth,
            requestBody: {
                timeMin: startWindow,
                timeMax: endWindow,
                timeZone: timezone,
                items: [{ id: calendarId }],
            },
        });
        const busy = fb.data.calendars?.[calendarId]?.busy || [];
        // 2) Gera slots candidatos e filtra ocupados
        const candidates = buildCandidateSlots({
            timezone,
            days,
            durationMinutes: duration,
            workStartHour: 9,
            workEndHour: 18,
            minBufferMinutes: 90,
        });
        const freeSlots = filterBusySlots(candidates, busy);
        const picked = freeSlots.slice(0, limit);
        return {
            timezone,
            duration,
            calendarId,
            suggestions: picked.map((s) => ({
                start: s.startISO,
                end: s.endISO,
                label: formatSuggestionLabel(s.startISO, timezone),
            })),
        };
    }
    /**
     * Cria um evento no Google Calendar + tenta gerar Google Meet
     * ✅ Envia convite ao cliente (sendUpdates)
     */
    async createEvent(params) {
        const { leadName, leadPhone, leadEmail, start, duration = 30, timezone = "America/Sao_Paulo", conversationContext = "", calendarId = "primary", owner = "Douglas", } = params;
        const auth = getOAuthClient();
        const startDT = DateTime.fromISO(start).setZone(timezone);
        if (!startDT.isValid) {
            throw new Error("Start inválido (ISO esperado com timezone).");
        }
        const endDT = startDT.plus({ minutes: duration });
        const safeLeadName = String(leadName || "").trim() || leadPhone;
        const title = `DOCA - Demo ${duration}min - ${safeLeadName}`;
        // requestId precisa ser único para a criação de conferência
        const requestId = typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : crypto.randomBytes(16).toString("hex");
        const normalizedEmail = normalizeEmail(leadEmail);
        const descriptionLines = [
            `Owner: ${owner}`,
            `Lead: ${safeLeadName}`,
            `Telefone: ${leadPhone}`,
            normalizedEmail ? `Email: ${normalizedEmail}` : null,
            "",
            "Contexto da conversa:",
            conversationContext || "(sem contexto)",
        ].filter(Boolean);
        const attendees = normalizedEmail ? [{ email: normalizedEmail }] : undefined;
        // ✅ MUITO IMPORTANTE: só manda convite se tem attendee
        const sendUpdates = attendees ? "all" : undefined;
        const res = await this.calendar.events.insert({
            auth,
            calendarId,
            // ✅ envia e-mail pro convidado (senão ele não recebe)
            ...(sendUpdates ? { sendUpdates } : {}),
            conferenceDataVersion: 1,
            requestBody: {
                summary: title,
                description: descriptionLines.join("\n"),
                start: { dateTime: startDT.toISO(), timeZone: timezone },
                end: { dateTime: endDT.toISO(), timeZone: timezone },
                attendees,
                // Google Meet automático
                conferenceData: {
                    createRequest: {
                        requestId,
                        conferenceSolutionKey: { type: "hangoutsMeet" },
                    },
                },
            },
        });
        const event = res.data;
        const meetLink = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
            event.hangoutLink ||
            null;
        return {
            eventId: event.id || null,
            htmlLink: event.htmlLink || null,
            meetLink,
            start: event.start?.dateTime || null,
            end: event.end?.dateTime || null,
            timezone,
            calendarId,
            // ✅ debug útil pra você enxergar se enviou convite ou não
            invitedEmail: normalizedEmail || null,
            sendUpdates: sendUpdates || null,
        };
    }
}
