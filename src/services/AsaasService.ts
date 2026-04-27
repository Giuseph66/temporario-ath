import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * AsaasService — Integração com a API do Asaas
 *
 * Responsável por:
 * 1. Buscar ou criar um cliente no Asaas pelo CPF.
 * 2. Gerar link de cobrança:
 *    - Programas mensais (installments > 1): cria uma assinatura recorrente via /subscriptions
 *      e retorna o invoiceUrl da primeira cobrança gerada.
 *    - Sessão avulsa (installments = 1): cria uma cobrança única via /payments.
 * 3. Cancelar cobranças: cancela assinaturas ativas e cobranças individuais pendentes.
 */
class AsaasService {
    private readonly apiKey: string;
    private readonly baseUrl: string;

    constructor() {
        this.apiKey = process.env.ASAAS_API_KEY || '';
        this.baseUrl = process.env.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api/v3';

        if (!this.apiKey) {
            console.warn('⚠️  [AsaasService] ASAAS_API_KEY não encontrada no .env! Pagamentos não funcionarão.');
        }
    }

    /** Cabeçalhos de autenticação exigidos pela API do Asaas */
    private get headers() {
        return {
            'access_token': this.apiKey,
            'Content-Type': 'application/json',
        };
    }

    /** Extrai e loga a mensagem de erro detalhada retornada pela API do Asaas */
    private handleAxiosError(context: string, error: unknown): never {
        if (error instanceof AxiosError && error.response) {
            const status = error.response.status;
            const body = JSON.stringify(error.response.data);
            console.error(`❌ [AsaasService] ${context} — HTTP ${status}: ${body}`);
            throw new Error(`Asaas ${context} falhou (${status}): ${body}`);
        }
        throw error;
    }

    /**
     * Busca um cliente existente pelo CPF ou cria um novo.
     * Retorna o `asaasCustomerId` (ex: "cus_0001...").
     */
    async getOrCreateCustomer(name: string, cpf: string, phone: string): Promise<string> {
        const cpfClean = cpf.replace(/\D/g, '');

        let searchResponse;
        try {
            searchResponse = await axios.get(`${this.baseUrl}/customers`, {
                headers: this.headers,
                params: { cpfCnpj: cpfClean }
            });
        } catch (error) {
            this.handleAxiosError('buscar cliente', error);
        }

        const existingCustomers = searchResponse.data?.data ?? [];
        if (existingCustomers.length > 0) {
            const customerId = existingCustomers[0].id;
            console.log(`✅ [AsaasService] Cliente encontrado: ${customerId}`);
            try {
                await axios.post(`${this.baseUrl}/customers/${customerId}`, {
                    name,
                    mobilePhone: phone.replace(/\D/g, '')
                }, { headers: this.headers });
                console.log(`🔄 [AsaasService] Dados do cliente ${customerId} atualizados.`);
            } catch (e) {
                console.warn(`⚠️ [AsaasService] Falha ao atualizar dados do cliente ${customerId}.`);
            }
            return customerId;
        }

        let createResponse;
        try {
            createResponse = await axios.post(`${this.baseUrl}/customers`, {
                name,
                cpfCnpj: cpfClean,
                mobilePhone: phone.replace(/\D/g, ''),
            }, { headers: this.headers });
        } catch (error) {
            this.handleAxiosError('criar cliente', error);
        }

        const newCustomerId = createResponse.data.id;
        console.log(`🆕 [AsaasService] Cliente criado: ${newCustomerId}`);
        return newCustomerId;
    }

    /**
     * Gera um link de cobrança no Asaas.
     * - installmentCount > 1: cria assinatura recorrente mensal via /subscriptions.
     *   Retorna o invoiceUrl da primeira cobrança da assinatura.
     * - installmentCount = 1: cria cobrança única via /payments (ex: sessão avulsa de terapia).
     *
     * @param firstDueDate - Data do primeiro vencimento (YYYY-MM-DD). Padrão: D+3.
     */
    async generatePaymentLink(
        asaasCustomerId: string,
        value: number,
        description: string,
        installmentCount: number = 1,
        firstDueDate?: string
    ): Promise<string> {
        const dueDateStr = firstDueDate || (() => {
            const d = new Date();
            d.setDate(d.getDate() + 3);
            return d.toISOString().split('T')[0];
        })();

        if (installmentCount > 1) {
            return this.generateSubscription(asaasCustomerId, value, description, dueDateStr);
        }

        // Sessão avulsa — cobrança única
        const payload: any = {
            customer: asaasCustomerId,
            billingType: 'UNDEFINED',
            value,
            dueDate: dueDateStr,
            description,
        };

        let response;
        try {
            response = await axios.post(`${this.baseUrl}/payments`, payload, { headers: this.headers });
        } catch (error) {
            this.handleAxiosError('gerar cobrança avulsa', error);
        }

        const invoiceUrl = response.data.invoiceUrl;
        if (!invoiceUrl) {
            console.error(`❌ [AsaasService] invoiceUrl ausente na resposta:`, JSON.stringify(response.data));
            throw new Error(`Asaas não retornou invoiceUrl. Resposta: ${JSON.stringify(response.data)}`);
        }
        console.log(`💳 [AsaasService] Link de pagamento avulso gerado: ${invoiceUrl}`);
        return invoiceUrl;
    }

