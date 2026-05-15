import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { asaasServiceForTenant } from '../services/AsaasService';
import { prisma } from '../utils/prisma';
import axios from 'axios';

async function getSvc(req: AuthRequest) {
    return asaasServiceForTenant(req.tenantId);
}

function notConfigured(res: Response) {
    return res.status(400).json({ error: 'Asaas não configurado. Adicione a API key em Integrações.' });
}

async function checkConfigured(req: AuthRequest): Promise<boolean> {
    const t = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { asaasApiKey: true },
    });
    return !!(t?.asaasApiKey);
}

export async function asaasListPayments(req: AuthRequest, res: Response): Promise<Response> {
    if (!await checkConfigured(req)) return notConfigured(res);
    try {
        const svc = await getSvc(req);
        const { limit = 20, offset = 0, status, customer } = req.query;
        const data = await svc.listPayments({ limit, offset, ...(status && { status }), ...(customer && { customer }) });
        return res.json(data);
    } catch (e: any) {
        return res.status(502).json({ error: e.message });
    }
}

export async function asaasCreatePayment(req: AuthRequest, res: Response): Promise<Response> {
    if (!await checkConfigured(req)) return notConfigured(res);
    const { customer, billingType, value, dueDate, description, externalReference } = req.body;
    if (!customer || !billingType || !value || !dueDate) {
        return res.status(400).json({ error: 'Campos obrigatórios: customer, billingType, value, dueDate' });
    }
    try {
        const svc = await getSvc(req);
        const data = await svc.createPayment({ customer, billingType, value: Number(value), dueDate, description, externalReference });
        return res.json(data);
    } catch (e: any) {
        return res.status(502).json({ error: e.message });
    }
}

export async function asaasCancelPayment(req: AuthRequest, res: Response): Promise<Response> {
    if (!await checkConfigured(req)) return notConfigured(res);
    try {
        const svc = await getSvc(req);
        const data = await svc.cancelPayment(req.params.id);
        return res.json(data);
    } catch (e: any) {
        return res.status(502).json({ error: e.message });
    }
}

export async function asaasListCustomers(req: AuthRequest, res: Response): Promise<Response> {
    if (!await checkConfigured(req)) return notConfigured(res);
    try {
        const svc = await getSvc(req);
        const { limit = 20, offset = 0, name, cpfCnpj } = req.query;
        const data = await svc.listCustomers({ limit, offset, ...(name && { name }), ...(cpfCnpj && { cpfCnpj }) });
        return res.json(data);
    } catch (e: any) {
        return res.status(502).json({ error: e.message });
    }
}

export async function asaasCreateCustomer(req: AuthRequest, res: Response): Promise<Response> {
    if (!await checkConfigured(req)) return notConfigured(res);
    const { name, cpfCnpj, email, mobilePhone } = req.body;
    if (!name) return res.status(400).json({ error: 'Campo obrigatório: name' });
    try {
        const svc = await getSvc(req);
        const data = await svc.createCustomer({ name, cpfCnpj, email, mobilePhone });
        return res.json(data);
    } catch (e: any) {
        return res.status(502).json({ error: e.message });
    }
}

// ─── Ações de Sandbox ─────────────────────────────────────────────────────────

async function sandboxHeaders(req: AuthRequest) {
    const t = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { asaasApiKey: true, asaasBaseUrl: true },
    });
    if (!t?.asaasApiKey) throw new Error('Asaas não configurado');
    const isSandbox = (t.asaasBaseUrl ?? '').includes('sandbox');
    if (!isSandbox) throw new Error('Ações de simulação disponíveis apenas no ambiente Sandbox');
    return {
        baseUrl: t.asaasBaseUrl ?? 'https://sandbox.asaas.com/api/v3',
        headers: {
            'access_token': t.asaasApiKey,
            'Content-Type': 'application/json',
            'User-Agent': 'ArtemisBot/1.0',
        },
    };
}

export async function asaasSimulateConfirm(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const { baseUrl, headers } = await sandboxHeaders(req);
        const { id } = req.params;
        // Busca o valor atual da cobrança para passar no receiveInCash
        const paymentRes = await axios.get(`${baseUrl}/payments/${id}`, { headers });
        const value = paymentRes.data?.value ?? 0;
        const today = new Date().toISOString().split('T')[0];
        const data = await axios.post(`${baseUrl}/payments/${id}/receiveInCash`, { paymentDate: today, value }, { headers });
        return res.json(data.data);
    } catch (e: any) {
        const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        return res.status(502).json({ error: msg });
    }
}

export async function asaasSimulateOverdue(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const { baseUrl, headers } = await sandboxHeaders(req);
        const { id } = req.params;
        // Força vencimento movendo dueDate para ontem
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dueDateStr = yesterday.toISOString().split('T')[0];
        const data = await axios.post(`${baseUrl}/payments/${id}`, { dueDate: dueDateStr }, { headers });
        return res.json(data.data);
    } catch (e: any) {
        const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        return res.status(502).json({ error: msg });
    }
}

export async function asaasSimulateRefund(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const { baseUrl, headers } = await sandboxHeaders(req);
        const { id } = req.params;
        const data = await axios.post(`${baseUrl}/payments/${id}/refund`, {}, { headers });
        return res.json(data.data);
    } catch (e: any) {
        const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        return res.status(502).json({ error: msg });
    }
}
