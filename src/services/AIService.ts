import { GoogleGenerativeAI, Tool, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import dotenv from "dotenv";
import { calendarService } from "./CalendarService";
import { asaasService } from "./AsaasService";
import { WhatsAppService } from "./WhatsAppService";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();
const whatsapp = new WhatsAppService();

// ── Error classification for intelligent retry logic ─────────────────────────
type ErrorCategory = 'TRANSIENT' | 'RATE_LIMIT' | 'PERMANENT';

function classifyError(error: unknown): ErrorCategory {
    if (error instanceof Error) {
        const name = error.name;
        const msg = error.message.toLowerCase();

        // AbortError = timeout from the SDK's internal AbortController
        if (name === 'AbortError' || msg.includes('aborted')) return 'TRANSIENT';
        // Network failures
        if (msg.includes('econnreset') || msg.includes('econnrefused') ||
            msg.includes('etimedout') || msg.includes('fetch failed') ||
            msg.includes('network')) return 'TRANSIENT';
        // 500/503 server errors from Google
        if (msg.includes('500') || msg.includes('503') ||
            msg.includes('internal') || msg.includes('unavailable')) return 'TRANSIENT';
        // 429 / resource exhausted
        if (msg.includes('429') || msg.includes('rate limit') ||
            msg.includes('resource exhausted') || msg.includes('quota')) return 'RATE_LIMIT';
    }
    // Everything else (400, 401, 403, invalid request, etc.) is permanent
    return 'PERMANENT';
}

// Tool declarations exposed to the Gemini model for real calendar operations
const checkAvailabilityDecl: FunctionDeclaration = {
    name: "check_availability",
    description: "Verifica os horários ocupados no calendário da Confluence para um intervalo de tempo. Retorna uma lista de slots ocupados. Use isso ANTES de confirmar qualquer horário ao cliente.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            timeMin: {
                type: SchemaType.STRING,
                description: "Início do intervalo a verificar, em formato ISO 8601 (ex: 2026-03-10T08:00:00-04:00)"
            },
            timeMax: {
                type: SchemaType.STRING,
                description: "Fim do intervalo a verificar, em formato ISO 8601 (ex: 2026-03-10T18:00:00-04:00)"
            }
        },
        required: ["timeMin", "timeMax"]
    }
};

const createAppointmentDecl: FunctionDeclaration = {
    name: "create_appointment",
    description: "Cria um evento no calendário da Confluence. Só chame esta função APÓS o cliente ter confirmado explicitamente o horário desejado. Para matrículas regulares, SEMPRE chame esta função JUNTO com 'generate_payment' na mesma resposta — nunca uma sem a outra. A única exceção é aula experimental gratuita (recurringWeeks: 0). Para programas semestrais (Inglês Personalizado, Tech Lab), use 'recurringWeeks' para agendar todas as aulas do semestre de uma vez.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            summary: {
                type: SchemaType.STRING,
                description: "Título do evento, incluindo o tipo de serviço e o nome do cliente (ex: 'Inglês Personalizado - João Silva')"
            },
            startTime: {
                type: SchemaType.STRING,
                description: "Data e hora de início do agendamento, em formato ISO 8601 (ex: 2026-03-10T09:00:00-04:00)"
            },
            endTime: {
                type: SchemaType.STRING,
                description: "Data e hora de término do agendamento, em formato ISO 8601 (ex: 2026-03-10T10:00:00-04:00)"
            },
            recurringWeeks: {
                type: SchemaType.NUMBER,
                description: "Número de semanas para repetir o evento semanalmente. Use o valor de 'duration_weeks' do programa (ex: 24 para programas de 6 meses). Omita ou use 0 para aulas avulsas e aulas experimentais."
            }
        },
        required: ["summary", "startTime", "endTime"]
    }
};

