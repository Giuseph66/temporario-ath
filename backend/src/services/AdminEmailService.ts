import nodemailer from 'nodemailer';

type NullableString = string | null;

export type SmtpConfig = {
    host: NullableString;
    port: number | null;
    secure: boolean;
    user: NullableString;
    pass: NullableString;
    fromName: NullableString;
    fromEmail: NullableString;
    replyTo: NullableString;
};

export type SendSmtpInput = {
    config: SmtpConfig;
    to: string[];
    subject: string;
    html: string;
    text?: string | null;
};

function requireConfigured(config: SmtpConfig): void {
    const missing: string[] = [];
    if (!config.host) missing.push('smtpHost');
    if (!config.port) missing.push('smtpPort');
    if (!config.user) missing.push('smtpUser');
    if (!config.pass) missing.push('smtpPass');
    if (!config.fromEmail) missing.push('smtpFromEmail');

    if (missing.length > 0) {
        throw new Error(`SMTP_NOT_CONFIGURED:${missing.join(',')}`);
    }
}

function formatFrom(config: SmtpConfig): string {
    if (!config.fromEmail) return '';
    if (!config.fromName) return config.fromEmail;
    const escaped = config.fromName.replace(/"/g, '\\"');
    return `"${escaped}" <${config.fromEmail}>`;
}

function normalizeRecipients(to: string[]): string[] {
    const unique = Array.from(new Set(to.map(v => v.trim().toLowerCase()).filter(Boolean)));
    if (unique.length === 0) throw new Error('EMAIL_RECIPIENT_REQUIRED');
    return unique;
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_\-.]+)\s*\}\}/g, (_, key: string) => {
        return variables[key] ?? '';
    });
}

export async function sendSmtpMail(input: SendSmtpInput): Promise<{ messageId: string; accepted: string[]; rejected: string[] }> {
    requireConfigured(input.config);

    const recipients = normalizeRecipients(input.to);

    const transport = nodemailer.createTransport({
        host: input.config.host!,
        port: input.config.port!,
        secure: input.config.secure,
        auth: {
            user: input.config.user!,
            pass: input.config.pass!,
        },
    });

    const result = await transport.sendMail({
        from: formatFrom(input.config),
        to: recipients,
        replyTo: input.config.replyTo || undefined,
        subject: input.subject,
        html: input.html,
        text: input.text || undefined,
    });

    return {
        messageId: result.messageId,
        accepted: result.accepted.map(v => String(v)),
        rejected: result.rejected.map(v => String(v)),
    };
}
