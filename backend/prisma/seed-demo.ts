import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MINS = (n: number) => new Date(Date.now() - n * 60000);
const HRS = (n: number) => new Date(Date.now() - n * 3600000);
const DAYS = (n: number) => new Date(Date.now() - n * 86400000);

async function main() {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) { console.error('Nenhum tenant encontrado. Rode o seed principal primeiro.'); return; }

    const agent = await prisma.agent.findFirst({ where: { tenantId: tenant.id } });

    // Clean up old demo leads
    await prisma.user.deleteMany({
        where: { tenantId: tenant.id, phoneNumber: { in: ['+5566996001122', '+5566997112233', '+5566991234567', '+5566998877665'] } },
    });

    // ── 1. Maria Silva — PAYMENT_PENDING / CLOSING ─────────────────────────────
    const maria = await prisma.user.create({
        data: {
            tenantId: tenant.id, agentId: agent?.id,
            phoneNumber: '+5566996001122', name: 'Maria Silva',
            age: 28, goal: 'Melhorar inglês para promoção no trabalho',
            currentProgramId: 'ingles_personalizado',
            conversationState: 'CLOSING',
            enrollmentStatus: 'PAYMENT_PENDING',
            enrollmentTarget: 'ingles_personalizado',
            email: 'maria.silva@email.com',
            lgpdConsent: true, interactionCount: 14,
            lastInteraction: MINS(8),
            asaasCustomerId: 'cus_0009fe4a812b',
            lastPaymentUrl: 'https://www.asaas.com/c/xyz123demo',
        },
    });
    const mariaMsgs = [
        { role: 'user',  content: 'Oi, vi o anúncio de vocês sobre curso de inglês', createdAt: MINS(38) },
        { role: 'model', content: 'Olá! Bem-vinda à Confluence Treinamento 🎓 Antes de continuarmos, preciso da sua autorização para coletar e tratar seus dados, conforme a LGPD. Podemos continuar?', createdAt: MINS(37) },
        { role: 'user',  content: 'Sim, pode continuar', createdAt: MINS(36) },
        { role: 'model', content: 'Perfeito! Para te indicar o melhor programa, me conta: qual é o seu objetivo com o inglês?', createdAt: MINS(35) },
        { role: 'user',  content: 'Preciso melhorar para uma promoção no trabalho, meu chefe falou que preciso ter fluência', createdAt: MINS(33) },
        { role: 'model', content: 'Entendo! Inglês profissional é uma das nossas especialidades. Qual a sua idade?', createdAt: MINS(32) },
        { role: 'user',  content: '28 anos', createdAt: MINS(31) },
        { role: 'model', content: 'Excelente! Para o seu perfil o *Inglês Personalizado* é perfeito. Aulas 100% adaptadas, foco em vocabulário corporativo.\n\n💡 Valor: R$ 550/mês • Início imediato\n\nQuer que eu gere o link de matrícula?', createdAt: MINS(28) },
        { role: 'user',  content: 'Quanto tempo leva pra ficar fluente?', createdAt: MINS(25) },
        { role: 'model', content: 'Com 3-4h/semana, melhorias perceptíveis em 3 meses. Fluência conversacional em 12-18 meses. Posso enviar o link?', createdAt: MINS(22) },
        { role: 'user',  content: 'Sim, manda o link', createdAt: MINS(18) },
        { role: 'model', content: 'Aqui está o seu link de matrícula! Assim que o pagamento for confirmado, nossa equipe entra em contato para agendar sua primeira aula. 🚀', createdAt: MINS(17) },
        { role: 'model', content: 'https://www.asaas.com/c/xyz123demo', createdAt: MINS(17) },
        { role: 'user',  content: 'Obrigada! Vou pagar agora', createdAt: MINS(8) },
    ];
    for (const m of mariaMsgs) {
        await prisma.chatHistory.create({ data: { userId: maria.id, ...m } });
    }

    // ── 2. João Mendes — LEAD / QUALIFICATION ──────────────────────────────────
    const joao = await prisma.user.create({
        data: {
            tenantId: tenant.id, agentId: agent?.id,
            phoneNumber: '+5566997112233', name: 'João Mendes',
            age: 16, goal: 'Aprender inglês para faculdade',
            currentProgramId: 'ingles_techlab',
            conversationState: 'QUALIFICATION',
            enrollmentStatus: 'LEAD',
            lgpdConsent: true, interactionCount: 5,
            lastInteraction: HRS(2),
        },
    });
    const joaoMsgs = [
        { role: 'user',  content: 'Olá, vi sobre o curso de inglês', createdAt: HRS(3) },
        { role: 'model', content: 'Olá! Bem-vindo à Confluence! Antes de tudo, preciso da sua autorização LGPD. Pode ser?', createdAt: HRS(3) },
        { role: 'user',  content: 'Pode sim', createdAt: new Date(HRS(3).getTime() + 60000) },
        { role: 'model', content: 'Ótimo! Qual é o seu objetivo com o inglês?', createdAt: new Date(HRS(2).getTime() + 60000) },
        { role: 'user',  content: 'Tenho 16 anos, posso fazer o Tech Lab?', createdAt: HRS(2) },
    ];
    for (const m of joaoMsgs) {
        await prisma.chatHistory.create({ data: { userId: joao.id, ...m as any } });
    }

    // ── 3. Ana Beatriz — ENROLLED ──────────────────────────────────────────────
    const ana = await prisma.user.create({
        data: {
            tenantId: tenant.id, agentId: agent?.id,
            phoneNumber: '+5566991234567', name: 'Ana Beatriz',
            age: 32, goal: 'Inglês para viagem internacional',
            currentProgramId: 'ingles_personalizado',
            conversationState: 'GREETING',
            enrollmentStatus: 'ENROLLED',
            enrollmentDate: DAYS(15),
            email: 'ana.beatriz@gmail.com',
            lgpdConsent: true, interactionCount: 22,
            lastInteraction: DAYS(1),
            asaasCustomerId: 'cus_0001ab32ef',
        },
    });
    const anaMsgs = [
        { role: 'user',  content: 'Boa tarde!', createdAt: DAYS(1) },
        { role: 'model', content: 'Boa tarde, Ana! Como posso te ajudar hoje? 😉', createdAt: DAYS(1) },
        { role: 'user',  content: 'Quando é minha próxima aula?', createdAt: DAYS(1) },
        { role: 'model', content: 'Deixa eu verificar o calendário pra você...', createdAt: DAYS(1) },
    ];
    for (const m of anaMsgs) {
        await prisma.chatHistory.create({ data: { userId: ana.id, ...m } });
    }

    // ── 4. Número desconhecido — LEAD / HUMAN_HANDOFF ─────────────────────────
    const unknown = await prisma.user.create({
        data: {
            tenantId: tenant.id, agentId: agent?.id,
            phoneNumber: '+5566998877665',
            conversationState: 'HUMAN_HANDOFF',
            enrollmentStatus: 'LEAD',
            lgpdConsent: false, interactionCount: 3,
            lastInteraction: DAYS(3),
        },
    });
    const unknownMsgs = [
        { role: 'user',  content: 'Oi', createdAt: DAYS(3) },
        { role: 'model', content: 'Olá! Sou a Artemis da Confluence. Posso guardar nossas conversas conforme a LGPD?', createdAt: DAYS(3) },
        { role: 'user',  content: 'Quero falar com um humano', createdAt: DAYS(3) },
    ];
    for (const m of unknownMsgs) {
        await prisma.chatHistory.create({ data: { userId: unknown.id, ...m } });
    }

    console.log('✅ Demo seed concluído: 4 leads + histórico inseridos.');
    console.log(`   Maria Silva (${maria.id}) — PAYMENT_PENDING`);
    console.log(`   João Mendes (${joao.id}) — LEAD`);
    console.log(`   Ana Beatriz (${ana.id}) — ENROLLED`);
    console.log(`   Desconhecido (${unknown.id}) — HUMAN_HANDOFF`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
