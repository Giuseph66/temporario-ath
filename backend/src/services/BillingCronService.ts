import axios from 'axios';
import { prisma } from '../utils/prisma';

const DEFAULT_TEMPLATE = `Olá {name}! 👋

A sua mensalidade de *R$ {value}* vence em *{dueDate}*.

💳 Acesse o link para pagar:
{link}

Qualquer dúvida estamos à disposição!`;

function formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR');
}

function formatMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function getEvolutionClient(cfg: {
    billingEvolutionBaseUrl: string | null;
    billingEvolutionApiKey: string | null;
}) {
    if (!cfg.billingEvolutionBaseUrl || !cfg.billingEvolutionApiKey) return null;
    return axios.create({
        baseURL: cfg.billingEvolutionBaseUrl,
        headers: { apikey: cfg.billingEvolutionApiKey },
    });
}

async function getAsaasClient(cfg: { asaasApiKey: string | null; asaasBaseUrl: string }) {
    if (!cfg.asaasApiKey) return null;
    return axios.create({
        baseURL: cfg.asaasBaseUrl,
        headers: { access_token: cfg.asaasApiKey },
    });
}

export async function runBillingCycle(options?: { forceMonth?: string; tenantId?: string }): Promise<{
    processed: number; failed: number; skipped: number; runs: string[];
}> {
    const cfg = await prisma.adminConfig.findUnique({ where: { id: 'main' } });
    if (!cfg) return { processed: 0, failed: 0, skipped: 0, runs: [] };

    const asaas = await getAsaasClient({ asaasApiKey: cfg.asaasApiKey, asaasBaseUrl: cfg.asaasBaseUrl });
    const evolution = await getEvolutionClient(cfg);
    const month = options?.forceMonth ?? formatMonth(new Date());

    // Calculate due date (today + billingDueDaysAhead)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (cfg.billingDueDaysAhead ?? 5));

    const template = cfg.billingWhatsappTemplate || DEFAULT_TEMPLATE;

    // Get active subscriptions with Asaas customer
    const subscriptions = await prisma.subscription.findMany({
        where: {
            status: 'ACTIVE',
            asaasCustomerId: { not: null },
            ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
        },
        include: {
            tenant: {
                include: {
                    company: true,
                    tenantUsers: { select: { email: true }, take: 1 },
                },
            },
            plan: true,
            adjustments: true,
        },
    });

    let processed = 0, failed = 0, skipped = 0;
    const runs: string[] = [];

    for (const sub of subscriptions) {
        const tenantId = sub.tenantId;

        // Skip if billing run already exists for this month
        const existing = await prisma.billingRun.findFirst({
            where: { tenantId, month, status: { not: 'CANCELLED' } },
        });
        if (existing) { skipped++; continue; }

        // Calculate effective price
        const basePrice = sub.plan?.basePrice ?? sub.priceMonthly;
        const totalIncrements = sub.adjustments.filter(a => a.type === 'increment').reduce((s, a) => s + a.value, 0);
        const totalDiscounts = sub.adjustments.filter(a => a.type === 'discount').reduce((s, a) => s + a.value, 0);
        const value = basePrice + totalIncrements - totalDiscounts;

        if (value <= 0) { skipped++; continue; }

        // Create BillingRun record
        const run = await prisma.billingRun.create({
            data: {
                tenantId,
                month,
                value,
                dueDate,
                status: 'PENDING',
            },
        });
        runs.push(run.id);

        try {
            // Generate charge in Asaas
            let asaasChargeId: string | undefined;
            let invoiceUrl: string | undefined;
            let bankSlipUrl: string | undefined;
            let paymentLink: string | undefined;

            if (asaas && sub.asaasCustomerId) {
                const chargeRes = await asaas.post('/payments', {
                    customer: sub.asaasCustomerId,
                    billingType: cfg.billingBillingType ?? 'PIX',
                    value,
                    dueDate: dueDate.toISOString().slice(0, 10),
                    description: `Mensalidade ${month} — ${sub.plan?.name ?? sub.planName}`,
                    externalReference: run.id,
                });
                asaasChargeId = chargeRes.data.id;
                invoiceUrl = chargeRes.data.invoiceUrl;
                bankSlipUrl = chargeRes.data.bankSlipUrl;
                paymentLink = invoiceUrl ?? bankSlipUrl ?? chargeRes.data.invoiceUrl;

                await prisma.billingRun.update({
                    where: { id: run.id },
                    data: { asaasChargeId, invoiceUrl, bankSlipUrl },
                });
            }

            // Send WhatsApp if Evolution configured
            let whatsappSent = false;
            const phone = sub.tenant.company?.phone?.replace(/\D/g, '');
            const clientName = sub.tenant.company?.name ?? sub.tenant.name;

            if (evolution && cfg.billingEvolutionInstance && phone && paymentLink) {
                const msg = template
                    .replace(/{name}/g, clientName)
                    .replace(/{value}/g, `R$ ${value.toFixed(2)}`)
                    .replace(/{dueDate}/g, formatDate(dueDate))
                    .replace(/{link}/g, paymentLink);

                await evolution.post(
                    `/message/sendText/${cfg.billingEvolutionInstance}`,
                    { number: phone, text: msg }
                );
                whatsappSent = true;
            }

            await prisma.billingRun.update({
                where: { id: run.id },
                data: { status: 'PENDING', whatsappSent },
            });

            processed++;
            console.log(`[BillingCron] ✓ ${sub.tenant.name} — R$ ${value.toFixed(2)} — WA: ${whatsappSent}`);
        } catch (err: any) {
            failed++;
            const errorMsg = err.response?.data?.errors?.[0]?.description ?? err.message;
            await prisma.billingRun.update({
                where: { id: run.id },
                data: { status: 'FAILED', error: errorMsg },
            });
            console.error(`[BillingCron] ✗ ${sub.tenant.name}: ${errorMsg}`);
        }
    }

    console.log(`[BillingCron] Ciclo ${month} — processados: ${processed}, falhas: ${failed}, pulados: ${skipped}`);
    return { processed, failed, skipped, runs };
}

export function scheduleBillingCron(): void {
    const CHECK_INTERVAL = 60 * 60 * 1000; // check every hour

    async function tick() {
        const cfg = await prisma.adminConfig.findUnique({ where: { id: 'main' } }).catch(() => null);
        if (!cfg?.billingEnabled) return;

        const now = new Date();
        if (now.getDate() !== (cfg.billingDayOfMonth ?? 1)) return;

        // Avoid running more than once per day — check if already ran today
        const today = now.toISOString().slice(0, 10);
        const month = formatMonth(now);
        const alreadyRan = await prisma.billingRun.findFirst({
            where: { month, createdAt: { gte: new Date(today) } },
        }).catch(() => null);
        if (alreadyRan) return;

        console.log(`[BillingCron] Disparando ciclo de cobrança — ${month}`);
        await runBillingCycle().catch(err => console.error('[BillingCron] Erro no ciclo:', err));
    }

    setInterval(tick, CHECK_INTERVAL);
    tick(); // run once on startup to catch up if server restarted on billing day
}
