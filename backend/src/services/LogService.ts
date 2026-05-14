import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory = 'webhook' | 'ai' | 'payment' | 'auth' | 'system';

export type LogEntry = {
    ts: string;
    level: LogLevel;
    category: LogCategory;
    msg: string;
    data?: Record<string, unknown>;
};

const LOGS_DIR = path.join(process.cwd(), 'logs');
const MAX_LINES = 2000; // por arquivo

function filePath(category: LogCategory): string {
    return path.join(LOGS_DIR, `${category}.log`);
}

export function writeLog(category: LogCategory, level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
        ts: new Date().toISOString(),
        level,
        category,
        msg,
        ...(data ? { data } : {}),
    };
    const line = JSON.stringify(entry) + '\n';

    try {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
        fs.appendFileSync(filePath(category), line, 'utf8');
        rotateIfNeeded(category);
    } catch { /* silently ignore fs errors */ }
}

function rotateIfNeeded(category: LogCategory): void {
    try {
        const fp = filePath(category);
        const content = fs.readFileSync(fp, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        if (lines.length > MAX_LINES) {
            fs.writeFileSync(fp, lines.slice(-MAX_LINES).join('\n') + '\n', 'utf8');
        }
    } catch { /* ignore */ }
}

export function readLogs(category: LogCategory, limit = 200, level?: LogLevel): LogEntry[] {
    try {
        const content = fs.readFileSync(filePath(category), 'utf8');
        const lines = content.split('\n').filter(Boolean);
        const entries: LogEntry[] = [];

        for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
            try {
                const entry = JSON.parse(lines[i]) as LogEntry;
                if (!level || entry.level === level) entries.push(entry);
            } catch { /* skip malformed lines */ }
        }

        return entries.reverse();
    } catch {
        return [];
    }
}

export function clearLogs(category: LogCategory): void {
    try {
        fs.writeFileSync(filePath(category), '', 'utf8');
    } catch { /* ignore */ }
}

// Conveniences
export const log = {
    webhook: (level: LogLevel, msg: string, data?: Record<string, unknown>) => writeLog('webhook', level, msg, data),
    ai:      (level: LogLevel, msg: string, data?: Record<string, unknown>) => writeLog('ai', level, msg, data),
    payment: (level: LogLevel, msg: string, data?: Record<string, unknown>) => writeLog('payment', level, msg, data),
    auth:    (level: LogLevel, msg: string, data?: Record<string, unknown>) => writeLog('auth', level, msg, data),
    system:  (level: LogLevel, msg: string, data?: Record<string, unknown>) => writeLog('system', level, msg, data),
};
