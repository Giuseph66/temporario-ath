import { calendar_v3, google } from 'googleapis';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { log } from './LogService';

type AuthUser = {
    tenantId: string;
    userId: string;
};

type OAuthState = AuthUser & {
    returnPath: string;
    returnOrigin?: string;
};

type CalendarStatus = {
    connected: boolean;
    status: 'CONNECTED' | 'ERROR' | 'REVOKED' | 'EXPIRED';
    email: string | null;
    scopes: string[];
    connectedAt: string | null;
    revokedAt: string | null;
    message: string | null;
};

type CalendarEventPayload = calendar_v3.Schema$Event;
type FreeBusyPayload = calendar_v3.Params$Resource$Freebusy$Query['requestBody'];

class ControlledCalendarError extends Error {
    statusCode: number;
    userMessage: string;

    constructor(statusCode: number, userMessage: string, detail?: string) {
        super(detail ?? userMessage);
        this.statusCode = statusCode;
        this.userMessage = userMessage;
    }
}

const GOOGLE_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar.events',
];

function sanitizeOrigin(origin?: string): string | undefined {
    if (!origin) return undefined;

    try {
        const parsed = new URL(origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
        return parsed.origin;
    } catch {
        return undefined;
    }
}

function fallbackFrontendOrigin(): string | undefined {
    return sanitizeOrigin(process.env.FRONTEND_URL)
        ?? sanitizeOrigin(process.env.APP_URL)
        ?? sanitizeOrigin(process.env.SERVER_URL?.replace(/:\d+$/, ':5173'));
}

function formatScopes(scopes?: string | string[] | null): string[] {
    if (!scopes) return [];
    if (Array.isArray(scopes)) return scopes;
    return scopes.split(/\s+/).filter(Boolean);
}

function stringifyError(error: unknown): string {
    if (error instanceof ControlledCalendarError) return error.userMessage;
    if (error instanceof Error) return error.message;
    return 'Erro desconhecido';
}

export class GoogleCalendarIntegrationService {
    private createOAuthClient() {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

        const missing = [
            !clientId ? 'GOOGLE_CLIENT_ID' : null,
            !clientSecret ? 'GOOGLE_CLIENT_SECRET' : null,
            !redirectUri ? 'GOOGLE_CALENDAR_REDIRECT_URI' : null,
        ].filter(Boolean);

        if (missing.length > 0) {
            throw new ControlledCalendarError(
                503,
                `Integração Google Calendar não configurada no servidor. Variáveis ausentes: ${missing.join(', ')}.`
            );
        }

        return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }

    private buildRedirectUrl(state: Pick<OAuthState, 'returnOrigin' | 'returnPath'>, result: 'success' | 'error', reason?: string): string {
        const origin = fallbackFrontendOrigin() ?? sanitizeOrigin(state.returnOrigin);
        const target = origin ? new URL(state.returnPath || '/integracoes', origin) : new URL(state.returnPath || '/integracoes', 'http://localhost:5173');
        target.searchParams.set('googleCalendar', result);
        if (reason) target.searchParams.set('reason', reason);
        return origin ? target.toString() : `${target.pathname}${target.search}`;
    }

    buildOAuthErrorRedirect(state: string, reason: string) {
        const oauthState = this.verifyState(state);
        return this.buildRedirectUrl(oauthState, 'error', reason);
    }

    private signState(payload: OAuthState): string {
        return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: '10m' });
    }

    private verifyState(state: string): OAuthState {
        try {
            return jwt.verify(state, process.env.JWT_ACCESS_SECRET!) as OAuthState;
        } catch {
            throw new ControlledCalendarError(400, 'Estado OAuth inválido ou expirado.');
        }
    }

    private sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
        return Object.fromEntries(
            Object.entries(data).filter(([key]) => !['accessToken', 'refreshToken', 'clientSecret', 'code'].includes(key))
        );
    }

    private async getIntegrationRecord(authUser: AuthUser) {
        return prisma.userGoogleCalendarIntegration.findUnique({
            where: { tenantUserId: authUser.userId },
        });
    }

    async generateAuthUrl(authUser: AuthUser, origin?: string) {
        const oauth2Client = this.createOAuthClient();
        const state = this.signState({
            tenantId: authUser.tenantId,
            userId: authUser.userId,
            returnPath: '/integracoes',
            returnOrigin: sanitizeOrigin(origin),
        });

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            response_type: 'code',
            scope: GOOGLE_SCOPES,
            state,
        });

        return { url };
    }

    async handleOAuthCallback(code: string, state: string) {
        const oauthState = this.verifyState(state);
        const oauth2Client = this.createOAuthClient();

        try {
            const tokenResponse = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokenResponse.tokens);

            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const me = await oauth2.userinfo.get();
            const googleEmail = me.data.email ?? null;
            const scopes = formatScopes(tokenResponse.tokens.scope);

            await prisma.userGoogleCalendarIntegration.upsert({
                where: { tenantUserId: oauthState.userId },
                create: {
                    tenantUserId: oauthState.userId,
                    tenantId: oauthState.tenantId,
                    googleEmail,
                    accessToken: tokenResponse.tokens.access_token ?? null,
                    refreshToken: tokenResponse.tokens.refresh_token ?? null,
                    expiresAt: tokenResponse.tokens.expiry_date ? new Date(tokenResponse.tokens.expiry_date) : null,
                    scopes,
                    status: 'CONNECTED',
                    lastError: null,
                    connectedAt: new Date(),
                    revokedAt: null,
                },
                update: {
                    tenantId: oauthState.tenantId,
                    googleEmail,
                    accessToken: tokenResponse.tokens.access_token ?? null,
                    refreshToken: tokenResponse.tokens.refresh_token ?? undefined,
                    expiresAt: tokenResponse.tokens.expiry_date ? new Date(tokenResponse.tokens.expiry_date) : null,
                    scopes,
                    status: 'CONNECTED',
                    lastError: null,
                    connectedAt: new Date(),
                    revokedAt: null,
                },
            });

            log.auth('info', 'Google Calendar conectado', { tenantId: oauthState.tenantId, userId: oauthState.userId });
            return { redirectUrl: this.buildRedirectUrl(oauthState, 'success') };
        } catch (error) {
            log.auth('error', 'Falha no callback Google Calendar', this.sanitizeLogData({
                tenantId: oauthState.tenantId,
                userId: oauthState.userId,
                error: stringifyError(error),
            }));

            await prisma.userGoogleCalendarIntegration.upsert({
                where: { tenantUserId: oauthState.userId },
                create: {
                    tenantUserId: oauthState.userId,
                    tenantId: oauthState.tenantId,
                    status: 'ERROR',
                    lastError: 'Erro ao trocar code por tokens.',
                },
                update: {
                    status: 'ERROR',
                    lastError: 'Erro ao trocar code por tokens.',
                },
            });

            return { redirectUrl: this.buildRedirectUrl(oauthState, 'error', 'token_exchange_failed') };
        }
    }

    async getStatus(authUser: AuthUser): Promise<CalendarStatus> {
        const integration = await this.getIntegrationRecord(authUser);
        if (!integration) {
            return {
                connected: false,
                status: 'REVOKED',
                email: null,
                scopes: [],
                connectedAt: null,
                revokedAt: null,
                message: 'Google Calendar ainda não conectado.',
            };
        }

        const expiredWithoutRefresh = integration.status === 'CONNECTED'
            && !!integration.expiresAt
            && integration.expiresAt.getTime() <= Date.now()
            && !integration.refreshToken;

        if (expiredWithoutRefresh) {
            await prisma.userGoogleCalendarIntegration.update({
                where: { tenantUserId: authUser.userId },
                data: {
                    status: 'EXPIRED',
                    lastError: 'Token expirado e sem refresh token disponível.',
                },
            });
            integration.status = 'EXPIRED';
            integration.lastError = 'Token expirado e sem refresh token disponível.';
        }

        const connected = integration.status === 'CONNECTED' && !integration.revokedAt;
        const defaultMessageMap: Record<CalendarStatus['status'], string> = {
            CONNECTED: 'Conta Google conectada e pronta para sincronização.',
            ERROR: integration.lastError ?? 'Não foi possível validar a conexão com Google Calendar.',
            REVOKED: 'Integração desconectada.',
            EXPIRED: integration.lastError ?? 'Token expirado e pendente de renovação.',
        };

        return {
            connected,
            status: integration.status as CalendarStatus['status'],
            email: integration.googleEmail ?? null,
            scopes: Array.isArray(integration.scopes) ? (integration.scopes as string[]) : [],
            connectedAt: integration.connectedAt?.toISOString() ?? null,
            revokedAt: integration.revokedAt?.toISOString() ?? null,
            message: defaultMessageMap[integration.status as CalendarStatus['status']],
        };
    }

    async disconnect(authUser: AuthUser) {
        const integration = await this.getIntegrationRecord(authUser);
        if (!integration) {
            throw new ControlledCalendarError(404, 'Integração Google Calendar não encontrada.');
        }

        try {
            const oauth2Client = this.createOAuthClient();
            const tokenToRevoke = integration.refreshToken || integration.accessToken;
            if (tokenToRevoke) {
                await oauth2Client.revokeToken(tokenToRevoke);
            }
        } catch (error) {
            log.auth('warn', 'Falha ao revogar token Google Calendar', this.sanitizeLogData({
                tenantId: authUser.tenantId,
                userId: authUser.userId,
                error: stringifyError(error),
            }));
        }

        await prisma.userGoogleCalendarIntegration.update({
            where: { tenantUserId: authUser.userId },
            data: {
                status: 'REVOKED',
                lastError: null,
                revokedAt: new Date(),
                accessToken: null,
                refreshToken: null,
                expiresAt: null,
            },
        });

        return { ok: true };
    }

    async refreshAccessToken(integration: NonNullable<Awaited<ReturnType<GoogleCalendarIntegrationService['getIntegrationRecord']>>>) {
        if (!integration.refreshToken) {
            await prisma.userGoogleCalendarIntegration.update({
                where: { tenantUserId: integration.tenantUserId },
                data: {
                    status: 'EXPIRED',
                    lastError: 'Refresh token ausente.',
                },
            });
            throw new ControlledCalendarError(401, 'Token expirado e não renovável.');
        }

        const oauth2Client = this.createOAuthClient();
        oauth2Client.setCredentials({ refresh_token: integration.refreshToken });

        try {
            const refreshed = await oauth2Client.refreshAccessToken();
            const credentials = refreshed.credentials;

            await prisma.userGoogleCalendarIntegration.update({
                where: { tenantUserId: integration.tenantUserId },
                data: {
                    accessToken: credentials.access_token ?? null,
                    refreshToken: credentials.refresh_token ?? integration.refreshToken,
                    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
                    scopes: formatScopes(credentials.scope),
                    status: 'CONNECTED',
                    lastError: null,
                },
            });

            if (!credentials.access_token) {
                throw new ControlledCalendarError(401, 'Falha ao renovar o token de acesso.');
            }

            return credentials.access_token;
        } catch (error) {
            await prisma.userGoogleCalendarIntegration.update({
                where: { tenantUserId: integration.tenantUserId },
                data: {
                    status: 'ERROR',
                    lastError: 'Não foi possível renovar o token Google Calendar.',
                },
            });
            throw new ControlledCalendarError(401, 'Não foi possível renovar o token Google Calendar.', stringifyError(error));
        }
    }

    async getValidAccessToken(authUser: AuthUser) {
        const integration = await this.getIntegrationRecord(authUser);
        if (!integration || integration.status === 'REVOKED') {
            throw new ControlledCalendarError(404, 'Integração Google Calendar não encontrada.');
        }

        if (!integration.accessToken) {
            return this.refreshAccessToken(integration);
        }

        const expiresAtMs = integration.expiresAt?.getTime() ?? 0;
        const shouldRefresh = !expiresAtMs || expiresAtMs <= Date.now() + 60_000;
        if (!shouldRefresh) {
            return integration.accessToken;
        }

        return this.refreshAccessToken(integration);
    }

    private async getCalendarClient(authUser: AuthUser) {
        const accessToken = await this.getValidAccessToken(authUser);
        const oauth2Client = this.createOAuthClient();
        oauth2Client.setCredentials({ access_token: accessToken });
        return google.calendar({ version: 'v3', auth: oauth2Client });
    }

    async listEvents(authUser: AuthUser, params: calendar_v3.Params$Resource$Events$List = {}) {
        const calendar = await this.getCalendarClient(authUser);
        const response = await calendar.events.list({
            calendarId: 'primary',
            ...params,
        });
        return response.data;
    }

    async createEvent(authUser: AuthUser, eventData: CalendarEventPayload) {
        const calendar = await this.getCalendarClient(authUser);
        const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: eventData,
        });
        return response.data;
    }

    async updateEvent(authUser: AuthUser, googleEventId: string, eventData: CalendarEventPayload) {
        const calendar = await this.getCalendarClient(authUser);
        const response = await calendar.events.patch({
            calendarId: 'primary',
            eventId: googleEventId,
            requestBody: eventData,
        });
        return response.data;
    }

    async deleteEvent(authUser: AuthUser, googleEventId: string) {
        const calendar = await this.getCalendarClient(authUser);
        await calendar.events.delete({
            calendarId: 'primary',
            eventId: googleEventId,
        });
        return { ok: true };
    }

    async checkFreeBusy(authUser: AuthUser, requestBody: FreeBusyPayload) {
        const calendar = await this.getCalendarClient(authUser);
        const response = await calendar.freebusy.query({
            requestBody: {
                ...requestBody,
                items: [{ id: 'primary' }],
            },
        });
        return response.data;
    }

    async testConnection(authUser: AuthUser) {
        try {
            const calendar = await this.getCalendarClient(authUser);
            await calendar.calendarList.list();
            return { ok: true };
        } catch (error) {
            log.auth('warn', 'Teste Google Calendar falhou', this.sanitizeLogData({
                tenantId: authUser.tenantId,
                userId: authUser.userId,
                error: stringifyError(error),
            }));
            return { ok: false, error: 'Não foi possível validar a conexão' };
        }
    }

    getErrorResponse(error: unknown) {
        if (error instanceof ControlledCalendarError) {
            return { statusCode: error.statusCode, body: { error: error.userMessage } };
        }

        return {
            statusCode: 500,
            body: { error: 'Erro interno ao processar integração Google Calendar.' },
        };
    }
}

export const googleCalendarIntegrationService = new GoogleCalendarIntegrationService();
