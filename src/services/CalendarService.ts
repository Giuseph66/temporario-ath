import { google } from 'googleapis';
import path from 'path';

const CREDENTIALS_PATH = path.join(process.cwd(), 'config', 'google-credentials.json');

function getCalendarId(): string {
    const id = process.env.GOOGLE_CALENDAR_ID;
    if (!id) throw new Error('GOOGLE_CALENDAR_ID não está definido nas variáveis de ambiente.');
    return id;
}

export class CalendarService {
    private calendar;

    constructor() {
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        this.calendar = google.calendar({ version: 'v3', auth });
    }

    // Function 1: Check availability
    async checkAvailability(timeMin: string, timeMax: string) {
        try {
            const response = await this.calendar.freebusy.query({
                requestBody: {
                    timeMin: new Date(timeMin).toISOString(),
                    timeMax: new Date(timeMax).toISOString(),
                    timeZone: 'America/Cuiaba',
                    items: [{ id: getCalendarId() }]
                }
            });
            const busySlots = response.data.calendars?.[getCalendarId()]?.busy || [];
            return busySlots;
        } catch (error) {
            console.error('Error checking calendar:', error);
            throw new Error('Could not check calendar availability.');
        }
    }

    /**
     * Function 2: Create Appointment
     * @param recurringWeeks - If > 0, creates a weekly recurring event for this many weeks.
     *   Use for semester enrollments (e.g., 24 for a 6-month semester).
     *   Leave undefined or 0 for one-off appointments (trial classes, therapy sessions).
     */
    async createAppointment(summary: string, startTime: string, endTime: string, recurringWeeks?: number) {
        try {
            const event: any = {
                summary,
                start: { dateTime: new Date(startTime).toISOString(), timeZone: 'America/Cuiaba' },
                end: { dateTime: new Date(endTime).toISOString(), timeZone: 'America/Cuiaba' },
            };

            if (recurringWeeks && recurringWeeks > 0) {
                event.recurrence = [`RRULE:FREQ=WEEKLY;COUNT=${recurringWeeks}`];
                console.log(`🔁 [CalendarService] Evento recorrente: ${recurringWeeks} semanas`);
            }

            const response = await this.calendar.events.insert({
                calendarId: getCalendarId(),
                requestBody: event,
            });
            return response.data.htmlLink;
        } catch (error) {
            console.error('Error creating appointment:', error);
            throw new Error('Could not create appointment.');
        }
    }

    /**
     * Function 3: Find Appointments
     * Returns events with their `recurringEventId` so the caller can delete
     * an entire recurring series by passing that ID to cancelAppointment.
     */
    async findAppointments(query: string, timeMin: string, timeMax: string) {
        try {
            const response = await this.calendar.events.list({
                calendarId: getCalendarId(),
                timeMin: new Date(timeMin).toISOString(),
                timeMax: new Date(timeMax).toISOString(),
                q: query || undefined,
                singleEvents: true,
                orderBy: 'startTime',
                timeZone: 'America/Cuiaba',
            });
            const events = response.data.items ?? [];
            return events.map((e: any) => ({
                id: e.id,
                summary: e.summary,
                start: e.start?.dateTime ?? e.start?.date,
                end: e.end?.dateTime ?? e.end?.date,
                recurringEventId: e.recurringEventId ?? null,
            }));
        } catch (error) {
            console.error('Error finding appointments:', error);
            throw new Error('Could not find appointments.');
        }
    }

    /**
     * Function 4: Cancel (delete) Appointment by event ID.
     * - Pass `eventId` (instance ID) to cancel only that single occurrence.
     * - Pass `recurringEventId` (master series ID, returned by findAppointments)
     *   to cancel ALL occurrences of a recurring series at once.
     */
    async cancelAppointment(eventId: string) {
        try {
            await this.calendar.events.delete({
                calendarId: getCalendarId(),
                eventId,
            });
            console.log(`🗑️  [CalendarService] Evento ${eventId} removido.`);
            return { success: true, message: 'Aula(s) cancelada(s) com sucesso.' };
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            throw new Error('Could not cancel appointment.');
        }
    }
}

export const calendarService = new CalendarService();
