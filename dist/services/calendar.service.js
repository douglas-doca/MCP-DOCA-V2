import { google } from 'googleapis';
import * as fs from 'fs';
import { logger } from '../utils/logger.js';

const CREDENTIALS_PATH = './google-credentials.json';
const TOKEN_PATH = './google-token.json';

class CalendarService {
    calendar = null;
    calendarId = 'primary';

    constructor() {
        this.init();
    }

    init() {
        try {
            const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
            const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
            
            const { client_id, client_secret, redirect_uris } = credentials.installed;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            oAuth2Client.setCredentials(token);
            
            this.calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
            logger.info('Calendar Service initialized', undefined, 'CALENDAR');
        } catch (error) {
            logger.error('Failed to initialize Calendar Service', error, 'CALENDAR');
        }
    }

    async getAvailableSlots(daysAhead = 7) {
        if (!this.calendar) return [];
        
        try {
            const now = new Date();
            const endDate = new Date();
            endDate.setDate(now.getDate() + daysAhead);

            // Buscar eventos existentes
            const response = await this.calendar.events.list({
                calendarId: this.calendarId,
                timeMin: now.toISOString(),
                timeMax: endDate.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });

            const busySlots = response.data.items || [];
            
            // Gerar slots disponíveis (9h-18h, seg-sex)
            const availableSlots = [];
            const current = new Date(now);
            current.setHours(9, 0, 0, 0);
            
            if (current < now) {
                current.setDate(current.getDate() + 1);
            }

            while (current < endDate && availableSlots.length < 10) {
                const dayOfWeek = current.getDay();
                
                // Pular fins de semana
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    current.setDate(current.getDate() + 1);
                    current.setHours(9, 0, 0, 0);
                    continue;
                }

                const slotEnd = new Date(current);
                slotEnd.setMinutes(slotEnd.getMinutes() + 30);

                // Verificar se o slot está livre
                const isBusy = busySlots.some(event => {
                    const eventStart = new Date(event.start.dateTime || event.start.date);
                    const eventEnd = new Date(event.end.dateTime || event.end.date);
                    return current < eventEnd && slotEnd > eventStart;
                });

                if (!isBusy && current > now) {
                    availableSlots.push({
                        start: new Date(current),
                        end: new Date(slotEnd),
                        formatted: this.formatSlot(current)
                    });
                }

                // Próximo slot
                current.setMinutes(current.getMinutes() + 30);
                
                // Se passou das 18h, vai pro próximo dia
                if (current.getHours() >= 18) {
                    current.setDate(current.getDate() + 1);
                    current.setHours(9, 0, 0, 0);
                }
            }

            logger.info('Available slots found', { count: availableSlots.length }, 'CALENDAR');
            return availableSlots;
        } catch (error) {
            logger.error('Error getting available slots', error, 'CALENDAR');
            return [];
        }
    }

    formatSlot(date) {
        const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const dia = dias[date.getDay()];
        const dataStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const hora = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `${dia} (${dataStr}) às ${hora}`;
    }

    async createEvent(summary, description, startTime, endTime, attendeeEmail) {
        if (!this.calendar) return null;
        
        try {
            const event = {
                summary: summary || 'Reunião DOCA - Apresentação',
                description: description || 'Reunião de apresentação dos serviços da DOCA Agência IA',
                start: {
                    dateTime: startTime.toISOString(),
                    timeZone: 'America/Sao_Paulo',
                },
                end: {
                    dateTime: endTime.toISOString(),
                    timeZone: 'America/Sao_Paulo',
                },
                conferenceData: {
                    createRequest: {
                        requestId: `doca-${Date.now()}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                }
            };

            if (attendeeEmail) {
                event.attendees = [{ email: attendeeEmail }];
            }

            const response = await this.calendar.events.insert({
                calendarId: this.calendarId,
                resource: event,
                conferenceDataVersion: 1,
                sendUpdates: attendeeEmail ? 'all' : 'none',
            });

            logger.info('Event created', { 
                eventId: response.data.id,
                meetLink: response.data.hangoutLink 
            }, 'CALENDAR');

            return {
                id: response.data.id,
                htmlLink: response.data.htmlLink,
                meetLink: response.data.hangoutLink,
                start: response.data.start,
                end: response.data.end
            };
        } catch (error) {
            logger.error('Error creating event', error, 'CALENDAR');
            return null;
        }
    }

    async getSuggestedSlots() {
        const slots = await this.getAvailableSlots(7);
        if (slots.length === 0) return 'Sem horários disponíveis no momento.';
        
        const suggestions = slots.slice(0, 5).map((s, i) => `${i + 1}. ${s.formatted}`).join('\n');
        return suggestions;
    }
}

export const calendarService = new CalendarService();