    /**
     * Cria uma assinatura recorrente mensal no Asaas e retorna o invoiceUrl
     * da primeira cobrança gerada automaticamente pela assinatura.
     */
    private async generateSubscription(
        asaasCustomerId: string,
        monthlyValue: number,
        description: string,
        nextDueDate: string
    ): Promise<string> {
        let subResponse;
        try {
            subResponse = await axios.post(`${this.baseUrl}/subscriptions`, {
                customer: asaasCustomerId,
                billingType: 'UNDEFINED',
                value: monthlyValue,
                nextDueDate,
                cycle: 'MONTHLY',
                description,
            }, { headers: this.headers });
        } catch (error) {
            this.handleAxiosError('criar assinatura', error);
        }

        const subscriptionId = subResponse.data.id;
        console.log(`🔁 [AsaasService] Assinatura criada: ${subscriptionId}`);

        // Busca a primeira cobrança gerada pela assinatura para obter o invoiceUrl
        let paymentsResponse;
        try {
            paymentsResponse = await axios.get(`${this.baseUrl}/payments`, {
                headers: this.headers,
                params: { subscription: subscriptionId, limit: 1 },
            });
        } catch (error) {
            this.handleAxiosError('buscar primeira cobrança da assinatura', error);
        }

        const payments: any[] = paymentsResponse.data?.data ?? [];
        if (payments.length === 0) {
            throw new Error(`Asaas não gerou nenhuma cobrança para a assinatura ${subscriptionId}`);
        }

        const invoiceUrl = payments[0].invoiceUrl;
        if (!invoiceUrl) {
            console.error(`❌ [AsaasService] invoiceUrl ausente na primeira cobrança:`, JSON.stringify(payments[0]));
            throw new Error(`Asaas não retornou invoiceUrl na primeira cobrança da assinatura.`);
        }

        console.log(`💳 [AsaasService] Link da primeira mensalidade gerado: ${invoiceUrl}`);
        return invoiceUrl;
    }

    /**
     * Cancela todas as cobranças ativas de um cliente no Asaas:
     * 1. Cancela assinaturas recorrentes ativas (via DELETE /subscriptions/{id}).
     * 2. Cancela cobranças individuais PENDING remanescentes.
     * Retorna o número total de itens cancelados.
     */
    async cancelPendingPayments(asaasCustomerId: string): Promise<{ cancelled: number }> {
        let cancelled = 0;

        // 1. Cancela assinaturas ativas
        try {
            const subsResponse = await axios.get(`${this.baseUrl}/subscriptions`, {
                headers: this.headers,
                params: { customer: asaasCustomerId, status: 'ACTIVE' },
            });
            const subscriptions: any[] = subsResponse.data?.data ?? [];
            for (const sub of subscriptions) {
                await axios.delete(`${this.baseUrl}/subscriptions/${sub.id}`, { headers: this.headers });
                console.log(`🚫 [AsaasService] Assinatura ${sub.id} cancelada.`);
                cancelled++;
            }
        } catch (error) {
            console.warn(`⚠️ [AsaasService] Falha ao cancelar assinaturas para ${asaasCustomerId}:`, error);
        }

        // 2. Cancela cobranças individuais pendentes remanescentes
        try {
            const listResponse = await axios.get(`${this.baseUrl}/payments`, {
                headers: this.headers,
                params: { customer: asaasCustomerId, status: 'PENDING' },
            });
            const payments: any[] = listResponse.data?.data ?? [];
            if (payments.length === 0 && cancelled === 0) {
                console.log(`ℹ️  [AsaasService] Nenhuma cobrança ou assinatura encontrada para ${asaasCustomerId}`);
            }
            for (const payment of payments) {
                try {
                    await axios.post(`${this.baseUrl}/payments/${payment.id}/cancel`, {}, { headers: this.headers });
                    console.log(`🚫 [AsaasService] Cobrança ${payment.id} cancelada.`);
                    cancelled++;
                } catch (error) {
                    console.warn(`⚠️ [AsaasService] Falha ao cancelar cobrança ${payment.id}.`);
                }
            }
        } catch (error) {
            console.warn(`⚠️ [AsaasService] Falha ao listar cobranças pendentes para ${asaasCustomerId}:`, error);
        }

        return { cancelled };
    }
}

export const asaasService = new AsaasService();
