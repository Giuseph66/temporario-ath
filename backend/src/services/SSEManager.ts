import { Response } from 'express';

class SSEManager {
    private clients = new Map<string, Set<Response>>();

    addClient(tenantId: string, res: Response) {
        if (!this.clients.has(tenantId)) this.clients.set(tenantId, new Set());
        this.clients.get(tenantId)!.add(res);
    }

    removeClient(tenantId: string, res: Response) {
        this.clients.get(tenantId)?.delete(res);
    }

    emit(tenantId: string, event: string, data: object) {
        const connections = this.clients.get(tenantId);
        if (!connections?.size) return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const res of connections) {
            try { res.write(payload); } catch { connections.delete(res); }
        }
    }
}

export const sseManager = new SSEManager();
