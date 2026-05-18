import axios from 'axios';
import { prisma } from '../utils/prisma';

async function getAdminAsaasClient() {
    const cfg = await prisma.adminConfig.findUnique({ where: { id: 'main' } });
    if (!cfg?.asaasApiKey) throw new Error('ASAAS_NOT_CONFIGURED');
    return axios.create({
        baseURL: cfg.asaasBaseUrl ?? 'https://sandbox.asaas.com/api/v3',
        headers: { access_token: cfg.asaasApiKey },
    });
}

export async function createAsaasCustomer(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { company: true },
    });
    if (!tenant?.company) throw new Error('NO_COMPANY_LINKED');

    const c = tenant.company;
    if (!c.document) throw new Error('NO_DOCUMENT');

    const client = await getAdminAsaasClient();
    const res = await client.post('/customers', {
        name: c.name,
        cpfCnpj: c.document.replace(/\D/g, ''),
        email: c.email ?? undefined,
        phone: c.phone?.replace(/\D/g, '') ?? undefined,
        mobilePhone: c.phone?.replace(/\D/g, '') ?? undefined,
        address: c.address ?? undefined,
        city: c.city ?? undefined,
        state: c.state ?? undefined,
        postalCode: c.zipCode?.replace(/\D/g, '') ?? undefined,
        externalReference: tenantId,
    });

    const customerId: string = res.data.id;

    await prisma.subscription.upsert({
        where: { tenantId },
        create: { tenantId, status: 'TRIAL', asaasCustomerId: customerId },
        update: { asaasCustomerId: customerId },
    });

    return { asaasCustomerId: customerId, customer: res.data };
}

export async function createAsaasCharge(tenantId: string, options: {
    billingType: string;
    value: number;
    dueDate: string;
    description?: string;
}) {
    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub?.asaasCustomerId) throw new Error('NO_CUSTOMER_ID');
    if (options.value <= 0) throw new Error('INVALID_PRICE');

    const client = await getAdminAsaasClient();
    const res = await client.post('/payments', {
        customer: sub.asaasCustomerId,
        billingType: options.billingType,
        value: options.value,
        dueDate: options.dueDate,
        description: options.description || 'Cobrança avulsa',
        externalReference: tenantId,
    });
    return res.data;
}

export async function deleteAsaasCharge(chargeId: string) {
    const client = await getAdminAsaasClient();
    const res = await client.delete(`/payments/${chargeId}`);
    return res.data;
}

export async function listAsaasCharges(tenantId: string) {
    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub?.asaasSubscriptionId && !sub?.asaasCustomerId) throw new Error('NO_ASAAS_IDS');

    const client = await getAdminAsaasClient();

    let data: any;
    if (sub.asaasSubscriptionId) {
        const res = await client.get(`/subscriptions/${sub.asaasSubscriptionId}/payments`, {
            params: { limit: 20, offset: 0 },
        });
        data = res.data;
    } else {
        const res = await client.get('/payments', {
            params: { customer: sub.asaasCustomerId, limit: 20, offset: 0 },
        });
        data = res.data;
    }

    return data;
}

const BILLING_CYCLE_MAP: Record<string, string> = {
    monthly: 'MONTHLY',
    quarterly: 'QUARTERLY',
    yearly: 'YEARLY',
};

export async function createAsaasSubscription(tenantId: string, options: {
    billingType: string;  // BOLETO | PIX | CREDIT_CARD
    nextDueDate: string;  // YYYY-MM-DD
}) {
    const sub = await prisma.subscription.findUnique({
        where: { tenantId },
        include: { plan: true, adjustments: true },
    });
    if (!sub?.asaasCustomerId) throw new Error('NO_CUSTOMER_ID');

    // Preço efetivo = base do plano ± ajustes (mesmo cálculo do frontend)
    const basePrice = sub.plan?.basePrice ?? sub.priceMonthly;
    const totalIncrements = sub.adjustments.filter(a => a.type === 'increment').reduce((s, a) => s + a.value, 0);
    const totalDiscounts = sub.adjustments.filter(a => a.type === 'discount').reduce((s, a) => s + a.value, 0);
    const value = basePrice + totalIncrements - totalDiscounts;
    if (value <= 0) throw new Error('INVALID_PRICE');

    const cycle = BILLING_CYCLE_MAP[sub.plan?.billingCycle ?? 'monthly'] ?? 'MONTHLY';
    const description = sub.plan ? `${sub.plan.name} — ${sub.planName}` : sub.planName;

    const client = await getAdminAsaasClient();
    const res = await client.post('/subscriptions', {
        customer: sub.asaasCustomerId,
        billingType: options.billingType,
        value,
        nextDueDate: options.nextDueDate,
        cycle,
        description,
        externalReference: sub.id,
    });

    const subscriptionId: string = res.data.id;

    await prisma.subscription.update({
        where: { tenantId },
        data: { asaasSubscriptionId: subscriptionId, status: 'ACTIVE' },
    });

    return { asaasSubscriptionId: subscriptionId, subscription: res.data };
}