const findAppointmentsDecl: FunctionDeclaration = {
    name: "find_appointments",
    description: "Busca eventos agendados no calendário da Confluence num intervalo de tempo. Retorna lista de eventos com id, resumo e horários. Use ANTES de cancelar uma aula para identificar o evento correto.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            query: {
                type: SchemaType.STRING,
                description: "Texto para filtrar pelo título do evento (ex: nome do aluno). Deixe vazio para listar todos no período."
            },
            timeMin: {
                type: SchemaType.STRING,
                description: "Início do intervalo de busca, em formato ISO 8601 (ex: 2026-03-10T08:00:00-04:00)"
            },
            timeMax: {
                type: SchemaType.STRING,
                description: "Fim do intervalo de busca, em formato ISO 8601 (ex: 2026-03-10T18:00:00-04:00)"
            }
        },
        required: ["timeMin", "timeMax"]
    }
};

const cancelAppointmentDecl: FunctionDeclaration = {
    name: "cancel_appointment",
    description: "Remove (cancela) um ou todos os eventos de uma série no calendário da Confluence. Só chame APÓS identificar o evento correto com find_appointments e confirmar com o usuário. Use 'id' para cancelar apenas uma aula. Use 'recurringEventId' (retornado por find_appointments) para cancelar TODAS as aulas de uma série recorrente.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            eventId: {
                type: SchemaType.STRING,
                description: "ID do evento a cancelar. Para cancelar só uma ocorrência, passe o 'id' da instância. Para cancelar toda a série, passe o 'recurringEventId' retornado por find_appointments."
            }
        },
        required: ["eventId"]
    }
};

const generatePaymentDecl: FunctionDeclaration = {
    name: "generate_payment",
    description: "Gera um link de cobrança real no Asaas para o aluno. Suporta 3 tipos de pagamento: 'monthly' (assinatura recorrente mensal), 'semester' (cobrança única do semestre com 5% de desconto) e 'annual' (cobrança única do ano com 7% de desconto). Para sessão avulsa de terapia PRM, use paymentType 'monthly' com installmentCount 1. SOMENTE chame após informar o valor, confirmar o CPF, perguntar a data de vencimento e o tipo de pagamento preferido.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            customerName: {
                type: SchemaType.STRING,
                description: "Nome completo do cliente/aluno."
            },
            cpf: {
                type: SchemaType.STRING,
                description: "CPF do cliente, exatamente como fornecido (com ou sem formatação). Ex: '123.456.789-00' ou '12345678900'."
            },
            amount: {
                type: SchemaType.NUMBER,
                description: "Valor MENSAL (ou por sessão) BASE da cobrança em reais, SEM desconto. Ex: 550.00 para Inglês Personalizado individual, 410.00 para dupla. O sistema aplicará o desconto automaticamente conforme o paymentType."
            },
            description: {
                type: SchemaType.STRING,
                description: "Descrição do curso ou serviço sendo cobrado. Ex: 'Inglês Personalizado 2026 — Mensalidade'"
            },
            installmentCount: {
                type: SchemaType.NUMBER,
                description: "Número de meses/parcelas do programa. Use o valor de 'installments' do programa (ex: 6). Use 1 para sessão avulsa de terapia."
            },
            paymentType: {
                type: SchemaType.STRING,
                format: "enum",
                description: "Tipo de pagamento escolhido pelo aluno. 'monthly' = parcelado mensal (assinatura recorrente). 'semester' = pagamento integral do semestre com 5% de desconto (cobrança única). 'annual' = pagamento integral do ano com 7% de desconto (cobrança única). Para Terapia PRM, use SEMPRE 'monthly'.",
                enum: ["monthly", "semester", "annual"]
            },
            firstDueDate: {
                type: SchemaType.STRING,
                description: "Data do primeiro vencimento no formato YYYY-MM-DD, conforme preferência informada pelo aluno. Ex: '2026-04-10' para vencimento no dia 10 de abril."
            }
        },
        required: ["customerName", "cpf", "amount", "description", "installmentCount", "paymentType"]
    }
};

const cancelAsaasPaymentDecl: FunctionDeclaration = {
    name: "cancel_asaas_payment",
    description: "Cancela todas as cobranças PENDENTES do usuário atual no Asaas. Use quando o usuário quiser cancelar um pagamento ou cobrança gerada. Não requer parâmetros — o sistema identifica o cliente pelo telefone cadastrado.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {}
    }
};

