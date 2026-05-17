import axios from 'axios';

declare module 'axios' {
    export interface InternalAxiosRequestConfig {
        __devStartedAt?: number;
    }
}

function sanitize(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(sanitize);
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, val]) => {
            const k = key.toLowerCase();
            if (k.includes('password') || k.includes('token') || k.includes('authorization') || k.includes('apikey')) {
                return [key, '[redacted]'];
            }
            return [key, sanitize(val)];
        })
    );
}

function preview(value: unknown) {
    const sanitized = sanitize(value);
    const text = typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized, null, 2);
    return text && text.length > 4000 ? `${text.slice(0, 4000)}...` : sanitized;
}

if (import.meta.env.DEV) {
    axios.interceptors.request.use(config => {
        config.__devStartedAt = performance.now();
        const method = config.method?.toUpperCase() ?? 'GET';
        console.groupCollapsed(`[API →] ${method} ${config.url}`);
        if (config.params) console.log('params', preview(config.params));
        if (config.data) console.log('body', preview(config.data));
        console.groupEnd();
        return config;
    });

    axios.interceptors.response.use(
        response => {
            const method = response.config.method?.toUpperCase() ?? 'GET';
            const ms = response.config.__devStartedAt ? Math.round(performance.now() - response.config.__devStartedAt) : 0;
            console.groupCollapsed(`[API ←] ${response.status} ${method} ${response.config.url} (${ms}ms)`);
            console.log('result', preview(response.data));
            console.groupEnd();
            return response;
        },
        error => {
            const config = error.config ?? {};
            const method = config.method?.toUpperCase?.() ?? 'GET';
            const ms = config.__devStartedAt ? Math.round(performance.now() - config.__devStartedAt) : 0;
            const status = error.response?.status ?? 'ERR';
            console.groupCollapsed(`[API ✕] ${status} ${method} ${config.url ?? ''} (${ms}ms)`);
            console.log('error', preview(error.response?.data ?? error.message));
            console.groupEnd();
            return Promise.reject(error);
        }
    );
}
