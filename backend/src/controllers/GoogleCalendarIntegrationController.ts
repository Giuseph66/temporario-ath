import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { googleCalendarIntegrationService } from '../services/GoogleCalendarIntegrationService';

export async function getGoogleCalendarAuthUrl(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
        const data = await googleCalendarIntegrationService.generateAuthUrl({
            tenantId: req.tenantId,
            userId: req.userId,
        }, origin);
        return res.json(data);
    } catch (error) {
        const handled = googleCalendarIntegrationService.getErrorResponse(error);
        return res.status(handled.statusCode).json(handled.body);
    }
}

export async function handleGoogleCalendarCallback(req: AuthRequest, res: Response): Promise<void> {
    try {
        const code = typeof req.query.code === 'string' ? req.query.code : undefined;
        const state = typeof req.query.state === 'string' ? req.query.state : undefined;
        const oauthError = typeof req.query.error === 'string' ? req.query.error : undefined;

        if (oauthError && state) {
            res.redirect(googleCalendarIntegrationService.buildOAuthErrorRedirect(state, oauthError));
            return;
        }

        if (!code || !state) {
            res.status(400).json({ error: 'Code OAuth ou state ausente.' });
            return;
        }

        const result = await googleCalendarIntegrationService.handleOAuthCallback(code, state);
        res.redirect(result.redirectUrl);
        return;
    } catch (error) {
        const handled = googleCalendarIntegrationService.getErrorResponse(error);
        res.status(handled.statusCode).json(handled.body);
        return;
    }
}

export async function getGoogleCalendarStatus(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const status = await googleCalendarIntegrationService.getStatus({
            tenantId: req.tenantId,
            userId: req.userId,
        });
        return res.json(status);
    } catch (error) {
        const handled = googleCalendarIntegrationService.getErrorResponse(error);
        return res.status(handled.statusCode).json(handled.body);
    }
}

export async function disconnectGoogleCalendar(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const result = await googleCalendarIntegrationService.disconnect({
            tenantId: req.tenantId,
            userId: req.userId,
        });
        return res.json(result);
    } catch (error) {
        const handled = googleCalendarIntegrationService.getErrorResponse(error);
        return res.status(handled.statusCode).json(handled.body);
    }
}

export async function testGoogleCalendar(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const result = await googleCalendarIntegrationService.testConnection({
            tenantId: req.tenantId,
            userId: req.userId,
        });
        return res.json(result);
    } catch (error) {
        const handled = googleCalendarIntegrationService.getErrorResponse(error);
        return res.status(handled.statusCode).json(handled.body);
    }
}
