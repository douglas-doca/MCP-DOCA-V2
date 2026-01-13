// src/services/calendar/calendar.orchestrator.ts
// ============================================
// Calendar Orchestrator (PRO)
// - Sugere horários sem parecer menu
// - Mantém estado em conversation.context.calendar
// - Confirma antes de agendar (evita "roubar" respostas)
// - Agenda evento + Google Meet
// - Atualiza lead (status/stage + meeting info em custom_fields)
// ============================================
import { CalendarService } from "./calendar.service.js";
import { supabaseService } from "../supabase.service.js";
import { logger } from "../../utils/logger.js";
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function normalizeText(s) {
    return String(s || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, ""); // remove acentos
}
function looksLikeYes(text) {
    const t = normalizeText(text);
    return ["sim", "ss", "s", "confirmo", "fechado", "pode", "ok", "beleza", "isso", "claro", "bora"].some((w) => t === w || t.includes(` ${w} `) || t.startsWith(w));
}
function looksLikeNo(text) {
    const t = normalizeText(text);
    return ["nao", "não", "n", "melhor nao", "outro", "outros", "trocar", "nao pode", "não pode"].some((w) => t === w || t.includes(w));
}
function looksLikeEmailOrName(text) {
    const t = String(text || "").trim();
    const isEmail = t.includes("@") && t.includes(".");
    const isName = t.split(/\s+/).filter(Boolean).length >= 2 && !/\d/.test(t);
    return isEmail || isName;
}
export class CalendarOrchestrator {
    calendar = new CalendarService();
    async handle(args) {
        const { phone, userText, stage, intention, leadEmail, leadName } = args;
        const conversation = await supabaseService.getConversationByPhone(phone);
        if (!conversation)
            return { handled: false };
        const context = (conversation.context || {});
        const cal = context?.calendar || null;
        // =====================================================
        // ✅ B) Já existe fluxo de agendamento em andamento
        // =====================================================
        if (cal?.pending && Array.isArray(cal.suggestions) && cal.suggestions.length > 0) {
            const t = normalizeText(userText);
            // ✅ 1) Se estamos esperando confirmação do horário escolhido
            if (cal.awaiting === "confirm" && cal.chosen) {
                // se o lead manda email/nome/contexto -> não trava, deixa o agent seguir
                if (looksLikeEmailOrName(userText)) {
                    context.calendar = { ...cal, pending: false };
                    await supabaseService.updateConversationContext(conversation.id, context);
                    return { handled: false };
                }
                if (looksLikeYes(t)) {
                    const chosen = cal.chosen;
                    const event = await this.calendar.createEvent({
                        leadName: leadName || phone,
                        leadPhone: phone,
                        leadEmail,
                        start: chosen.start,
                        duration: cal.duration,
                        timezone: cal.timezone,
                        conversationContext: `Lead confirmou o horário: ${chosen.label}`,
                        owner: "Douglas",
                        calendarId: cal.calendarId || "primary",
                    });
                    context.calendar = {
                        pending: false,
                        suggestions: [],
                        duration: cal.duration,
                        timezone: cal.timezone,
                        calendarId: cal.calendarId || "primary",
                        step: undefined,
                        offered: [],
                        chosen: null,
                        awaiting: undefined,
                        last_event_id: event.eventId,
                        last_meet_link: event.meetLink,
                        last_meeting_at: chosen.start,
                    };
                    await supabaseService.updateConversationContext(conversation.id, context);
                    try {
                        const lead = await supabaseService.getLeadByPhone(phone);
                        if (lead?.id) {
                            await supabaseService.updateLead(lead.id, {
                                status: "qualified",
                                stage: "scheduled",
                                customFields: {
                                    ...(lead.customFields || {}),
                                    meeting_booked: true,
                                    meeting_at: chosen.start,
                                    meeting_end: chosen.end,
                                    meeting_label: chosen.label,
                                    meeting_timezone: cal.timezone,
                                    meeting_duration: cal.duration,
                                    meet_link: event.meetLink,
                                    calendar_event_id: event.eventId,
                                    calendar_html_link: event.htmlLink,
                                    calendar_id: cal.calendarId || "primary",
                                    owner: "Douglas",
                                },
                            });
                            logger.info("Lead updated after scheduling", { phone, leadId: lead.id, eventId: event.eventId }, "CALENDAR");
                        }
                    }
                    catch (err) {
                        logger.error("Failed updating lead after scheduling (ignored)", err, "CALENDAR");
                    }
                    const doneIntro = pickRandom([
                        "Fechado ✅ Tá agendado!",
                        "Boa ✅ Já deixei marcado!",
                        "Perfeito ✅ Confirmado aqui!",
                    ]);
                    const meetLine = event.meetLink ? `🎥 *Google Meet:* ${event.meetLink}\n\n` : "";
                    return {
                        handled: true,
                        reply: `${doneIntro}\n` +
                            `📅 *Horário:* ${chosen.label}\n` +
                            meetLine +
                            `Se quiser, me diga seu e-mail que eu adiciono como convidado 🙂`,
                    };
                }
                if (looksLikeNo(t)) {
                    // Volta para escolha, oferecendo novos horários
                    const next = this.pickNextSlots(cal.suggestions, cal.offered || [], 2);
                    context.calendar = {
                        ...cal,
                        step: "offered",
                        offered: next,
                        chosen: null,
                        awaiting: "choice",
                    };
                    await supabaseService.updateConversationContext(conversation.id, context);
                    const intro = pickRandom([
                        "Tranquilo 🙂 tenho mais duas opções aqui:",
                        "Sem problema! Olha outras duas opções:",
                        "Beleza — te passo mais dois horários:",
                    ]);
                    return {
                        handled: true,
                        reply: `${intro}\n\n` +
                            next.map((s, i) => `*${i + 1})* ${s.label}`).join("\n") +
                            `\n\nQual fica melhor? (pode responder 1/2 ou o horário tipo “10h”)`,
                    };
                }
                // Se a pessoa manda qualquer coisa estranha aqui: pede confirmação de novo
                const retry = pickRandom([
                    `Só pra confirmar rapidinho: fechamos em *${cal.chosen.label}*?`,
                    `Perfeito — confirma pra mim: *${cal.chosen.label}* pode ser?`,
                    `Só confirma: *${cal.chosen.label}* tá ok?`,
                ]);
                return { handled: true, reply: `${retry}\n\n(responde "sim" ou "não")` };
            }
            // ✅ 2) Se estamos esperando escolha (sem confirmar ainda)
            if (cal.awaiting === "choice") {
                const pool = (cal.offered && cal.offered.length > 0) ? cal.offered : cal.suggestions;
                const chosen = this.pickSlotFromText(userText, pool);
                // Se não entendeu e parece qualificação/email/nome → libera para o Agent seguir
                if (!chosen) {
                    const looksLikeQualification = [
                        "vendas",
                        "marketing",
                        "atendimento",
                        "suporte",
                        "clinica",
                        "empresa",
                        "imobiliaria",
                        "restaurante",
                    ].some((k) => t.includes(k));
                    if (looksLikeQualification || looksLikeEmailOrName(userText)) {
                        context.calendar = { ...cal, pending: false };
                        await supabaseService.updateConversationContext(conversation.id, context);
                        return { handled: false };
                    }
                    const retryIntro = pickRandom([
                        "Boa! Só escolhe um desses pra eu reservar 😊",
                        "Perfeito — me diz qual você quer 🙂",
                        "Show! Só confirma qual fica melhor 👇",
                    ]);
                    return {
                        handled: true,
                        reply: `${retryIntro}\n\n` +
                            pool.map((s, i) => `*${i + 1})* ${s.label}`).join("\n") +
                            `\n\n(pode responder 1/2 ou o horário tipo “10h”)`,
                    };
                }
                // Guardar escolhido e pedir confirmação (não agenda ainda)
                context.calendar = {
                    ...cal,
                    step: "confirming",
                    chosen,
                    awaiting: "confirm",
                };
                await supabaseService.updateConversationContext(conversation.id, context);
                const confirm = pickRandom([
                    `Fechou! Posso marcar *${chosen.label}*?`,
                    `Boa — confirma pra mim: *${chosen.label}* pode ser?`,
                    `Perfeito. Reservo *${chosen.label}*?`,
                ]);
                return { handled: true, reply: `${confirm}\n\n(responde "sim" ou "não")` };
            }
            // ✅ fallback de segurança (se state ficou incompleto)
            context.calendar = { ...cal, awaiting: "choice", step: "offered" };
            await supabaseService.updateConversationContext(conversation.id, context);
            return { handled: false };
        }
        // =====================================================
        // ✅ A) Detecção para iniciar oferta de slots
        // =====================================================
        const intent = normalizeText(intention);
        const msg = normalizeText(userText);
        // ✅ PRO: só oferece agenda quando for realmente agendamento
        const shouldOffer = stage === "hot" ||
            intent === "agendamento" ||
            [
                "agendar",
                "marcar",
                "reuni",
                "agenda",
                "horario",
                "disponibilidade",
                "quando pode",
                "quando da",
                "pode amanha",
                "pode hoje",
                "pode essa semana",
                "tem horario",
                "vamos marcar",
            ].some((k) => msg.includes(k));
        if (shouldOffer) {
            const timezone = "America/Sao_Paulo";
            const calendarId = "primary";
            const availability = await this.calendar.getAvailability({
                days: 2,
                duration: 30,
                limit: 6, // PRO: pega mais pra poder ir oferecendo 2 em 2
                timezone,
                calendarId,
            });
            // oferece só 2 agora
            const offered = availability.suggestions.slice(0, 2);
            context.calendar = {
                pending: true,
                suggestions: availability.suggestions,
                duration: availability.duration,
                timezone: availability.timezone,
                calendarId,
                step: "offered",
                offered,
                chosen: null,
                awaiting: "choice",
            };
            await supabaseService.updateConversationContext(conversation.id, context);
            const intro = pickRandom([
                `Boa 😄 Pra nossa demo de *${availability.duration}min*, tenho esses dois horários livres:`,
                `Perfeito! Separei dois horários rápidos pra nossa demo de *${availability.duration}min*:`,
                `Show! Aqui vão duas opções pra nossa demo de *${availability.duration}min*:`,
            ]);
            const outro = pickRandom([
                `Qual fica melhor pra você? (1/2 ou o horário tipo “10h”)`,
                `Qual você prefere? (1/2 ou “10h”)`,
                `Me diz qual funciona melhor 🙂 (1/2 ou “10h”)`,
            ]);
            return {
                handled: true,
                reply: `${intro}\n\n` +
                    offered.map((s, i) => `*${i + 1})* ${s.label}`).join("\n") +
                    `\n\n${outro}`,
            };
        }
        return { handled: false };
    }
    // =====================================================
    // Helpers
    // =====================================================
    pickNextSlots(all, alreadyOffered, count) {
        const offeredKeys = new Set(alreadyOffered.map((s) => s.start));
        const remaining = all.filter((s) => !offeredKeys.has(s.start));
        return remaining.slice(0, count);
    }
    pickSlotFromText(text, suggestions) {
        const t = normalizeText(text);
        // opção 1/2/3
        const m = t.match(/\b([1-3])\b/);
        if (m) {
            const idx = Number(m[1]) - 1;
            return suggestions[idx] || null;
        }
        // "09:30"
        const hm = t.match(/\b(\d{1,2}:\d{2})\b/);
        if (hm) {
            const hhmm = hm[1];
            const found = suggestions.find((s) => normalizeText(s.label).includes(hhmm));
            if (found)
                return found;
        }
        // "10", "10h", "às 10"
        const hOnly = t.match(/\b(?:as\s+|a\s+|às\s+)?([01]?\d|2[0-3])(?:h\b|\b)/);
        if (hOnly) {
            const hour = Number(hOnly[1]);
            if (!Number.isNaN(hour)) {
                const found = suggestions.find((s) => {
                    const lbl = normalizeText(s.label);
                    return lbl.includes(`${hour}:`) || lbl.includes(`${String(hour).padStart(2, "0")}:`);
                });
                if (found)
                    return found;
            }
        }
        // match parcial pelo label (último recurso)
        const found = suggestions.find((s) => t.includes(normalizeText(s.label)));
        if (found)
            return found;
        return null;
    }
}
// Singleton
export const calendarOrchestrator = new CalendarOrchestrator();
