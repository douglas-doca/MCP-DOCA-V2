import { DateTime } from "luxon";
export function buildCandidateSlots(params) {
    const { timezone, days, durationMinutes, workStartHour = 9, workEndHour = 18, minBufferMinutes = 90, } = params;
    const now = DateTime.now().setZone(timezone).plus({ minutes: minBufferMinutes });
    const slots = [];
    for (let d = 0; d < days; d++) {
        const day = now.plus({ days: d }).startOf("day");
        let cursor = day.set({ hour: workStartHour, minute: 0, second: 0, millisecond: 0 });
        const endDay = day.set({ hour: workEndHour, minute: 0, second: 0, millisecond: 0 });
        while (cursor.plus({ minutes: durationMinutes }) <= endDay) {
            const end = cursor.plus({ minutes: durationMinutes });
            // Só inclui slots futuros (respeitando buffer)
            if (end > now) {
                slots.push({
                    startISO: cursor.toISO(),
                    endISO: end.toISO(),
                });
            }
            // incrementa em blocos de duração (30 em 30)
            cursor = cursor.plus({ minutes: durationMinutes });
        }
    }
    return slots;
}
export function filterBusySlots(candidateSlots, busy) {
    // busy intervals do Google normalmente vem como ISO
    return candidateSlots.filter((slot) => {
        const slotStart = DateTime.fromISO(slot.startISO);
        const slotEnd = DateTime.fromISO(slot.endISO);
        // se conflitar com qualquer busy, remove
        for (const b of busy) {
            const busyStart = DateTime.fromISO(b.start);
            const busyEnd = DateTime.fromISO(b.end);
            const overlaps = slotStart < busyEnd && slotEnd > busyStart;
            if (overlaps)
                return false;
        }
        return true;
    });
}
export function formatSuggestionLabel(startISO, timezone) {
    const dt = DateTime.fromISO(startISO).setZone(timezone);
    const today = DateTime.now().setZone(timezone).startOf("day");
    const tomorrow = today.plus({ days: 1 });
    let prefix = dt.toFormat("dd/LL");
    if (dt.startOf("day").equals(today))
        prefix = "Hoje";
    else if (dt.startOf("day").equals(tomorrow))
        prefix = "Amanhã";
    return `${prefix} ${dt.toFormat("HH:mm")}`;
}
