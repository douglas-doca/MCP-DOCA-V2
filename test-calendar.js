import { calendarService } from './dist/services/calendar.service.js';

async function test() {
    console.log('🔍 Buscando horários disponíveis...\n');
    const slots = await calendarService.getSuggestedSlots();
    console.log('📅 Horários disponíveis:\n');
    console.log(slots);
}

test();