const ALL_TOOLS: Tool[] = [{
    functionDeclarations: [checkAvailabilityDecl, createAppointmentDecl, findAppointmentsDecl, cancelAppointmentDecl, generatePaymentDecl, cancelAsaasPaymentDecl]
}];

export class AIService {
    private genAI: GoogleGenerativeAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY || "";
        if (!apiKey) console.error("❌ ERRO CRÍTICO: Chave GEMINI_API_KEY ausente.");
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    private isModelReasoning(text: string): boolean {
        const trimmed = text.trim();
        if (!trimmed) return true;
        
        // Detect English monologue patterns that are clearly internal reasoning
        const reasoningPatterns = [
            /^(Wait|Actually|I should|I will|I've done|I don't need|I need to|Let me|The system|The tool)/i,
            /tool calls? (are|is) executing/i,
            /I should just (output|return|wait)/i,
            /the prompt (allows|says|instructs)/i,
        ];
        if (reasoningPatterns.some(p => p.test(trimmed))) return true;
        
        // Detect predominantly English text (>60% ASCII letters in a Portuguese bot)
        // This catches cases where the model switches to English for internal reasoning
        const words = trimmed.split(/\s+/);
        if (words.length > 5) {
            const asciiWordPattern = /^[a-zA-Z']+$/;
            const asciiWords = words.filter(w => asciiWordPattern.test(w)).length;
            if (asciiWords / words.length > 0.7) return true;
        }
        
        return false;
    }

    private async executeToolCall(name: string, args: any, userPhone: string): Promise<{ result: any; capturedPaymentUrl?: string }> {
        let toolResult: any;
        let capturedPaymentUrl: string | undefined;

        try {
            if (name === "check_availability") {
                console.log(`🗓️ Artemis chamou check_availability: ${args.timeMin} → ${args.timeMax}`);
                const rawSlots = await calendarService.checkAvailability(args.timeMin, args.timeMax);
                console.log(`🗓️ Resultado check_availability:`, JSON.stringify(rawSlots));
                toolResult = rawSlots.length === 0
                    ? { busySlots: [], message: "Nenhum horário ocupado neste período — todos os slots estão disponíveis." }
                    : { busySlots: rawSlots, message: `${rawSlots.length} horário(s) ocupado(s) encontrado(s).` };

            } else if (name === "create_appointment") {
                console.log(`📅 Artemis chamou create_appointment: "${args.summary}" às ${args.startTime}${args.recurringWeeks ? ` (recorrente: ${args.recurringWeeks} semanas)` : ''}`);

                // Server-side availability guard: reject if the slot is already taken
                const busySlots = await calendarService.checkAvailability(args.startTime, args.endTime);
                if (busySlots.length > 0) {
                    console.warn(`⛔ Horário indisponível para create_appointment. Slots ocupados:`, JSON.stringify(busySlots));
                    toolResult = {
                        error: 'Horário indisponível. Já existe um agendamento neste horário.',
                        busySlots: busySlots,
                    };
                } else {
                    toolResult = await calendarService.createAppointment(args.summary, args.startTime, args.endTime, args.recurringWeeks);
                    console.log(`📅 Evento criado:`, toolResult);
                }
                // NOTE: WhatsApp Business API requires 24h messaging window — Dayana
                // notifications disabled for now. Calendar event itself serves as notification.

            } else if (name === "find_appointments") {
                console.log(`🔍 Artemis chamou find_appointments: query="${args.query ?? ''}" | ${args.timeMin} → ${args.timeMax}`);
                const rawEvents = await calendarService.findAppointments(args.query ?? '', args.timeMin, args.timeMax);
                console.log(`🔍 Resultado find_appointments:`, JSON.stringify(rawEvents));
                toolResult = rawEvents.length === 0
                    ? { events: [], message: "Nenhum evento encontrado neste período." }
                    : { events: rawEvents, message: `${rawEvents.length} evento(s) encontrado(s).` };

            } else if (name === "cancel_appointment") {
                console.log(`🗑️  Artemis chamou cancel_appointment: eventId=${args.eventId}`);
                toolResult = await calendarService.cancelAppointment(args.eventId);
                console.log(`🗑️  Resultado cancel_appointment:`, toolResult);

            } else if (name === "generate_payment") {
                const paymentType = args.paymentType || 'monthly';
                console.log(`💳 Artemis chamou generate_payment: ${args.customerName} | CPF: ${args.cpf} | R$${args.amount} | tipo: ${paymentType}`);

                // 1. Busca o usuário no banco pelo telefone
                const dbUser = await prisma.user.findUnique({
                    where: { phoneNumber: userPhone }
                });

                let asaasCustomerId = dbUser?.asaasCustomerId ?? null;

                // 2. Se não tiver ID Asaas salvo, busca/cria o cliente e salva no banco
                if (!asaasCustomerId) {
                    asaasCustomerId = await asaasService.getOrCreateCustomer(
                        args.customerName,
                        args.cpf,
                        userPhone
                    );

                    await prisma.user.update({
                        where: { phoneNumber: userPhone },
                        data: {
                            asaasCustomerId: asaasCustomerId,
                            cpf: args.cpf.replace(/\D/g, '') // Salva só os dígitos
                        }
                    });
                    console.log(`💾 asaasCustomerId e CPF salvos no banco para ${userPhone}`);
                } else {
                    console.log(`♻️  Usando asaasCustomerId já salvo: ${asaasCustomerId}`);
                }

                // 3. Calcula valor final e parcelas conforme tipo de pagamento
                let finalAmount = args.amount;
                let finalInstallments = args.installmentCount ?? 1;

                if (paymentType === 'semester') {
                    // Cobrança única do semestre com 5% de desconto
                    finalAmount = args.amount * (args.installmentCount ?? 6) * 0.95;
                    finalInstallments = 1;
                    console.log(`💰 Pagamento semestral: ${args.installmentCount ?? 6}x R$${args.amount} com 5% desc = R$${finalAmount.toFixed(2)}`);
                } else if (paymentType === 'annual') {
                    // Cobrança única do ano (12 meses) com 7% de desconto
                    finalAmount = args.amount * 12 * 0.93;
                    finalInstallments = 1;
                    console.log(`💰 Pagamento anual: 12x R$${args.amount} com 7% desc = R$${finalAmount.toFixed(2)}`);
                }

                // Arredonda para 2 casas decimais
                finalAmount = Math.round(finalAmount * 100) / 100;

                // 4. Gera o link de cobrança (assinatura ou avulso)
                const invoiceUrl = await asaasService.generatePaymentLink(
                    asaasCustomerId,
                    finalAmount,
                    args.description,
                    finalInstallments,
                    args.firstDueDate
                );

                capturedPaymentUrl = invoiceUrl;

                // Persist the real URL to the DB so it can be recalled without history
                await prisma.user.update({
                    where: { phoneNumber: userPhone },
                    data: { lastPaymentUrl: invoiceUrl } as any
                });

                // NOTE: WhatsApp Business API requires 24h messaging window — Dayana
                // enrollment notifications disabled for now. Payment confirmation
                // is handled by the Asaas webhook flow instead.

                // Tell the model the link was generated but NOT to include it in text —
                // the code will send the exact URL as a separate message to prevent truncation.
                toolResult = {
                    success: true,
                    message: 'Link de pagamento gerado com sucesso. O link será enviado automaticamente ao usuário como mensagem separada — NÃO escreva nem repita o link no texto da sua resposta.'
                };
                console.log(`✅ Link de pagamento gerado com sucesso: ${invoiceUrl}`);

            } else if (name === "cancel_asaas_payment") {
                console.log(`🚫 Artemis chamou cancel_asaas_payment para ${userPhone}`);
                const dbUser = await prisma.user.findUnique({ where: { phoneNumber: userPhone } });
                if (!dbUser?.asaasCustomerId) {
                    toolResult = { success: false, message: 'Nenhuma cobrança encontrada para este usuário.' };
                } else {
                    toolResult = await asaasService.cancelPendingPayments(dbUser.asaasCustomerId);
                    console.log(`🚫 Resultado cancel_asaas_payment:`, toolResult);
                }

            } else {
                console.warn(`⚠️ Tool desconhecida chamada pelo modelo: ${name}`);
                toolResult = { error: `Ferramenta '${name}' não reconhecida.` };
            }
        } catch (toolError: any) {
            console.error(`❌ Erro ao executar tool '${name}':`, toolError?.message ?? toolError);
            toolResult = { error: `Falha ao executar '${name}': ${toolError?.message ?? 'erro desconhecido'}` };
        }

        return { result: toolResult, capturedPaymentUrl };
    }

    /**
     * Gera a resposta da Artemis.
     *
     * O `systemInstruction` agora é construído externamente pelo PromptBuilder,
     * com apenas os blocos de instrução relevantes para o estado atual da conversa.
     * Isso evita sobrecarregar o modelo com regras que não se aplicam ao momento.
     *
     * Inclui um loop de function calling: quando o modelo chama check_availability,
     * create_appointment ou generate_payment, a função real é executada e o resultado
     * é devolvido ao modelo para que ele possa responder com dados reais.
     *
     * @param userPhone - Número de telefone do usuário (ex: "5565999999999") — usado para buscar/salvar o ID Asaas no banco.
     */
    async generateResponse(userPhone: string, history: any[], message: string, systemInstruction: string, state: string = 'GREETING'): Promise<{ text: string; paymentUrl?: string }> {
        try {
            // Filter tools based on current conversation state
            const activeToolDecls: FunctionDeclaration[] = [];
            if (['PROGRAM_PRESENTATION', 'OBJECTION_HANDLING', 'CLOSING'].includes(state)) {
                activeToolDecls.push(checkAvailabilityDecl, createAppointmentDecl, findAppointmentsDecl, cancelAppointmentDecl);
            }
            if (state === 'CLOSING') {
                activeToolDecls.push(generatePaymentDecl, cancelAsaasPaymentDecl);
            }
            const toolsToPass: Tool[] | undefined = activeToolDecls.length > 0
                ? [{ functionDeclarations: activeToolDecls }]
                : undefined;

            // States with tool calling need more time: larger system prompt + sequential API calls
            const TOOL_STATES = ['PROGRAM_PRESENTATION', 'OBJECTION_HANDLING', 'CLOSING'];
            const timeoutMs = TOOL_STATES.includes(state) ? 60_000 : 45_000;

            // O modelo é instanciado por chamada, com a instrução de sistema correta
            const model = this.genAI.getGenerativeModel({
                model: "gemini-3.1-pro-preview",
                systemInstruction: systemInstruction,
                tools: toolsToPass,
                generationConfig: {
                    temperature: 0.2,  // Low randomness: forces strict persona adherence
                    topP: 0.85,        // Narrows vocabulary pool to reduce repetitive patterns
                    topK: 40           // Limits candidate tokens to suppress emoji loops
                }
            }, { timeout: timeoutMs });

            let validHistory: any[] = [];
            if (Array.isArray(history)) {
                validHistory = history.map(h => {
                    const role = h.role === 'assistant' ? 'model' : 'user';
                    const text = h.content || "";
                    return { role: role, parts: [{ text: String(text) }] };
                }).filter(h => h.parts[0].text !== "");
            }

            const chat = model.startChat({ history: validHistory });
            let result = await chat.sendMessage(String(message));

            // Captures the real payment URL so it can be sent by code (never by model text)
            let capturedPaymentUrl: string | undefined;
            let calledCreateAppointment = false;
            let calledGeneratePayment = false;

            // Tool-call loop: execute real functions when the model requests them
            const TOOL_LOOP_TIMEOUT_MS = 90_000; // 90s wall clock for the entire tool loop
            const loopStartTime = Date.now();

            while (true) {
                if (Date.now() - loopStartTime > TOOL_LOOP_TIMEOUT_MS) {
                    console.error('⏰ Tool-calling loop exceeded 90s wall clock — aborting.');
                    break;
                }

                const parts = result.response.candidates?.[0]?.content?.parts ?? [];
                const toolCallParts = parts.filter((p: any) => p.functionCall);
                if (toolCallParts.length === 0) break; // No tool call → final text response ready

                const functionResponses: Array<{name: string; result: any}> = [];

                for (const toolCallPart of toolCallParts) {
                    const { name, args } = toolCallPart.functionCall as { name: string; args: any };
                    
                    if (name === "create_appointment") calledCreateAppointment = true;
                    if (name === "generate_payment") calledGeneratePayment = true;

                    const execResult = await this.executeToolCall(name, args, userPhone);
                    if (execResult.capturedPaymentUrl) {
                        capturedPaymentUrl = execResult.capturedPaymentUrl;
                    }

                    functionResponses.push({ name, result: execResult.result });
                }

                result = await chat.sendMessage(
                    functionResponses.map(fr => ({ functionResponse: { name: fr.name, response: { result: fr.result } } }))
                );
            }

            // Safety net: se create_appointment foi chamado em CLOSING mas generate_payment não foi
            if (state === 'CLOSING' && calledCreateAppointment && !calledGeneratePayment) {
                console.warn('⚠️ Safety net: create_appointment sem generate_payment em CLOSING.');
                result = await chat.sendMessage(
                    'ATENÇÃO: Você agendou a aula com create_appointment mas NÃO gerou o pagamento com generate_payment. ' +
                    'Conforme as regras, ambas devem ser chamadas juntas. Chame generate_payment AGORA com os dados já coletados.'
                );

                let safetyNetAttempts = 0;
                while (safetyNetAttempts < 2) {
                    if (Date.now() - loopStartTime > TOOL_LOOP_TIMEOUT_MS) {
                        console.error('⏰ Safety net loop exceeded wall clock — aborting.');
                        break;
                    }

                    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
                    const toolCallParts = parts.filter((p: any) => p.functionCall);
                    if (toolCallParts.length === 0) break;

                    const functionResponses: Array<{name: string; result: any}> = [];
                    for (const toolCallPart of toolCallParts) {
                        const { name, args } = toolCallPart.functionCall as { name: string; args: any };

                        if (name === "generate_payment") calledGeneratePayment = true;

                        const execResult = await this.executeToolCall(name, args, userPhone);
                        if (execResult.capturedPaymentUrl) {
                            capturedPaymentUrl = execResult.capturedPaymentUrl;
                        }

                        functionResponses.push({ name, result: execResult.result });
                    }

                    result = await chat.sendMessage(
                        functionResponses.map(fr => ({ functionResponse: { name: fr.name, response: { result: fr.result } } }))
                    );
                    safetyNetAttempts++;
                }
            }

            // Safety net reverso: se generate_payment foi chamado sem create_appointment
            if (state === 'CLOSING' && calledGeneratePayment && !calledCreateAppointment) {
                console.warn('⚠️ Safety net: generate_payment sem create_appointment em CLOSING.');
                result = await chat.sendMessage(
                    'ATENÇÃO: Você chamou generate_payment mas esqueceu de chamar create_appointment. ' +
                    'Conforme as regras, você deve chamar create_appointment AGORA com os dados da aula.'
                );

                let safetyNetAttempts = 0;
                while (safetyNetAttempts < 2) {
                    if (Date.now() - loopStartTime > TOOL_LOOP_TIMEOUT_MS) {
                        console.error('⏰ Safety net loop exceeded wall clock — aborting.');
                        break;
                    }

                    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
                    const toolCallParts = parts.filter((p: any) => p.functionCall);
                    if (toolCallParts.length === 0) break;

                    const functionResponses: Array<{name: string; result: any}> = [];
                    for (const toolCallPart of toolCallParts) {
                        const { name, args } = toolCallPart.functionCall as { name: string; args: any };

                        if (name === "create_appointment") calledCreateAppointment = true;

                        const execResult = await this.executeToolCall(name, args, userPhone);
                        if (execResult.capturedPaymentUrl) {
                            capturedPaymentUrl = execResult.capturedPaymentUrl;
                        }

                        functionResponses.push({ name, result: execResult.result });
                    }

                    result = await chat.sendMessage(
                        functionResponses.map(fr => ({ functionResponse: { name: fr.name, response: { result: fr.result } } }))
                    );
                    safetyNetAttempts++;
                }
            }

            // Filtra textos de reasoning do modelo antes de enviar pro WhatsApp
            let responseText: string = "";
            try {
                const finalParts = result.response.candidates?.[0]?.content?.parts ?? [];
                const textParts = finalParts
                    .filter((p: any) => p.text && !this.isModelReasoning(p.text))
                    .map((p: any) => p.text as string);
                
                responseText = textParts.join('').replace(/\*\*/g, '*');
            } catch {
                console.warn('⚠️ result.response não retornou as partes corretamente.');
            }

            if (!responseText.trim()) {
                console.warn('⚠️ Gemini retornou resposta vazia após pre-processamento e tool calls. Tentando novamente...');
                try {
                    const retryResult = await chat.sendMessage(
                        'A resposta não conteve texto válido ou foi apenas texto de raciocínio interno. Responda ao usuário em Português agora repassando os dados do agendamento ou pagamento.'
                    );
                    const retryParts = retryResult.response.candidates?.[0]?.content?.parts ?? [];
                    responseText = retryParts
                        .filter((p: any) => p.text && !this.isModelReasoning(p.text))
                        .map((p: any) => p.text as string)
                        .join('')
                        .replace(/\*\*/g, '*');
                } catch {
                    responseText = '';
                }

                if (!responseText.trim()) {
                    console.warn('⚠️ Retry também vazio. Usando fallback neutro.');
                    return {
                        text: 'Desculpe, tive um problema ao processar sua solicitação. Pode repetir o que precisa?',
                        paymentUrl: capturedPaymentUrl,
                    };
                }
            }

            return { text: responseText, paymentUrl: capturedPaymentUrl };

        } catch (error: any) {
            const category = classifyError(error);
            console.error(`❌ Erro Crítico na API do Gemini [${category}]:`, {
                name: error?.name,
                message: error?.message,
                state: state,
            });
            const wrappedError = new Error('AI_GENERATION_FAILED');
            (wrappedError as any).category = category;
            (wrappedError as any).cause = error;
            throw wrappedError;
        }
    }

    /**
     * Extrai dados de perfil do histórico da conversa.
     * Usa um modelo separado, focado em retornar JSON puro.
     */
    async extractProfileData(history: any[]): Promise<any> {
        try {
            const jsonModel = this.genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: { responseMimeType: "application/json" }
            }, { timeout: 30_000 });

            const prompt = `
Analise o histórico de conversa abaixo e extraia os dados do usuário.
Retorne ESTRITAMENTE um objeto JSON com as chaves: "name", "age", "goal" e "enrollmentTarget".
- "name": nome completo do aluno.
- "age": idade do aluno-alvo (número inteiro). Se a matrícula é para outra pessoa (filho, filha, etc.), extraia a idade DESSA PESSOA, não de quem está conversando.
- "goal": objetivo do aluno com o inglês.
- "enrollmentTarget": para quem é a matrícula (ex: "para si mesmo", "para meu filho", "para minha filha de 15 anos").
  REGRA CRÍTICA: SOMENTE extraia "enrollmentTarget" se o usuário DECLAROU EXPLICITAMENTE para quem é a matrícula. NUNCA assuma "para si mesmo" por padrão. Se o usuário não disse explicitamente para quem é, retorne null.
Se uma informação ainda não foi dita explicitamente pelo usuário, retorne null para aquela chave.

Histórico:
${JSON.stringify(history)}
`;

            const result = await jsonModel.generateContent(prompt);
            let textResponse = result.response.text();
            textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(textResponse);

        } catch (error) {
            console.error("Erro ao extrair perfil:", error);
            return {};
        }
    }
}

export const aiService = new AIService();
